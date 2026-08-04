import os
import time

from dotenv import load_dotenv

load_dotenv()

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from Backend.account import router as account_router
from Backend.admin import router as admin_router
from Backend.api_keys import require_user_or_api_key
from Backend.credits import check_and_deduct_credit, get_credit_status, get_enterprise_usage
from Backend.enterprise import router as enterprise_router
from Backend.api_keys import router as api_keys_router
from Backend.history import router as history_router
from Backend.asr_pipeline import ALLOWED_AUDIO_TYPES, decode_audio, synthesize_speech, transcribe_audio
from Backend.db import ASRLog, PhonemeError, TTSLog, get_session, init_db
from Backend.ingest import router as ingest_router
from Backend.limiter import limiter
from Backend.mcp_server import mcp
from Backend.mlops import record_eval_metric, record_latency
from Backend.mlops import router as mlops_router
from Backend.password import router as password_router
from Backend.profile import router as profile_router
from Backend.phoneme_diagnostics import align_phoneme_errors, build_error_report
from Backend.spaces_status import router as spaces_status_router
from Backend.tiers import (
    ASR_CATALOG,
    TIER_MODELS,
    TTS_CATALOG,
    check_tier_rate_limit,
    get_user_tier,
    resolve_model,
)

app = FastAPI(title="Mercury v3")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

_allowed_origins = os.environ.get("CORS_ORIGINS", "http://localhost:8000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization", "X-API-Key"],
)

init_db()
app.include_router(admin_router)
app.include_router(password_router)
app.include_router(api_keys_router)
app.include_router(ingest_router)
app.include_router(profile_router)
app.include_router(account_router)
app.include_router(enterprise_router)
app.include_router(mlops_router)
app.include_router(spaces_status_router)
app.include_router(history_router)
app.mount("/mcp", mcp.streamable_http_app())

MAX_AUDIO_BYTES = 25 * 1024 * 1024
MAX_TTS_CHARS = 2000


def _require_user_id(auth: dict = Depends(require_user_or_api_key)) -> str:
    return auth["id"]


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/models")
def list_models(user_id: str = Depends(_require_user_id)):
    """Models available to the current user's tier, for the frontend model picker."""
    tier = get_user_tier(user_id)
    allowed = TIER_MODELS.get(tier, TIER_MODELS["free"])
    return {
        "tier": tier,
        "asr": [{"id": m, "label": ASR_CATALOG[m]["label"]} for m in allowed["asr"]],
        "tts": [{"id": m, "label": TTS_CATALOG[m]["label"]} for m in allowed["tts"]],
    }


@app.get("/api/credits")
def credits_status(user_id: str = Depends(_require_user_id)):
    """Current usage-credit balance (free/pro/max) or pay-per-use usage (enterprise),
    for the Subscription/Settings page."""
    tier = get_user_tier(user_id)
    if tier == "enterprise":
        return get_enterprise_usage(user_id)
    return get_credit_status(user_id, tier)


