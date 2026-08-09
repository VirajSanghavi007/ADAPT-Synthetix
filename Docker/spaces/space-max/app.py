"""HF Space — Max/Enterprise tier models: Parakeet-TDT-0.6B-v2 (ASR, NeMo) +
CosyVoice2-0.5B (TTS)."""
import io
import os
import tempfile
import threading

# HF's xet chunked-download backend has proven unreliable on this network (fails
# mid-transfer on large files with a ConnectionError, no automatic fallback) —
# force the plain HTTP download path instead. Must be set before any HF download call.
os.environ.setdefault("HF_HUB_DISABLE_XET", "1")

import numpy as np
import soundfile as sf
from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response, JSONResponse
from pydub import AudioSegment

app = FastAPI(title="ADAPT-Synthetix — Max-tier model space")

INTERNAL_SECRET = os.environ.get("SPACE_SECRET")
MODELS = {"nvidia/parakeet-tdt-0.6b-v2", "FunAudioLLM/CosyVoice2-0.5B"}

_asr_model = None
_tts_pipeline = None
_warm = False
_warm_error: str | None = None


def require_internal(request: Request):
    if not INTERNAL_SECRET or request.headers.get("X-Internal-Secret") != INTERNAL_SECRET:
        raise HTTPException(403, "invalid or missing internal secret")


def get_asr_model():
    global _asr_model
    if _asr_model is None:
        import nemo.collections.asr as nemo_asr
        _asr_model = nemo_asr.models.ASRModel.from_pretrained(model_name="nvidia/parakeet-tdt-0.6b-v2")
    return _asr_model


def get_tts_pipeline():
    global _tts_pipeline
    if _tts_pipeline is None:
        import sys
        sys.path.insert(0, "/app/CosyVoice")
        sys.path.insert(0, "/app/CosyVoice/third_party/Matcha-TTS")
        from cosyvoice.cli.cosyvoice import CosyVoice2
        # CosyVoice2(model_dir) skips its own download entirely if model_dir already
        # exists locally — otherwise it calls modelscope's snapshot_download, which
        # 404s on this repo id (ModelScope's own registry, separate from HF, doesn't
        # have it under this path). Pre-fetch from HF ourselves and hand it a local dir.
        from huggingface_hub import snapshot_download
        local_dir = snapshot_download("FunAudioLLM/CosyVoice2-0.5B")
        _tts_pipeline = CosyVoice2(local_dir)
    return _tts_pipeline


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
    """Load both models and run one real inference each at boot. This is also the
    P0.3 space-max diagnostic in disguise: if the CosyVoice2 spk_id assumption above
    ("default") is wrong, this is what surfaces it — as a failed health check, not
    a live user's failed request."""
    global _warm, _warm_error
    try:
        silence = np.zeros(16000, dtype=np.float32)
        with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
            sf.write(tmp.name, silence, 16000, format="WAV")
            get_asr_model().transcribe([tmp.name])
        pipeline = get_tts_pipeline()
        list(pipeline.inference_sft("warm up.", "default"))
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
        model = get_asr_model()
        with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
            sf.write(tmp.name, audio, sr, format="WAV")
            (hyp,) = model.transcribe([tmp.name])
        return (hyp.text if hasattr(hyp, "text") else str(hyp)).strip()

    text = await run_in_threadpool(_run)
    return {"text": text}


@app.post("/synthesize")
async def synthesize(
    text: str = Form(...),
    voice: str = Form("default"),
    model_id: str = Form(...),
    _auth=Depends(require_internal),
):
    if model_id not in MODELS:
        raise HTTPException(400, f"model {model_id} not served by this space")

    def _run():
        pipeline = get_tts_pipeline()
        # spk_id must match one of pipeline.list_available_spks() — confirm exact set once deployed.
        chunks = [out["tts_speech"].numpy() for out in pipeline.inference_sft(text, voice or "default")]
        if not chunks:
            return None
        full_audio = np.concatenate(chunks)
        wav_buf = io.BytesIO()
        sf.write(wav_buf, full_audio, pipeline.sample_rate, format="WAV")
        wav_buf.seek(0)
        segment = AudioSegment.from_wav(wav_buf)
        mp3_buf = io.BytesIO()
        segment.export(mp3_buf, format="mp3", bitrate="128k")
        mp3_buf.seek(0)
        return mp3_buf

    mp3_buf = await run_in_threadpool(_run)
    if mp3_buf is None:
        raise HTTPException(500, "no audio generated")
    return Response(content=mp3_buf.read(), media_type="audio/mpeg")
