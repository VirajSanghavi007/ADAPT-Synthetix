"""Transcript/TTS history — the Dashboard shows lifetime counts but there was no way
to actually browse past results. Paginated, searchable by transcript text, filterable
by model, and exportable as CSV."""
import csv
import io

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse

from Backend.api_keys import require_user_or_api_key
from Backend.db import ASRLog, TTSLog, get_session

router = APIRouter(prefix="/api/history", tags=["history"])


def _require_user_id(auth: dict = Depends(require_user_or_api_key)) -> str:
    return auth["id"]


@router.get("")
def get_history(
    kind: str = Query("asr", pattern="^(asr|tts)$"),
    search: str | None = None,
    model_id: str | None = None,
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user_id: str = Depends(_require_user_id),
):
    db = get_session()
    try:
        if kind == "asr":
            q = db.query(ASRLog).filter(ASRLog.user_id == user_id)
            if search:
                q = q.filter(ASRLog.transcript.ilike(f"%{search}%"))
            if model_id:
                q = q.filter(ASRLog.model_id == model_id)
            total = q.count()
            rows = q.order_by(ASRLog.created_at.desc()).offset(offset).limit(limit).all()
            items = [
                {
                    "id": r.id,
                    "text": r.transcript,
                    "duration_sec": r.duration_sec,
                    "model_id": r.model_id,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                }
                for r in rows
            ]
        else:
            q = db.query(TTSLog).filter(TTSLog.user_id == user_id)
            if search:
                q = q.filter(TTSLog.input_text.ilike(f"%{search}%"))
            if model_id:
                q = q.filter(TTSLog.model_id == model_id)
            total = q.count()
            rows = q.order_by(TTSLog.created_at.desc()).offset(offset).limit(limit).all()
            items = [
                {
                    "id": r.id,
                    "text": r.input_text,
                    "voice": r.voice,
                    "model_id": r.model_id,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                }
                for r in rows
            ]
    finally:
        db.close()

    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/export.csv")
def export_history_csv(
    kind: str = Query("asr", pattern="^(asr|tts)$"),
    user_id: str = Depends(_require_user_id),
):
    db = get_session()
    try:
        if kind == "asr":
            rows = (
                db.query(ASRLog)
                .filter(ASRLog.user_id == user_id)
                .order_by(ASRLog.created_at.desc())
                .all()
            )
            header = ["created_at", "model_id", "duration_sec", "transcript"]
            data_rows = [[r.created_at, r.model_id, r.duration_sec, r.transcript] for r in rows]
        else:
            rows = (
                db.query(TTSLog)
                .filter(TTSLog.user_id == user_id)
                .order_by(TTSLog.created_at.desc())
                .all()
            )
            header = ["created_at", "model_id", "voice", "input_text"]
            data_rows = [[r.created_at, r.model_id, r.voice, r.input_text] for r in rows]
    finally:
        db.close()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(header)
    writer.writerows(data_rows)
    buf.seek(0)

    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=adapt-synthetix-{kind}-history.csv"},
    )