@app.post("/api/transcribe")
@limiter.limit("10/minute")
async def transcribe(
    request: Request,
    file: UploadFile = File(...),
    reference_text: str | None = Form(None),
    model_id: str | None = Form(None),
    user_id: str = Depends(_require_user_id),
):
    if file.content_type not in ALLOWED_AUDIO_TYPES:
        raise HTTPException(415, f"unsupported content type: {file.content_type}")

    raw = await file.read(MAX_AUDIO_BYTES + 1)
    if not raw:
        raise HTTPException(400, "empty audio file")
    if len(raw) > MAX_AUDIO_BYTES:
        raise HTTPException(413, "audio file too large (max 25MB)")

    tier = get_user_tier(user_id)
    check_tier_rate_limit(user_id, tier)
    check_and_deduct_credit(user_id, tier)
    resolved_model = resolve_model(tier, "asr", model_id)

    try:
        audio, sr = decode_audio(raw)
    except Exception:
        raise HTTPException(400, "could not decode audio file")

    start = time.monotonic()
    try:
        text = await run_in_threadpool(transcribe_audio, audio, sr, resolved_model)
    except Exception:
        record_latency("asr", resolved_model, tier, (time.monotonic() - start) * 1000, success=False)
        raise
    record_latency("asr", resolved_model, tier, (time.monotonic() - start) * 1000, success=True)

    # Logging (ASRLog, phoneme errors, eval metrics) is best-effort — the transcript
    # is already computed, so a DB hiccup here must not turn a successful transcribe
    # into a 500. log_id stays None if the insert itself fails.
    duration_sec = len(audio) / sr if sr else None
    db = get_session()
    log_id = None
    try:
        log = ASRLog(user_id=user_id, transcript=text, duration_sec=duration_sec, model_id=resolved_model)
        db.add(log)
        db.commit()
        db.refresh(log)
        log_id = log.id

        if reference_text and reference_text.strip():
            alignment = align_phoneme_errors(reference_text, text)
            db.add_all(
                PhonemeError(
                    transcription_id=log.id,
                    operation=e["operation"],
                    reference_phoneme=e["reference"] or None,
                    hypothesis_phoneme=e["hypothesis"] or None,
                )
                for e in alignment["errors"]
            )
            db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()

    if log_id is not None and reference_text and reference_text.strip():
        record_eval_metric(log_id, resolved_model, reference_text, text)

    return {"text": text}


@app.get("/api/errors/report")
@limiter.limit("30/minute")
def errors_report(request: Request, user_id: str = Depends(_require_user_id)):
    """Confusion-matrix view over logged phoneme errors, for the Error Analysis dashboard."""
    db = get_session()
    try:
        rows = (
            db.query(
                PhonemeError.operation,
                PhonemeError.reference_phoneme,
                PhonemeError.hypothesis_phoneme,
            )
            .all()
        )
    finally:
        db.close()

    counts: dict[tuple, int] = {}
    for operation, ref, hyp in rows:
        key = (operation, ref, hyp)
        counts[key] = counts.get(key, 0) + 1

    grouped = sorted(
        (
            {"operation": op, "reference_phoneme": ref, "hypothesis_phoneme": hyp, "count": n}
            for (op, ref, hyp), n in counts.items()
        ),
        key=lambda r: (-r["count"], r["operation"]),
    )
    return build_error_report(grouped)


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=MAX_TTS_CHARS)
    # Empty by default so each Space applies its own valid default voice
    # (Kokoro's af_heart, CosyVoice2's "default" spk_id) instead of a bogus
    # cross-model placeholder name that 404s against the wrong model's voice pack.
    voice: str = ""
    model_id: str | None = None


@app.post("/api/tts")
@limiter.limit("10/minute")
async def tts(request: Request, req: TTSRequest, user_id: str = Depends(_require_user_id)):
    text = req.text.strip()
    if not text:
        raise HTTPException(400, "empty text")

    tier = get_user_tier(user_id)
    check_tier_rate_limit(user_id, tier)
    check_and_deduct_credit(user_id, tier)
    resolved_model = resolve_model(tier, "tts", req.model_id)

    # CosyVoice2 SFT inference — spk_id must match one of pipeline.list_available_spks()
    # TODO: confirm exact spk_id set once the model is pulled in Docker
    start = time.monotonic()
    try:
        mp3_bytes = await run_in_threadpool(synthesize_speech, text, req.voice, resolved_model)
    except Exception:
        record_latency("tts", resolved_model, tier, (time.monotonic() - start) * 1000, success=False)
        raise
    record_latency("tts", resolved_model, tier, (time.monotonic() - start) * 1000, success=(mp3_bytes is not None))
    if mp3_bytes is None:
        raise HTTPException(500, "no audio generated")

    # Best-effort, same reasoning as the transcribe logging block above — the audio
    # is already generated, a logging failure must not discard it.
    db = get_session()
    try:
        db.add(TTSLog(user_id=user_id, input_text=text, voice=req.voice, model_id=resolved_model))
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()

    return Response(content=mp3_bytes, media_type="audio/mpeg")


app.mount("/", StaticFiles(directory="frontend-next/out", html=True), name="frontend")
