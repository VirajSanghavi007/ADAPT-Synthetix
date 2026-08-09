from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from jiwer import cer as compute_cer
from jiwer import wer as compute_wer
from pydantic import BaseModel, Field
from sqlalchemy import func, text

from Backend.admin import require_admin
from Backend.db import ASRLog, EvalMetric, ModelRegistry, PriorityQueueEntry, RequestLatency, TTSLog, get_session

router = APIRouter(prefix="/api/mlops", tags=["mlops"])


def record_latency(
    kind: str, model_id: str, tier: str, latency_ms: float, success: bool = True, cold: bool = False
) -> None:
    db = get_session()
    try:
        db.add(
            RequestLatency(
                kind=kind, model_id=model_id, tier=tier, latency_ms=latency_ms,
                success=int(success), cold=cold,
            )
        )
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


def record_eval_metric(asr_log_id: int, model_id: str, reference_text: str, hypothesis_text: str) -> None:
    if not reference_text.strip() or not hypothesis_text.strip():
        return
    db = get_session()
    try:
        db.add(
            EvalMetric(
                asr_log_id=asr_log_id,
                model_id=model_id,
                wer=compute_wer(reference_text, hypothesis_text),
                cer=compute_cer(reference_text, hypothesis_text),
            )
        )
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


@router.get("/metrics")
def get_metrics(admin: dict = Depends(require_admin)):
    db = get_session()
    try:
        rows = db.execute(
            text(
                """
                select model_id, date_trunc('day', created_at) as day,
                       avg(wer) as avg_wer, avg(cer) as avg_cer, count(*) as n
                from eval_metrics
                group by model_id, day
                order by model_id, day
                """
            )
        ).all()
    finally:
        db.close()

    return [
        {
            "model_id": r[0],
            "day": r[1].isoformat() if r[1] else None,
            "avg_wer": round(r[2], 4),
            "avg_cer": round(r[3], 4),
            "n": r[4],
        }
        for r in rows
    ]


@router.get("/registry")
def get_registry(admin: dict = Depends(require_admin)):
    db = get_session()
    try:
        rows = db.query(ModelRegistry).order_by(ModelRegistry.kind, ModelRegistry.tier).all()
        return [
            {
                "id": r.id,
                "kind": r.kind,
                "tier": r.tier,
                "model_id": r.model_id,
                "version_tag": r.version_tag,
                "is_live": bool(r.is_live),
                "notes": r.notes,
                "promoted_at": r.promoted_at.isoformat() if r.promoted_at else None,
            }
            for r in rows
        ]
    finally:
        db.close()


class PromoteRequest(BaseModel):
    kind: str = Field(..., pattern="^(asr|tts)$")
    tier: str = Field(..., pattern="^(free|pro|max|enterprise)$")
    model_id: str
    version_tag: str
    notes: str | None = None


@router.post("/registry/promote")
def promote_model(req: PromoteRequest, admin: dict = Depends(require_admin)):
    db = get_session()
    try:
        db.query(ModelRegistry).filter(
            ModelRegistry.kind == req.kind, ModelRegistry.tier == req.tier, ModelRegistry.is_live == 1
        ).update({"is_live": 0})
        db.add(
            ModelRegistry(
                kind=req.kind,
                tier=req.tier,
                model_id=req.model_id,
                version_tag=req.version_tag,
                is_live=1,
                notes=req.notes,
            )
        )
        db.commit()
    finally:
        db.close()
    return {"status": "promoted"}


@router.get("/drift-signal")
def get_drift_signal(admin: dict = Depends(require_admin)):
    db = get_session()
    try:
        marker = db.execute(
            text("select value_timestamp from training_marker where key = 'last_trained_at'")
        ).first()
        since = marker[0] if marker else datetime(1970, 1, 1, tzinfo=timezone.utc)

        new_asr = db.query(func.count(ASRLog.id)).filter(ASRLog.created_at > since).scalar()
        new_tts = db.query(func.count(TTSLog.id)).filter(TTSLog.created_at > since).scalar()

        recent_wer = db.execute(
            text(
                "select avg(wer) from eval_metrics where created_at > :since"
            ),
            {"since": since},
        ).scalar()
        baseline_wer = db.execute(text("select avg(wer) from eval_metrics")).scalar()
    finally:
        db.close()

    return {
        "since_last_training": since.isoformat(),
        "new_asr_samples": new_asr,
        "new_tts_samples": new_tts,
        "recent_avg_wer": round(recent_wer, 4) if recent_wer is not None else None,
        "baseline_avg_wer": round(baseline_wer, 4) if baseline_wer is not None else None,
        "note": "volume-based proxy, not real drift detection — see docstring",
    }


@router.get("/latency")
def get_latency(admin: dict = Depends(require_admin)):
    db = get_session()
    try:
        rows = db.execute(
            text(
                """
                select
                    model_id,
                    kind,
                    tier,
                    count(*) as n,
                    percentile_cont(0.5) within group (order by latency_ms) as p50_ms,
                    percentile_cont(0.95) within group (order by latency_ms) as p95_ms,
                    avg(case when success = 1 then 0.0 else 1.0 end) as error_rate,
                    count(*) filter (where cold) as cold_n,
                    avg(latency_ms) filter (where cold) as cold_avg_ms,
                    avg(latency_ms) filter (where not cold) as warm_avg_ms
                from request_latency
                where created_at > now() - interval '7 days'
                group by model_id, kind, tier
                order by model_id
                """
            )
        ).all()
    finally:
        db.close()

    return [
        {
            "model_id": r[0],
            "kind": r[1],
            "tier": r[2],
            "n": r[3],
            "p50_ms": round(r[4], 1) if r[4] is not None else None,
            "p95_ms": round(r[5], 1) if r[5] is not None else None,
            "error_rate": round(r[6], 4) if r[6] is not None else None,
            "cold_n": r[7],
            "cold_avg_ms": round(r[8], 1) if r[8] is not None else None,
            "warm_avg_ms": round(r[9], 1) if r[9] is not None else None,
        }
        for r in rows
    ]



@router.post("/noise-model/fit")
def fit_noise_model(admin: dict = Depends(require_admin)):
    from Backend.noise_fingerprint import fit_clusters
    return fit_clusters()


@router.post("/error-model/fit")
def fit_error_model(admin: dict = Depends(require_admin)):
    from Backend.error_diagnosis import fit_classifier
    return fit_classifier()


@router.get("/priority-queue")
def list_priority_queue(admin: dict = Depends(require_admin)):
    db = get_session()
    try:
        rows = (
            db.query(PriorityQueueEntry)
            .order_by(PriorityQueueEntry.priority_score.desc())
            .limit(200)
            .all()
        )
        return [
            {
                "id": r.id,
                "asr_log_id": r.asr_log_id,
                "priority_score": r.priority_score,
                "domain_match_count": r.domain_match_count,
                "error_type": r.error_type,
                "status": r.status,
                "human_importance": r.human_importance,
                "reviewed_at": r.reviewed_at.isoformat() if r.reviewed_at else None,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]
    finally:
        db.close()


class PriorityReviewRequest(BaseModel):
    importance: int = Field(..., ge=1, le=5)


@router.post("/priority-queue/{entry_id}/review")
def review_priority_entry(entry_id: int, req: PriorityReviewRequest, admin: dict = Depends(require_admin)):
    from Backend.priority_queue import record_human_review

    ok = record_human_review(entry_id, req.importance, admin["id"])
    if not ok:
        raise HTTPException(404, f"priority queue entry {entry_id} not found")
    return {"id": entry_id, "human_importance": req.importance}
