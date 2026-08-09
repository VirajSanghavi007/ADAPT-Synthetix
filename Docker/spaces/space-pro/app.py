"""HF Space — Pro tier models: Whisper-Large-v3-Turbo (ASR) + Bark (TTS)."""
import io
import os
import threading

import numpy as np
import soundfile as sf
from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response, JSONResponse
from pydub import AudioSegment

app = FastAPI(title="ADAPT-Synthetix — Pro-tier model space")

INTERNAL_SECRET = os.environ.get("SPACE_SECRET")
MODELS = {"openai/whisper-large-v3-turbo", "suno/bark"}

_asr_pipe = None
_tts_pipe = None
_warm = False
_warm_error: str | None = None


def require_internal(request: Request):
    if not INTERNAL_SECRET or request.headers.get("X-Internal-Secret") != INTERNAL_SECRET:
        raise HTTPException(403, "invalid or missing internal secret")


def get_asr_pipe():
    global _asr_pipe
    if _asr_pipe is None:
        from transformers import pipeline
        _asr_pipe = pipeline("automatic-speech-recognition", model="openai/whisper-large-v3-turbo", device="cpu")
    return _asr_pipe


def get_tts_pipe():
    global _tts_pipe
    if _tts_pipe is None:
        from transformers import pipeline
        _tts_pipe = pipeline("text-to-speech", model="suno/bark", device="cpu")
    return _tts_pipe


def decode_audio(raw: bytes) -> tuple[np.ndarray, int]:
    try:
        audio, sr = sf.read(io.BytesIO(raw), dtype="float32", always_2d=False)
    except Exception:
        segment = AudioSegment.from_file(io.BytesIO(raw))
        sr = segment.frame_rate
        samples = np.array(segment.get_array_of_samples(), dtype=np.float32)
        samples /= float(1 << (8 * segment.sample_width - 1))
        if segment.channels > 1:
            samples = samples.reshape(-1, segment.channels)
        audio = samples
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    return audio, sr


def _warm_up():
    global _warm, _warm_error
    try:
        silence = np.zeros(16000, dtype=np.float32)
        get_asr_pipe()({"array": silence, "sampling_rate": 16000})
        get_tts_pipe()("warm up.")
        _warm = True
    except Exception as exc:  # noqa: BLE001
        _warm_error = str(exc)


@app.on_event("startup")
def _start_warm_up():
    threading.Thread(target=_warm_up, daemon=True).start()


@app.get("/health")
def health():
    if _warm_error is not None:
        return JSONResponse({"status": "error", "detail": _warm_error}, status_code=503)
    if not _warm:
        return JSONResponse({"status": "warming"}, status_code=503)
    return {"status": "ok", "models": list(MODELS)}


@app.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    model_id: str = Form(...),
    _auth=Depends(require_internal),
):
    if model_id not in MODELS:
        raise HTTPException(400, f"model {model_id} not served by this space")
    raw = await file.read()
    audio, sr = decode_audio(raw)

    def _run():
        pipe = get_asr_pipe()
        return pipe({"array": audio, "sampling_rate": sr})["text"].strip()

    text = await run_in_threadpool(_run)
    return {"text": text}


@app.post("/synthesize")
async def synthesize(
    text: str = Form(...),
    voice: str = Form(""),
    model_id: str = Form(...),
    _auth=Depends(require_internal),
):
    if model_id not in MODELS:
        raise HTTPException(400, f"model {model_id} not served by this space")

    def _run():
        pipe = get_tts_pipe()
        out = pipe(text)
        audio = np.asarray(out["audio"]).squeeze()
        sr = out["sampling_rate"]
        wav_buf = io.BytesIO()
        sf.write(wav_buf, audio, sr, format="WAV")
        wav_buf.seek(0)
        segment = AudioSegment.from_wav(wav_buf)
        mp3_buf = io.BytesIO()
        segment.export(mp3_buf, format="mp3", bitrate="128k")
        mp3_buf.seek(0)
        return mp3_buf

    mp3_buf = await run_in_threadpool(_run)
    return Response(content=mp3_buf.read(), media_type="audio/mpeg")
