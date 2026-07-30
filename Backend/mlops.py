"""MLOps: WER/CER tracking, model version registry, and a crude drift signal.

Fine-tuning itself is deferred — this module is the seam it plugs into: eval_metrics
records accuracy over time per model, model_registry tracks which checkpoint is "live"
per tier (all "base" until a fine-tune is promoted), and the drift signal reuses the
same Postgres counts n8n's retrain_trigger.json already polls.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from jiwer import cer as compute_cer
from jiwer import wer as compute_wer
from pydantic import BaseModel, Field
from sqlalchemy import func, text

from Backend.admin import require_admin
from Backend.db import ASRLog, EvalMetric, ModelRegistry, TTSLog, get_session

router = APIRouter(prefix="/api/mlops", tags=["mlops"])


def record_eval_metric(asr_log_id: int, model_id: str, reference_text: str, hypothesis_text: str) -> None:
    """Called from /api/transcribe alongside phoneme-error logging, whenever a
    reference_text is supplied."""
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
    finally:
        db.close()


@router.get("/metrics")
def get_metrics(admin: dict = Depends(require_admin)):
    """WER/CER trend per model — daily averages, for the accuracy-over-time chart."""
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
    """Marks a new checkpoint live for a kind/tier, retiring the previous one. This is
    the manual promotion step an eval harness run should gate — don't call this unless
    the candidate has already beaten the current live model on a held-out set."""
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
    """Crude drift proxy: new-sample counts since the last training marker — the same
    query n8n's retrain_trigger.json polls. NOT real confidence-drift monitoring
    (v2's CUSUM approach isn't ported yet — this just tells you volume, not accuracy
    degradation)."""
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
