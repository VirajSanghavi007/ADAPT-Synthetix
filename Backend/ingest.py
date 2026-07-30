"""Bulk audio ingestion for transcription: multi-file computer upload and Google Drive import.

Both paths feed the same transcribe pipeline as /api/transcribe and log to ASRLog,
so results show up in the Dashboard/Error Analysis like any other transcription.
"""
import httpx
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel, Field

from Backend.api_keys import require_user_or_api_key
from Backend.asr_pipeline import ALLOWED_AUDIO_TYPES, decode_audio, transcribe_audio
from Backend.db import ASRLog, get_session
from Backend.tiers import check_tier_rate_limit, get_user_tier, resolve_model

router = APIRouter(prefix="/api/ingest", tags=["ingest"])

MAX_AUDIO_BYTES = 25 * 1024 * 1024
MAX_BATCH_SIZE = 20


def _require_user_id(auth: dict = Depends(require_user_or_api_key)) -> str:
    return auth["id"]


def _transcribe_and_log(user_id: str, filename: str, raw: bytes, model_id: str) -> dict:
    try:
        audio, sr = decode_audio(raw)
    except Exception:
        return {"filename": filename, "error": "could not decode audio file"}

    try:
        text = transcribe_audio(audio, sr, model_id)
    except Exception as e:
        return {"filename": filename, "error": f"transcription failed: {e}"}

    duration_sec = len(audio) / sr if sr else None
    db = get_session()
    try:
        db.add(ASRLog(user_id=user_id, transcript=text, duration_sec=duration_sec, model_id=model_id))
        db.commit()
    finally:
        db.close()

    return {"filename": filename, "text": text, "duration_sec": duration_sec}


@router.post("/upload")
async def upload_batch(
    files: list[UploadFile] = File(...),
    model_id: str | None = None,
    user_id: str = Depends(_require_user_id),
):
    """Bulk upload from the user's computer — each file is transcribed and logged."""
    if len(files) > MAX_BATCH_SIZE:
        raise HTTPException(413, f"too many files (max {MAX_BATCH_SIZE} per batch)")

    tier = get_user_tier(user_id)
    resolved_model = resolve_model(tier, "asr", model_id)

    results = []
    for f in files:
        check_tier_rate_limit(user_id, tier)
        if f.content_type not in ALLOWED_AUDIO_TYPES:
            results.append({"filename": f.filename, "error": f"unsupported content type: {f.content_type}"})
            continue
        raw = await f.read(MAX_AUDIO_BYTES + 1)
        if not raw:
            results.append({"filename": f.filename, "error": "empty file"})
            continue
        if len(raw) > MAX_AUDIO_BYTES:
            results.append({"filename": f.filename, "error": "file too large (max 25MB)"})
            continue
        results.append(await run_in_threadpool(_transcribe_and_log, user_id, f.filename, raw, resolved_model))

    return {"results": results}


class DriveImportRequest(BaseModel):
    access_token: str = Field(..., description="Google OAuth access token with drive.readonly scope, obtained client-side")
    file_ids: list[str] = Field(..., min_length=1, max_length=MAX_BATCH_SIZE)
    model_id: str | None = None


@router.post("/drive")
async def import_from_drive(
    req: DriveImportRequest,
    user_id: str = Depends(_require_user_id),
):
    """Import audio files from Google Drive by file ID. The access token is used once
    to download the files and is never persisted."""
    tier = get_user_tier(user_id)
    resolved_model = resolve_model(tier, "asr", req.model_id)

    results = []
    async with httpx.AsyncClient(timeout=60.0) as client:
        for file_id in req.file_ids:
            check_tier_rate_limit(user_id, tier)
            meta_resp = await client.get(
                f"https://www.googleapis.com/drive/v3/files/{file_id}",
                params={"fields": "name,mimeType,size"},
                headers={"Authorization": f"Bearer {req.access_token}"},
            )
            if meta_resp.status_code != 200:
                results.append({"file_id": file_id, "error": f"could not read file metadata ({meta_resp.status_code})"})
                continue
            meta = meta_resp.json()
            if meta.get("mimeType") not in ALLOWED_AUDIO_TYPES:
                results.append({
                    "file_id": file_id,
                    "filename": meta.get("name"),
                    "error": f"unsupported file type: {meta.get('mimeType')}",
                })
                continue
            if int(meta.get("size") or 0) > MAX_AUDIO_BYTES:
                results.append({"file_id": file_id, "filename": meta.get("name"), "error": "file too large (max 25MB)"})
                continue

            content_resp = await client.get(
                f"https://www.googleapis.com/drive/v3/files/{file_id}",
                params={"alt": "media"},
                headers={"Authorization": f"Bearer {req.access_token}"},
            )
            if content_resp.status_code != 200:
                results.append({"file_id": file_id, "filename": meta.get("name"), "error": f"download failed ({content_resp.status_code})"})
                continue

            result = await run_in_threadpool(
                _transcribe_and_log, user_id, meta.get("name", file_id), content_resp.content, resolved_model
            )
            result["file_id"] = file_id
            results.append(result)

    return {"results": results}
