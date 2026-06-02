"""
app.py — ADAPT-Synthetix FastAPI application.

Critical fixes applied (see audit report):
  • /history was calling await on non-coroutine — fixed
  • Path traversal in /temp/{filename} — fixed with resolve() guard
  • Google Drive URL validated with urlparse (not substring)
  • TRANSCRIPTION_COUNT replaced with thread-safe asyncio.Lock counter
  • Temp files deleted in finally block after transcription
  • CORS allow_credentials + allow_origins=* removed (spec violation)
  • Filename sanitised with Path(name).name before use
  • remediate_async marks queue completed only on success
  • LoRAExpertRouter instance cached at startup
  • React build mount fallback corrected

Research improvements applied:
  • WER + PER computed alongside CER (Bérard POWER 2019)
  • SNR estimation used in classify_error_type (arXiv:2509.07195)
  • Nonconformity score stored (Ernez et al. PMLR 2023)
  • /calibration_metrics endpoint added
  • Token-level uncertainty exposed in /transcribe response
"""
from __future__ import annotations

import asyncio
import json
import os
import shutil
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

import librosa
import diagnostics
import tts_engine
from lora_experts import LoRAExpertRouter
from asr_module import transcribe_audio_with_logits
from config import DB_PATH, TEMP_DIR, RAW_AUDIO_DIR, FRONTEND_DIR
from database import (
    get_recent_sessions,
    get_remediation_status,
    log_transcription,
    update_diagnostics,
    update_remedial_path,
)
from drift_detector import DriftDetector
from dataset_manager import DatasetManager
import httpx
from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from priority_queue import (
    EMERGENCY_VOCABULARY,
    MEDICAL_VOCABULARY,
    RemediationPriorityQueue,
)
from session_logger import SessionLogger

# ── Constants ─────────────────────────────────────────────────
BACKEND_DIR   = Path(__file__).resolve().parent
PROJECT_DIR   = BACKEND_DIR.parent
DATA_AUDIO_DIR = BACKEND_DIR / "data" / "audio"
SESSION_ID    = str(uuid.uuid4())

ALLOWED_EXTENSIONS = {"wav", "mp3", "webm", "m4a", "ogg", "flac"}
MAX_AUDIO_BYTES    = int(os.environ.get("MAX_AUDIO_MB", "50")) * 1024 * 1024

# ── Thread-safe counter ───────────────────────────────────────
_tx_lock  = asyncio.Lock()
_tx_count = 0

# ── Singletons (initialised in lifespan) ─────────────────────
session_logger : SessionLogger
drift_detector : DriftDetector
priority_queue : RemediationPriorityQueue
dataset_manager: DatasetManager
lora_router    : LoRAExpertRouter


# ── Lifespan ──────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    global session_logger, drift_detector, priority_queue, dataset_manager, lora_router

    # Ensure directories exist
    for d in [DATA_AUDIO_DIR, Path(TEMP_DIR), BACKEND_DIR / "logs", BACKEND_DIR / "models" / "lora"]:
        d.mkdir(parents=True, exist_ok=True)

    session_logger  = SessionLogger()
    drift_detector  = DriftDetector(DB_PATH)
    priority_queue  = RemediationPriorityQueue(DB_PATH)
    dataset_manager = DatasetManager(dataset_dir=str(PROJECT_DIR / "Dataset"))
    lora_router     = LoRAExpertRouter(db_path=DB_PATH)

    session_logger.log("STARTUP", f"Session {SESSION_ID}")
    _ = tts_engine.TTS_AVAILABLE  # warm up flag

    yield  # ← app runs here

    session_logger.log("SHUTDOWN", f"Session {SESSION_ID} ended")
    session_logger.close()


