"""FastAPI application — routes, lifespan, middleware."""
from __future__ import annotations

import asyncio
import contextvars
import json
import logging
import os
import shutil
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from functools import partial
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

import traceback

import librosa
import diagnostics
import tts_engine
from lora_experts import LoRAExpertRouter
from asr_module import transcribe_audio_with_logits
from config import DB_PATH, TEMP_DIR, RAW_AUDIO_DIR, FRONTEND_DIR, AUTO_TRAIN_THRESHOLD, ASR_BACKEND
from database import (
    get_recent_sessions,
    get_remediation_status,
    get_session_by_id,
    log_transcription,
    update_remedial_path,
    get_vocabulary_terms,
    add_vocabulary_term,
    seed_vocabulary_if_empty,
    upsert_training_status,
    get_training_status,
)
from drift_detector import DriftDetector
from dataset_manager import DatasetManager
import httpx
from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from priority_queue import (
    EMERGENCY_VOCABULARY,
    MEDICAL_VOCABULARY,
    RemediationPriorityQueue,
)
from session_logger import SessionLogger
from auth import router as auth_router, get_current_user, AUTH_ENABLED, validate_startup_config, _limiter as _auth_limiter
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Import service container and dependency providers
from services import container, get_session_logger, get_drift_detector, get_priority_queue, get_dataset_manager, get_lora_router

# Rate limiter for expensive ML operations — stricter than auth limiter
_ml_limiter = Limiter(key_func=get_remote_address, default_limits=[])

_request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="-")


class _RequestIdFilter(logging.Filter):
    def filter(self, record):
        record.request_id = _request_id_var.get("-")
        return True


logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s  %(name)s  [%(request_id)s]  %(message)s",
)
logging.getLogger().addFilter(_RequestIdFilter())

# ── Constants ─────────────────────────────────────────────────
BACKEND_DIR    = Path(__file__).resolve().parent
PROJECT_DIR    = BACKEND_DIR.parent
DATA_AUDIO_DIR = BACKEND_DIR / "data" / "audio"
SESSION_ID     = str(uuid.uuid4())
ALLOWED_EXTENSIONS = {"wav", "mp3", "webm", "m4a", "ogg", "flac"}
MAX_AUDIO_BYTES    = int(os.environ.get("MAX_AUDIO_MB", "50")) * 1024 * 1024
AUDIO_RETENTION_DAYS = int(os.environ.get("AUDIO_RETENTION_DAYS", "30"))
_TEMP_RESOLVED     = Path(TEMP_DIR).resolve()

# ── Thread-safe counter ───────────────────────────────────────
_tx_lock  = asyncio.Lock()
_tx_count = 0

# ── Vocabulary cache ──────────────────────────────────────────
_vocab_cache: dict[str, frozenset] = {}
_vocab_cache_ttl: float = 0.0
_VOCAB_TTL_SECONDS = 300


# ── Lifespan ──────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure required directories exist
    for d in [DATA_AUDIO_DIR, Path(TEMP_DIR),
              BACKEND_DIR / "logs", BACKEND_DIR / "models" / "lora"]:
        d.mkdir(parents=True, exist_ok=True)

    validate_startup_config()

    # Initialize service container
    dataset_dir = str(PROJECT_DIR / "Dataset")
    container.initialize(dataset_dir)

    logger.info("Session %s started", SESSION_ID)
    _ = tts_engine.TTS_AVAILABLE
    _cleanup_old_audio()

    yield

    logger.info("Session %s ended", SESSION_ID)
    container.shutdown()


# ── App ───────────────────────────────────────────────────────
app = FastAPI(title="Mercury", version="2.0.0", lifespan=lifespan)
app.state.limiter = _auth_limiter
# Attach ML limiter for expensive routes
app.state.ml_limiter = _ml_limiter

# GZip — compresses all JSON responses > 1 KB (~60-80% smaller)
app.add_middleware(GZipMiddleware, minimum_size=1000)


@app.exception_handler(RateLimitExceeded)
async def _rate_limit_handler(request, exc):
    return JSONResponse({"error": "Too many requests"}, status_code=429)

