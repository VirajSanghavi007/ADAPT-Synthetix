import io
import os
import threading

from dotenv import load_dotenv

load_dotenv()

import numpy as np
import soundfile as sf
from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from Backend.admin import router as admin_router
from Backend.db import ASRLog, TTSLog, get_session, init_db
from Backend.jwks import require_user_id
from Backend.limiter import limiter
from Backend.password import router as password_router

app = FastAPI(title="Mercury v3")

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

_allowed_origins = os.environ.get("CORS_ORIGINS", "http://localhost:8000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)

init_db()
app.include_router(admin_router)
app.include_router(password_router)

_asr_model = None
_asr_lock = threading.Lock()
_tts_pipeline = None
_tts_lock = threading.Lock()

MAX_AUDIO_BYTES = 25 * 1024 * 1024
MAX_TTS_CHARS = 2000
ALLOWED_AUDIO_TYPES = {"audio/webm", "audio/wav", "audio/x-wav", "audio/mpeg", "audio/ogg"}
KOKORO_VOICES = {
    "af_heart", "af_bella", "af_nicole", "af_sarah", "af_sky",
    "am_adam", "am_michael", "bf_emma", "bf_isabella", "bm_george", "bm_lewis",
}


def get_asr_model():
    global _asr_model
    if _asr_model is None:
        with _asr_lock:
            if _asr_model is None:
                from faster_whisper import WhisperModel
                _asr_model = WhisperModel("small", device="cpu", compute_type="int8")
    return _asr_model


def get_tts_pipeline():
    global _tts_pipeline
    if _tts_pipeline is None:
        with _tts_lock:
            if _tts_pipeline is None:
                from kokoro import KPipeline
                _tts_pipeline = KPipeline(lang_code="a")
    return _tts_pipeline


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/transcribe")
@limiter.limit("10/minute")
async def transcribe(request: Request, file: UploadFile = File(...), user_id: str = Depends(require_user_id)):
    if file.content_type not in ALLOWED_AUDIO_TYPES:
        raise HTTPException(415, f"unsupported content type: {file.content_type}")

    raw = await file.read(MAX_AUDIO_BYTES + 1)
    if not raw:
        raise HTTPException(400, "empty audio file")
    if len(raw) > MAX_AUDIO_BYTES:
        raise HTTPException(413, "audio file too large (max 25MB)")

    try:
        audio, sr = sf.read(io.BytesIO(raw), dtype="float32", always_2d=False)
    except Exception:
        raise HTTPException(400, "could not decode audio file")

    if audio.ndim > 1:
        audio = audio.mean(axis=1)

    def _run_transcribe():
        model = get_asr_model()
        segments, _info = model.transcribe(audio, language="en")
        return " ".join(seg.text.strip() for seg in segments).strip()

    text = await run_in_threadpool(_run_transcribe)

    duration_sec = len(audio) / sr if sr else None
    db = get_session()
    try:
        db.add(ASRLog(user_id=user_id, transcript=text, duration_sec=duration_sec))
        db.commit()
    finally:
        db.close()

    return {"text": text}


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=MAX_TTS_CHARS)
    voice: str = "af_heart"


@app.post("/api/tts")
@limiter.limit("10/minute")
async def tts(request: Request, req: TTSRequest, user_id: str = Depends(require_user_id)):
    text = req.text.strip()
    if not text:
        raise HTTPException(400, "empty text")
    if req.voice not in KOKORO_VOICES:
        raise HTTPException(400, f"unknown voice: {req.voice}")

    def _run_tts():
        pipeline = get_tts_pipeline()
        chunks = [audio for _g, _p, audio in pipeline(text, voice=req.voice)]
        if not chunks:
            return None
        full_audio = np.concatenate(chunks)
        buf = io.BytesIO()
        sf.write(buf, full_audio, 24000, format="WAV")
        buf.seek(0)
        return buf.read()

    wav_bytes = await run_in_threadpool(_run_tts)
    if wav_bytes is None:
        raise HTTPException(500, "no audio generated")

    db = get_session()
    try:
        db.add(TTSLog(user_id=user_id, input_text=text, voice=req.voice))
        db.commit()
    finally:
        db.close()

    return Response(content=wav_bytes, media_type="audio/wav")


app.mount("/", StaticFiles(directory="frontend-next/out", html=True), name="frontend")