# ── App ───────────────────────────────────────────────────────
app = FastAPI(title="ADAPT-Synthetix", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=False,   # Must be False when origins are not explicit in production
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helpers ───────────────────────────────────────────────────
def _allowed(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def _safe_temp_path(filename: str) -> Path:
    """Return an absolute path safely inside TEMP_DIR."""
    name = Path(filename).name  # strip any directory components
    return Path(TEMP_DIR) / f"{uuid.uuid4()}_{name}"


# ── Background remediation ────────────────────────────────────
def remediate_async(row_id: int, text: str, error_type: str, queue_id: Optional[int]) -> None:
    try:
        ts      = datetime.now().strftime("%Y%m%dT%H%M%S%f")
        out     = DATA_AUDIO_DIR / f"remedial_{ts}_{row_id}.wav"
        tts_engine.synthesize(text, str(out))
        update_remedial_path(row_id, str(out))
        if queue_id is not None:
            priority_queue.mark_completed(queue_id)
        print(f"[REMEDIATION] row {row_id} → {out.name}")
    except Exception as exc:
        print(f"[REMEDIATION][ERROR] row {row_id}: {exc}")
        # Do NOT mark completed — item remains in queue for retry


# ── Models ────────────────────────────────────────────────────
class SynthesisRequest(BaseModel):
    text: str = ""

class FetchDriveRequest(BaseModel):
    url: str


# ── Routes ────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status":     "healthy",
        "asr":        "wav2vec2-base-960h",
        "tts":        "suno/bark-small",
        "session_id": SESSION_ID,
    }


@app.get("/tts_status")
async def tts_status():
    return {"available": tts_engine.TTS_AVAILABLE, "model": tts_engine.TTS_MODEL_PATH}


# ── Transcribe ────────────────────────────────────────────────

@app.post("/transcribe")
async def transcribe(
    background_tasks: BackgroundTasks,
    audio: Optional[UploadFile]  = File(default=None),
    reference_transcript: Optional[str] = Form(default=None),
    session_id: Optional[str]    = Form(default=None),
):
    global _tx_count
    session_logger.log("API_REQUEST", "/transcribe")

    if audio is None:
        return JSONResponse({"error": "No audio part"}, status_code=400)
    if not audio.filename:
        return JSONResponse({"error": "No filename"}, status_code=400)
    if not _allowed(audio.filename):
        return JSONResponse({"error": "Unsupported file format"}, status_code=400)

    filepath = _safe_temp_path(audio.filename)
    try:
        data = await audio.read()
        if len(data) > MAX_AUDIO_BYTES:
            return JSONResponse({"error": f"File exceeds {MAX_AUDIO_BYTES // (1024*1024)} MB limit"}, status_code=413)
        filepath.write_bytes(data)

        transcription, duration, logits, audio_input = transcribe_audio_with_logits(str(filepath))
        active_sid = (session_id or "").strip() or SESSION_ID
        ref        = (reference_transcript or "").strip() or None

        # ── Audio features ─────────────────────────────────
        audio_dur      = librosa.get_duration(y=audio_input, sr=16000)
        noise_profile  = diagnostics.classify_noise_profile(audio_input)
        snr_db         = diagnostics.estimate_snr(audio_input)
        confidence     = diagnostics.extract_confidence(logits)
        token_unc      = diagnostics.extract_token_uncertainty(logits)
        ncs            = diagnostics.nonconformity_score(confidence)

        # ── Error metrics ──────────────────────────────────
        cer_score = diagnostics.calculate_cer(ref, transcription)
        wer_score = diagnostics.calculate_wer(ref, transcription)
        per_score = diagnostics.phoneme_error_rate(ref, transcription)
        error_type = diagnostics.classify_error_type(cer_score, noise_profile, confidence, snr_db)

        # ── Persist transcription ──────────────────────────
        ts = datetime.now().isoformat()
        perm_path = DATA_AUDIO_DIR / f"{ts.replace(':', '-')}_{filepath.name}"
        shutil.copy2(filepath, perm_path)

        row_id = log_transcription(
            session_id=active_sid,
            audio_filename=Path(audio.filename).name,
            audio_path=str(perm_path),
            transcription=transcription,
            duration=audio_dur,
            model="wav2vec2-base-960h",
            reference_transcript=ref,
        )
        update_diagnostics(
            row_id=row_id,
            cer_score=cer_score,
            wer_score=wer_score,
            per_score=per_score,
            error_type=error_type,
            confidence_score=confidence,
            snr_db=snr_db,
            noise_profile=json.dumps(noise_profile),
            nonconformity_score=ncs,
        )

        # ── Phoneme tracking ───────────────────────────────
        phonemes = diagnostics.extract_phonemes(transcription)
        drift_detector.record_phoneme_confidence(active_sid, phonemes, confidence)
        phoneme_alignment = None
        if ref:
            phoneme_alignment = diagnostics.align_phoneme_errors(ref, transcription)
            drift_detector.record_phoneme_errors(active_sid, row_id, phoneme_alignment, confidence)

        if drift_detector.should_trigger_retraining():
            drift_detector.log_drift_event()
            print(f"[DRIFT ALERT] Retraining threshold reached — session {active_sid}")

        # ── Priority queue + remediation ───────────────────
        queue_id = None
        if error_type != "clean":
            queue_id = priority_queue.enqueue(row_id, transcription, error_type, confidence)
            background_tasks.add_task(remediate_async, row_id, ref or transcription, error_type, queue_id)

        # ── Counter ─────────────────────────────────────────
        async with _tx_lock:
            _tx_count += 1

        session_logger.log("TRANSCRIPTION", f"{transcription[:60]}…  conf={confidence}")

        uncertain_frame_count = sum(1 for h in token_unc if h > 0.5)

        return {
            "transcription":          transcription,
            "duration":               duration,
            "status":                 "success",
            "confidence":             confidence,
            "nonconformity_score":    ncs,
            "uncertain_frames":       uncertain_frame_count,
            "total_frames":           len(token_unc),
            "error_type":             error_type,
            "noise_type":             noise_profile.get("noise_type", "clean"),
            "snr_db":                 snr_db,
            "cer_score":              cer_score,
            "wer_score":              wer_score,
            "per_score":              per_score,
            "diagnostic_basis":       "reference_aligned" if ref else "confidence_noise_estimate",
            "phoneme_errors":         phoneme_alignment.get("errors", []) if phoneme_alignment else [],
        }

    except Exception as exc:
        session_logger.log("TRANSCRIPTION_ERROR", str(exc))
        return JSONResponse({"error": str(exc)}, status_code=500)
    finally:
        # Always clean up temp file
        try:
            filepath.unlink(missing_ok=True)
        except Exception:
            pass


# ── TTS ───────────────────────────────────────────────────────

@app.post("/synthesize")
async def synthesize_route(payload: SynthesisRequest):
    session_logger.log("API_REQUEST", "/synthesize")
    tts_engine.load_tts()
    if not tts_engine.TTS_AVAILABLE:
        return JSONResponse({"error": "TTS model not available"}, status_code=503)
    text = (payload.text or "").strip()
    if not text:
        return JSONResponse({"error": "No text provided"}, status_code=400)
    if len(text) > 2000:
        return JSONResponse({"error": "Text too long (max 2000 chars)"}, status_code=400)
    try:
        ts   = datetime.now().strftime("%Y%m%dT%H%M%S%f")
        path = DATA_AUDIO_DIR / f"tts_{ts}.wav"
        fp, dur = tts_engine.synthesize(text, str(path))
        session_logger.log("SYNTHESIS", f"{ts} — {dur:.2f}s")
        return FileResponse(fp, media_type="audio/wav", filename=path.name)
    except Exception as exc:
        session_logger.log("SYNTHESIS_ERROR", str(exc))
        return JSONResponse({"error": str(exc)}, status_code=500)


# ── History / Sessions ────────────────────────────────────────

@app.get("/sessions")
def get_sessions(limit: int = 100):
    try:
        return get_recent_sessions(limit=min(limit, 500))
    except Exception as exc:
        return JSONResponse({"error": str(exc)}, status_code=500)

@app.get("/history")
def get_history(limit: int = 100):  # sync — no await needed
    return get_sessions(limit=limit)


# ── Analytics endpoints ───────────────────────────────────────

@app.get("/remediation_status")
def remediation_status():
    try:   return get_remediation_status()
    except Exception as exc: return JSONResponse({"error": str(exc)}, status_code=500)

@app.get("/drift_report")
def drift_report():
    try:   return drift_detector.get_drift_report()
    except Exception as exc: return JSONResponse({"error": str(exc)}, status_code=500)

@app.get("/confidence_histogram")
def confidence_histogram(bins: int = 20):
    try:   return drift_detector.get_confidence_histogram(bins=max(5, min(bins, 50)))
    except Exception as exc: return JSONResponse({"error": str(exc)}, status_code=500)

@app.get("/phoneme_error_report")
def phoneme_error_report():
    try:   return drift_detector.get_error_report()
    except Exception as exc: return JSONResponse({"error": str(exc)}, status_code=500)

@app.get("/calibration_metrics")
def calibration_metrics():
    """ECE + overconfidence ratio (Guo et al. 2017)."""
    try:   return drift_detector.get_calibration_metrics()
    except Exception as exc: return JSONResponse({"error": str(exc)}, status_code=500)

@app.get("/noise_report")
def noise_report():
    try:
        sessions = get_recent_sessions(limit=200)
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
            if isinstance(p.get("rms_energy"), (int, float)):      rms_vals.append(float(p["rms_energy"]))
            if isinstance(p.get("spectral_centroid"), (int, float)): cent_vals.append(float(p["spectral_centroid"]))
        total = sum(breakdown.values())
        return {
            "total_analyzed":       total,
            "breakdown":            breakdown,
            "most_common":          max(breakdown, key=breakdown.get) if total else "unknown",
            "avg_rms_energy":       round(sum(rms_vals) / len(rms_vals), 6) if rms_vals else 0.0,
            "avg_spectral_centroid":round(sum(cent_vals) / len(cent_vals), 4) if cent_vals else 0.0,
        }
    except Exception as exc:
        return JSONResponse({"error": str(exc)}, status_code=500)


# ── Queue ─────────────────────────────────────────────────────

@app.get("/priority_queue")
def priority_queue_report():
    try:
        return {"queue": priority_queue.get_queue(limit=50), "stats": priority_queue.get_stats()}
    except Exception as exc: return JSONResponse({"error": str(exc)}, status_code=500)

@app.get("/vocabulary_check")
def vocabulary_check(text: str = ""):
    words  = {c for token in str(text or "").lower().split() if (c := "".join(ch for ch in token if ch.isalpha()))}
    return {
        "medical_matches":   sorted(words & MEDICAL_VOCABULARY),
        "emergency_matches": sorted(words & EMERGENCY_VOCABULARY),
        "is_domain_critical": bool(words & (MEDICAL_VOCABULARY | EMERGENCY_VOCABULARY)),
    }


# ── Dataset / LoRA ────────────────────────────────────────────

@app.get("/dataset_stats")
def dataset_stats():
    try:   return dataset_manager.get_stats()
    except Exception as exc: return JSONResponse({"error": str(exc)}, status_code=500)

@app.get("/lora_status")
def lora_status():
    try:
        lora_dir   = BACKEND_DIR / "models" / "lora"
        lora_dir.mkdir(parents=True, exist_ok=True)
        epoch_dirs = sorted(p for p in lora_dir.glob("epoch_*") if p.is_dir())
        logs       = sorted(p.name for p in lora_dir.glob("training_log_*.json") if p.is_file())
        last_trained = None
        if logs:
            import json as _json
            data = _json.loads((lora_dir / logs[-1]).read_text())
            last_trained = data.get("trained_at") or datetime.fromtimestamp((lora_dir / logs[-1]).stat().st_mtime).isoformat()
        return {"adapter_exists": bool(epoch_dirs), "last_trained": last_trained, "training_logs": logs}
    except Exception as exc: return JSONResponse({"error": str(exc)}, status_code=500)

@app.get("/lora_experts_status")
def lora_experts_status():
    try:   return lora_router.get_adapter_status()
    except Exception as exc: return JSONResponse({"error": str(exc)}, status_code=500)


# ── File serving ──────────────────────────────────────────────

_TEMP_RESOLVED = Path(TEMP_DIR).resolve()

@app.get("/temp/{filename:path}")
def serve_temp(filename: str):
    safe = (Path(TEMP_DIR) / filename).resolve()
    if not str(safe).startswith(str(_TEMP_RESOLVED)):
        raise HTTPException(status_code=403, detail="Access denied")
    if not safe.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(str(safe))


# ── Google Drive fetch ────────────────────────────────────────

_DRIVE_HOSTS    = {"drive.google.com", "docs.google.com"}
_DRIVE_MAX_BYTES = int(os.environ.get("DRIVE_MAX_MB", "50")) * 1024 * 1024

@app.post("/fetch_drive")
async def fetch_drive(payload: FetchDriveRequest):
    url = (payload.url or "").strip()
    parsed = urlparse(url)
    if parsed.netloc not in _DRIVE_HOSTS:
        raise HTTPException(status_code=400, detail="URL must be a Google Drive or Docs link")

    async with httpx.AsyncClient(follow_redirects=True, timeout=30) as client:
        head = await client.head(url)
        cl = head.headers.get("content-length")
        if cl and int(cl) > _DRIVE_MAX_BYTES:
            raise HTTPException(status_code=413, detail=f"File exceeds {_DRIVE_MAX_BYTES // (1024*1024)} MB limit")
        res = await client.get(url)
        if res.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Upstream returned {res.status_code}")
        if len(res.content) > _DRIVE_MAX_BYTES:
            raise HTTPException(status_code=413, detail="File exceeds size limit")

    from fastapi.responses import Response
    ct = res.headers.get("content-type", "audio/mpeg")
    return Response(content=res.content, media_type=ct)


# ── Static files ──────────────────────────────────────────────
# React build is the primary UI — served at /.
# Vanilla JS is kept as a fallback at /classic/ if the build is absent.

_react_build = PROJECT_DIR / "frontend-react" / "build"
_vanilla     = Path(FRONTEND_DIR)

if _react_build.is_dir():
    app.mount("/", StaticFiles(directory=str(_react_build), html=True), name="react")
elif _vanilla.is_dir():
    # No React build yet — fall back to vanilla JS
    app.mount("/", StaticFiles(directory=str(_vanilla), html=True), name="frontend")