@app.exception_handler(Exception)
async def _global_exception_handler(request, exc):
    logger.error("Unhandled exception on %s %s\n%s", request.method, request.url.path, traceback.format_exc())
    return JSONResponse({"error": "Internal server error", "code": "INTERNAL_ERROR"}, status_code=500)

# Auth routes
app.include_router(auth_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "http://localhost:3000,http://localhost:5000").split(","),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Accept", "X-Request-ID"],
)


@app.middleware("http")
async def _add_request_id(request, call_next):
    rid = request.headers.get("X-Request-ID") or uuid.uuid4().hex[:12]
    _request_id_var.set(rid)
    response = await call_next(request)
    response.headers["X-Request-ID"] = rid
    return response


@app.middleware("http")
async def _security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"]  = "nosniff"
    response.headers["X-Frame-Options"]         = "DENY"
    response.headers["Referrer-Policy"]         = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"]      = "microphone=(self)"
    ct = response.headers.get("content-type", "")
    if "text/html" in ct:
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "media-src 'self' blob:; "
            "connect-src 'self'"
        )
    return response

# ── Helpers ───────────────────────────────────────────────────
_executor = None  # uses default ThreadPoolExecutor

async def _run(fn, *args, **kwargs):
    """Run a blocking function in the thread pool — keeps event loop free."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(_executor, partial(fn, *args, **kwargs))


def _allowed(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def _safe_temp(name: str) -> Path:
    return Path(TEMP_DIR) / f"{uuid.uuid4()}_{Path(name).name}"


def _cache(seconds: int) -> dict:
    return {"Cache-Control": f"public, max-age={seconds}"}


def _get_vocab(domain: str) -> frozenset:
    import time as _time
    global _vocab_cache_ttl
    if _time.time() < _vocab_cache_ttl and domain in _vocab_cache:
        return _vocab_cache[domain]
    terms = frozenset(get_vocabulary_terms(domain))
    _vocab_cache[domain] = terms
    _vocab_cache_ttl = _time.time() + _VOCAB_TTL_SECONDS
    return terms


def _cleanup_old_audio() -> None:
    from database import get_recent_sessions as _sessions
    import time as _time
    cutoff = _time.time() - AUDIO_RETENTION_DAYS * 86400
    # Collect audio paths still referenced by pending queue items
    try:
        from database import _get_conn as _db_conn
        with _db_conn() as conn:
            rows = conn.execute(
                """SELECT t.audio_path FROM transcriptions t
                   JOIN priority_queue pq ON pq.transcription_id = t.id
                   WHERE pq.status = 'pending'"""
            ).fetchall()
        protected = {r["audio_path"] for r in rows if r["audio_path"]}
    except Exception:
        protected = set()

    removed = 0
    for f in DATA_AUDIO_DIR.iterdir():
        if not f.is_file():
            continue
        if str(f) in protected:
            continue
        try:
            if f.stat().st_mtime < cutoff:
                f.unlink()
                removed += 1
        except Exception:
            pass
    if removed:
        logger.info("Audio cleanup: removed %d files older than %d days", removed, AUDIO_RETENTION_DAYS)


# ── Background remediation ────────────────────────────────────
def _remediate(
    row_id: int,
    text: str,
    error_type: str,
    queue_id: Optional[int],
    priority_queue: RemediationPriorityQueue,
    session_logger: SessionLogger,
) -> None:
    try:
        out = DATA_AUDIO_DIR / f"remedial_{uuid.uuid4().hex}_{row_id}.wav"
        tts_engine.synthesize(text, str(out))
        update_remedial_path(row_id, str(out))
        if queue_id is not None:
            priority_queue.mark_completed(queue_id)
        logger.info("Remediation done: row %d → %s", row_id, out.name)
        session_logger.log("REMEDIATE", f"row={row_id} status=ok")
    except Exception as exc:
        logger.error("Remediation failed: row %d: %s", row_id, exc)
        session_logger.log("REMEDIATE_FAIL", f"row={row_id} err={type(exc).__name__}")


# ── Models ────────────────────────────────────────────────────
class SynthesisRequest(BaseModel):
    text: str = ""

class FetchDriveRequest(BaseModel):
    url: str

class HealthResponse(BaseModel):
    status: str
    asr: str
    tts: str
    session_id: str

class TranscriptionResponse(BaseModel):
    transcription: str
    duration: float
    status: str
    confidence: float
    nonconformity_score: float
    uncertain_frames: int
    total_frames: int
    error_type: str
    noise_type: str
    snr_db: float
    cer_score: Optional[float]
    wer_score: Optional[float]
    per_score: Optional[float]
    diagnostic_basis: str
    phoneme_errors: list

class RemediationStatusResponse(BaseModel):
    total_transcriptions: int
    clean: int
    remediated: int
    pending_remediation: int
    remediation_rate: float


# ══════════════════════════════════════════════════════════════
# ROUTES
# ══════════════════════════════════════════════════════════════

@app.get("/health", response_model=HealthResponse)
async def health():
    import asr_module as _asr
    asr_label = getattr(_asr, "ASR_MODEL_PATH", ASR_BACKEND)
    tts_label = getattr(tts_engine, "TTS_MODEL_PATH", "unknown")
    return {"status": "healthy", "asr": asr_label, "tts": tts_label, "session_id": SESSION_ID}


@app.get("/tts_status")
async def tts_status():
    return {"available": tts_engine.TTS_AVAILABLE, "model": tts_engine.TTS_MODEL_PATH}


@app.get("/model_info")
async def model_info():
    """Report the currently active ASR and TTS models with their configuration."""
    import asr_module as _asr
    asr_info = _asr.get_model_info() if hasattr(_asr, "get_model_info") else {"backend": ASR_BACKEND}
    tts_info = {
        "model":     getattr(tts_engine, "TTS_MODEL_PATH", "unknown"),
        "available": getattr(tts_engine, "TTS_AVAILABLE", False),
    }
    return {"asr": asr_info, "tts": tts_info, "session_id": SESSION_ID}


@app.post("/transcribe_compare")
@app.state.ml_limiter.limit("10/minute")  # Runs two ASR models
async def transcribe_compare(
    request: Request,
    audio: Optional[UploadFile] = File(default=None),
):
    """
    Run the same audio through both ASR backends and return a side-by-side comparison.
    Useful for evaluating Whisper vs. Wav2Vec2 on domain-specific speech.
    """
    if audio is None:
        return JSONResponse({"error": "No audio part"}, status_code=400)
    if not audio.filename or not _allowed(audio.filename):
        return JSONResponse({"error": "Unsupported format"}, status_code=400)

    filepath = _safe_temp(audio.filename)
    try:
        data = await audio.read()
        if len(data) > MAX_AUDIO_BYTES:
            return JSONResponse({"error": "File too large"}, status_code=413)
        filepath.write_bytes(data)

        results: dict = {}
        import asr_module as _asr
        for backend in ("whisper", "wav2vec2"):
            try:
                if backend == "whisper":
                    fn = _asr._transcribe_whisper
                else:
                    fn = _asr._transcribe_wav2vec2

                text, dur, logits, audio_arr = await _run(fn, str(filepath))
                conf = diagnostics.extract_confidence(logits)
                noise = await _run(diagnostics.classify_noise_profile, audio_arr)
                results[backend] = {
                    "transcription": text,
                    "duration":      dur,
                    "confidence":    conf,
                    "noise_type":    noise.get("noise_type", "unknown"),
                }
            except Exception as exc:
                results[backend] = {"error": str(exc)}

        return results
    finally:
        filepath.unlink(missing_ok=True)


# ── Transcribe ────────────────────────────────────────────────
@app.post("/transcribe", response_model=TranscriptionResponse)
@app.state.ml_limiter.limit("20/minute")  # ~1 request per 3 seconds for ASR
async def transcribe(
    request: Request,
    background_tasks: BackgroundTasks,
    audio: Optional[UploadFile]  = File(default=None),
    reference_transcript: Optional[str] = Form(default=None),
    session_id: Optional[str]    = Form(default=None),
    drift_detector: DriftDetector = Depends(get_drift_detector),
    priority_queue: RemediationPriorityQueue = Depends(get_priority_queue),
    session_logger: SessionLogger = Depends(get_session_logger),
):
    global _tx_count
    if audio is None:
        return JSONResponse({"error": "No audio part"}, status_code=400)
    if not audio.filename:
        return JSONResponse({"error": "No filename"}, status_code=400)
    if not _allowed(audio.filename):
        return JSONResponse({"error": "Unsupported format"}, status_code=400)

    filepath = _safe_temp(audio.filename)
    try:
        data = await audio.read()
        if len(data) > MAX_AUDIO_BYTES:
            return JSONResponse({"error": f"File too large (max {MAX_AUDIO_BYTES//1048576} MB)"}, status_code=413)
        filepath.write_bytes(data)

        ref        = (reference_transcript or "").strip() or None
        active_sid = (session_id or "").strip() or SESSION_ID

        # ── All heavy work in thread pool (non-blocking) ──────
        transcription, duration, logits, audio_arr = await _run(
            transcribe_audio_with_logits, str(filepath)
        )
        noise_profile = await _run(diagnostics.classify_noise_profile, audio_arr)
        snr_db        = await _run(diagnostics.estimate_snr, audio_arr)

        confidence  = diagnostics.extract_confidence(logits)
        token_unc   = diagnostics.extract_token_uncertainty(logits)
        ncs         = diagnostics.nonconformity_score(confidence)

        cer_score   = diagnostics.calculate_cer(ref, transcription)
        wer_score   = diagnostics.calculate_wer(ref, transcription)
        per_score   = diagnostics.phoneme_error_rate(ref, transcription)
        error_type  = diagnostics.classify_error_type(cer_score, noise_profile, confidence, snr_db)

        # ── Persist ───────────────────────────────────────────
        perm_path = DATA_AUDIO_DIR / f"{uuid.uuid4().hex}_{Path(audio.filename).name}"
        shutil.copy2(filepath, perm_path)

        import asr_module as _asr_mod
        _model_used = getattr(_asr_mod, "ASR_MODEL_PATH", ASR_BACKEND)
        row_id = await _run(
            log_transcription,
            active_sid, Path(audio.filename).name, str(perm_path),
            transcription, duration, _model_used, ref,
            cer_score=cer_score,
            wer_score=wer_score,
            per_score=per_score,
            error_type=error_type,
            confidence_score=confidence,
            snr_db=snr_db,
            noise_profile=json.dumps(noise_profile),
            nonconformity_score=ncs,
        )

        # ── Phoneme tracking (in thread pool) ─────────────────
        phonemes = diagnostics.extract_phonemes(transcription)
        await _run(drift_detector.record_phoneme_confidence, active_sid, phonemes, confidence)

        phoneme_alignment = None
        if ref:
            phoneme_alignment = await _run(diagnostics.align_phoneme_errors, ref, transcription)
            await _run(drift_detector.record_phoneme_errors, active_sid, row_id, phoneme_alignment, confidence)

        if drift_detector.should_trigger_retraining():
            drift_detector.log_drift_event()
            logger.warning("Drift threshold exceeded — session %s", active_sid)
            session_logger.log("DRIFT_ALERT", f"session={active_sid}")
            if AUTO_TRAIN_THRESHOLD > 0:
                sample_count = await _run(_count_remedial_samples)
                if sample_count >= AUTO_TRAIN_THRESHOLD:
                    logger.info("Auto-triggering LoRA training (%d samples available)", sample_count)
                    background_tasks.add_task(_auto_train)
                    session_logger.log("AUTO_TRAIN_QUEUED", f"samples={sample_count}")

        queue_id = None
        if error_type != "clean":
            queue_id = await _run(priority_queue.enqueue, row_id, transcription, error_type, confidence)
            background_tasks.add_task(
                _remediate,
                row_id,
                ref or transcription,
                error_type,
                queue_id,
                priority_queue,
                session_logger,
            )

        session_logger.log("TRANSCRIBE", f"row={row_id} conf={confidence:.3f} type={error_type}")

        async with _tx_lock:
            _tx_count += 1
            if _tx_count % 50 == 0:
                background_tasks.add_task(_cleanup_old_audio)

        uncertain_frames = sum(1 for h in token_unc if h > 0.5)

        return {
            "transcription":       transcription,
            "duration":            duration,
            "status":              "success",
            "confidence":          confidence,
            "nonconformity_score": ncs,
            "uncertain_frames":    uncertain_frames,
            "total_frames":        len(token_unc),
            "error_type":          error_type,
            "noise_type":          noise_profile.get("noise_type", "clean"),
            "snr_db":              snr_db,
            "cer_score":           cer_score,
            "wer_score":           wer_score,
            "per_score":           per_score,
            "diagnostic_basis":    "reference_aligned" if ref else "confidence_noise_estimate",
            "phoneme_errors":      phoneme_alignment.get("errors", []) if phoneme_alignment else [],
        }

    except Exception:
        logger.exception("Transcription error")
        raise
    finally:
        filepath.unlink(missing_ok=True)


# ── TTS ───────────────────────────────────────────────────────
@app.post("/synthesize")
@app.state.ml_limiter.limit("30/minute")  # TTS synthesis
async def synthesize_route(request: Request, payload: SynthesisRequest):
    tts_engine.load_tts()
    if not tts_engine.TTS_AVAILABLE:
        return JSONResponse({"error": "TTS not available"}, status_code=503)
    text = (payload.text or "").strip()
    if not text:
        return JSONResponse({"error": "No text"}, status_code=400)
    if len(text) > 2000:
        return JSONResponse({"error": "Text too long (max 2000 chars)"}, status_code=400)
    try:
        ts   = datetime.now().strftime("%Y%m%dT%H%M%S%f")
        path = DATA_AUDIO_DIR / f"tts_{ts}.wav"
        fp, _ = await _run(tts_engine.synthesize, text, str(path))
        return FileResponse(fp, media_type="audio/wav", filename=Path(fp).name)
    except Exception:
        logger.exception("Synthesis error")
        raise


# ── Sessions ──────────────────────────────────────────────────
@app.get("/sessions")
async def get_sessions(limit: int = 100):
    rows = await _run(get_recent_sessions, min(limit, 500))
    return rows

@app.get("/sessions/{session_id}")
async def get_session_detail(session_id: int):
    row = await _run(get_session_by_id, session_id)
    if row is None:
        return JSONResponse({"error": "Session not found"}, status_code=404)
    return row

@app.get("/history")
async def get_history(limit: int = 100):
    return await get_sessions(limit=limit)


# ── Analytics (cached — data changes slowly) ──────────────────
@app.get("/remediation_status", response_model=RemediationStatusResponse)
async def remediation_status():
    data = await _run(get_remediation_status)
    return JSONResponse(data, headers=_cache(10))

@app.get("/drift_report")
async def drift_report(drift_detector: DriftDetector = Depends(get_drift_detector)):
    data = await _run(drift_detector.get_drift_report)
    return JSONResponse(data, headers=_cache(15))

@app.get("/confidence_histogram")
async def confidence_histogram(bins: int = 20, drift_detector: DriftDetector = Depends(get_drift_detector)):
    data = await _run(drift_detector.get_confidence_histogram, max(5, min(bins, 50)))
    return JSONResponse(data, headers=_cache(20))

@app.get("/phoneme_error_report")
async def phoneme_error_report(drift_detector: DriftDetector = Depends(get_drift_detector)):
    data = await _run(drift_detector.get_error_report)
    return JSONResponse(data, headers=_cache(20))

@app.get("/calibration_metrics")
async def calibration_metrics(drift_detector: DriftDetector = Depends(get_drift_detector)):
    data = await _run(drift_detector.get_calibration_metrics)
    return JSONResponse(data, headers=_cache(30))

@app.get("/noise_report")
async def noise_report():
    # Single DB call, aggregation in Python — still in thread pool
    data = await _run(_build_noise_report)
    return JSONResponse(data, headers=_cache(15))

def _build_noise_report() -> dict:
    sessions  = get_recent_sessions(limit=200)
    breakdown = {"clean": 0, "traffic": 0, "crowd": 0, "machinery": 0, "indoor": 0}
    rms_vals, cent_vals = [], []
    for s in sessions:
        raw = s.get("noise_profile")
        if not raw:
            continue
        try:
            p = json.loads(raw) if isinstance(raw, str) else raw
        except Exception:
            continue
        if not isinstance(p, dict):
            continue
        nt = str(p.get("noise_type", "indoor")).lower()
        breakdown[nt if nt in breakdown else "indoor"] += 1
        if isinstance(p.get("rms_energy"), (int, float)):
            rms_vals.append(float(p["rms_energy"]))
        if isinstance(p.get("spectral_centroid"), (int, float)):
            cent_vals.append(float(p["spectral_centroid"]))
    total = sum(breakdown.values())
    return {
        "total_analyzed":        total,
        "breakdown":             breakdown,
        "most_common":           max(breakdown, key=breakdown.get) if total else "unknown",
        "avg_rms_energy":        round(sum(rms_vals) / len(rms_vals), 6) if rms_vals else 0.0,
        "avg_spectral_centroid": round(sum(cent_vals) / len(cent_vals), 4) if cent_vals else 0.0,
    }


# ── Queue ─────────────────────────────────────────────────────
@app.get("/priority_queue")
async def priority_queue_report(
    priority_queue: RemediationPriorityQueue = Depends(get_priority_queue),
):
    q, s = await asyncio.gather(
        _run(priority_queue.get_queue, 50),
        _run(priority_queue.get_stats),
    )
    return JSONResponse({"queue": q, "stats": s}, headers=_cache(5))

@app.get("/vocabulary_check")
async def vocabulary_check(text: str = ""):
    words = {c for token in str(text or "").lower().split()
             if (c := "".join(ch for ch in token if ch.isalpha()))}
    medical_terms   = await _run(_get_vocab, "medical")
    emergency_terms = await _run(_get_vocab, "emergency")
    return {
        "medical_matches":    sorted(words & medical_terms),
        "emergency_matches":  sorted(words & emergency_terms),
        "is_domain_critical": bool(words & (medical_terms | emergency_terms)),
    }


class VocabularyAddRequest(BaseModel):
    domain: str
    term:   str

@app.get("/vocabulary")
async def get_vocabulary(domain: str = "medical"):
    terms = await _run(get_vocabulary_terms, domain)
    return {"domain": domain, "terms": terms}

@app.post("/vocabulary", status_code=201)
async def add_vocabulary(payload: VocabularyAddRequest):
    global _vocab_cache_ttl
    domain = payload.domain.strip().lower()
    term   = payload.term.strip().lower()
    if not domain or not term:
        raise HTTPException(400, "domain and term are required")
    await _run(add_vocabulary_term, domain, term)
    _vocab_cache_ttl = 0.0  # invalidate cache
    return {"domain": domain, "term": term}


# ── Dataset / LoRA ────────────────────────────────────────────
@app.get("/dataset_stats")
async def dataset_stats(dataset_manager: DatasetManager = Depends(get_dataset_manager)):
    data = await _run(dataset_manager.get_stats)
    return JSONResponse(data, headers=_cache(60))

@app.get("/lora_status")
async def lora_status():
    data = await _run(_get_lora_status)
    return JSONResponse(data, headers=_cache(30))

def _get_lora_status() -> dict:
    lora_dir   = BACKEND_DIR / "models" / "lora"
    lora_dir.mkdir(parents=True, exist_ok=True)
    epoch_dirs = sorted(p for p in lora_dir.glob("epoch_*") if p.is_dir())
    logs       = sorted(p.name for p in lora_dir.glob("training_log_*.json") if p.is_file())
    last_trained = None
    if logs:
        data = json.loads((lora_dir / logs[-1]).read_text())
        last_trained = data.get("trained_at") or \
            datetime.fromtimestamp((lora_dir / logs[-1]).stat().st_mtime).isoformat()
    return {"adapter_exists": bool(epoch_dirs), "last_trained": last_trained, "training_logs": logs}

@app.get("/lora_experts_status")
async def lora_experts_status(lora_router: LoRAExpertRouter = Depends(get_lora_router)):
    data = await _run(lora_router.get_adapter_status)
    return JSONResponse(data, headers=_cache(30))


# ── Training status & trigger ─────────────────────────────────
@app.get("/training_status")
async def training_status():
    return await _run(get_training_status)


class TrainRequest(BaseModel):
    error_type: Optional[str] = None
    epochs:     int = 3

@app.post("/train", status_code=202)
@app.state.ml_limiter.limit("5/minute")  # Expensive training jobs
async def trigger_training(request: Request, payload: TrainRequest, background_tasks: BackgroundTasks):
    status = await _run(get_training_status)
    if status["state"] == "running":
        raise HTTPException(409, "A training job is already running")
    background_tasks.add_task(_run_training, payload.error_type, payload.epochs)
    return {"message": "Training started", "error_type": payload.error_type, "epochs": payload.epochs}


def _count_remedial_samples() -> int:
    """Return number of transcriptions with a remedial audio path (for auto-train gating)."""
    try:
        from database import _get_conn as _db_conn
        with _db_conn() as conn:
            row = conn.execute(
                "SELECT COUNT(*) AS n FROM transcriptions "
                "WHERE remedial_audio_path IS NOT NULL AND TRIM(remedial_audio_path) != ''"
            ).fetchone()
            return int(row["n"]) if row else 0
    except Exception:
        return 0


def _auto_train() -> None:
    """Background task: run LoRA fine-tuning triggered by phoneme drift detection."""
    try:
        run_id = upsert_training_status("running", 0, "Auto-triggered by drift detection")

        if ASR_BACKEND == "whisper":
            from lora_trainer import WhisperLoRATrainer
            trainer = WhisperLoRATrainer(db_path=DB_PATH)
        else:
            from lora_trainer import LoRATrainer
            trainer = LoRATrainer(db_path=DB_PATH)

        samples = trainer.load_remedial_samples()
        n = len(samples)
        if n < 5:
            upsert_training_status("idle", 0, f"Auto-train: not enough samples ({n} < 5). Skipped.", run_id=run_id)
            return

        upsert_training_status("running", 5, f"Auto-train: loaded {n} samples", run_id=run_id)

        def _on_epoch(epoch: int, total: int, loss: float) -> None:
            pct = 5 + int(85 * epoch / total)
            upsert_training_status("running", pct, f"Auto-train epoch {epoch}/{total} loss={loss:.4f}", run_id=run_id)

        trainer.train(epochs=3, on_epoch=_on_epoch)
        upsert_training_status("idle", 100, "Auto-training complete.", run_id=run_id)
        logger.info("Auto-training completed successfully (%d samples, backend=%s)", n, ASR_BACKEND)
    except Exception:
        logger.exception("Auto-training failed")
        try:
            upsert_training_status("error", 0, "Auto-training failed — check server logs.")
        except Exception:
            pass


def _run_training(error_type: Optional[str], epochs: int) -> None:
    if ASR_BACKEND == "whisper":
        from lora_trainer import WhisperLoRATrainer as _TrainerCls
    else:
        from lora_trainer import LoRATrainer as _TrainerCls  # type: ignore[assignment]

    run_id = upsert_training_status("running", 0, "Initialising…")
    try:
        trainer = _TrainerCls(db_path=DB_PATH)
        samples = trainer.load_remedial_samples(error_type=error_type)
        n = len(samples)
        if n < 5:
            upsert_training_status("idle", 0, f"Not enough samples ({n} < 5). Skipped.", run_id=run_id)
            return

        upsert_training_status("running", 5, f"Loaded {n} samples. Training for {epochs} epoch(s)…", run_id=run_id)

        def _on_epoch(epoch: int, total: int, loss: float):
            pct = 5 + int(85 * epoch / total)
            upsert_training_status(
                "running", pct,
                f"Epoch {epoch}/{total} — loss {loss:.4f}",
                run_id=run_id,
            )

        trainer.train(epochs=epochs, error_type=error_type, on_epoch=_on_epoch)

        upsert_training_status("idle", 100, "Training complete.", run_id=run_id)
        logger.info("Training job finished (error_type=%s, epochs=%d)", error_type, epochs)
    except Exception:
        logger.exception("Training job failed")
        upsert_training_status("error", 0, "Training failed — check server logs.", run_id=run_id)


# ── File serving ──────────────────────────────────────────────
@app.get("/temp/{filename:path}")
def serve_temp(filename: str):
    safe = (Path(TEMP_DIR) / filename).resolve()
    if not str(safe).startswith(str(_TEMP_RESOLVED)):
        raise HTTPException(403, "Access denied")
    if not safe.is_file():
        raise HTTPException(404, "Not found")
    return FileResponse(str(safe))


# ── Google Drive fetch ────────────────────────────────────────
_DRIVE_HOSTS     = {"drive.google.com", "docs.google.com"}
_DRIVE_MAX_BYTES = int(os.environ.get("DRIVE_MAX_MB", "50")) * 1024 * 1024

@app.post("/fetch_drive")
@app.state.ml_limiter.limit("10/minute")  # External fetch + potential large downloads
async def fetch_drive(request: Request, payload: FetchDriveRequest):
    url    = (payload.url or "").strip()
    parsed = urlparse(url)
    if parsed.netloc not in _DRIVE_HOSTS:
        raise HTTPException(400, "URL must be a Google Drive or Docs link")
    async with httpx.AsyncClient(follow_redirects=True, timeout=30) as client:
        head = await client.head(url)
        cl   = head.headers.get("content-length")
        if cl and int(cl) > _DRIVE_MAX_BYTES:
            raise HTTPException(413, "File too large")
        res  = await client.get(url)
        if res.status_code != 200:
            raise HTTPException(502, f"Upstream {res.status_code}")
        if len(res.content) > _DRIVE_MAX_BYTES:
            raise HTTPException(413, "File too large")
    ct = res.headers.get("content-type", "audio/mpeg")
    return Response(content=res.content, media_type=ct)


# ── Dataset download + base training ──────────────────────────

class DatasetRequest(BaseModel):
    dataset: str

class BaseTrainRequest(BaseModel):
    dataset:     str  = "librispeech-dev-clean"
    epochs:      int  = 3
    max_samples: int  = 2000


@app.get("/available_datasets")
async def available_datasets():
    from dataset_downloader import get_available_datasets
    return get_available_datasets()


@app.get("/download_status")
async def download_status():
    from dataset_downloader import get_status
    return get_status()


@app.post("/download_dataset", status_code=202)
@app.state.ml_limiter.limit("5/minute")  # Large downloads
async def download_dataset_endpoint(request: Request, payload: DatasetRequest, background_tasks: BackgroundTasks):
    from dataset_downloader import get_status, DATASETS
    if payload.dataset not in DATASETS:
        raise HTTPException(400, f"Unknown dataset '{payload.dataset}'")
    status = get_status()
    if status["state"] in ("downloading", "extracting", "generating"):
        raise HTTPException(409, "A download is already in progress")
    from dataset_downloader import download as _dl
    background_tasks.add_task(_dl, payload.dataset)
    return {"ok": True, "dataset": payload.dataset}


@app.get("/base_training_status")
async def base_training_status_endpoint():
    from base_trainer import get_base_training_status
    return get_base_training_status()


@app.post("/train_base_model", status_code=202)
@app.state.ml_limiter.limit("2/minute")  # Very expensive base model training
async def train_base_model_endpoint(request: Request, payload: BaseTrainRequest, background_tasks: BackgroundTasks):
    from base_trainer import get_base_training_status, run_base_training
    status = get_base_training_status()
    if status["state"] == "running":
        raise HTTPException(409, "Base training already in progress")
    background_tasks.add_task(
        run_base_training,
        payload.dataset,
        payload.epochs,
        payload.max_samples,
    )
    return {"ok": True, "dataset": payload.dataset, "epochs": payload.epochs}


@app.post("/reload_asr_model")
async def reload_asr_model():
    """Reload ASR model path after training completes."""
    import asr_module
    new_path = asr_module.reload_asr_model_path()
    return {"ok": True, "asr_model_path": new_path}


# ── Static files ──────────────────────────────────────────────
_react_build = PROJECT_DIR / "frontend-react" / "build"
_vanilla     = Path(FRONTEND_DIR)

if _react_build.is_dir():
    app.mount("/", StaticFiles(directory=str(_react_build), html=True), name="react")
elif _vanilla.is_dir():
    app.mount("/", StaticFiles(directory=str(_vanilla), html=True), name="frontend")
