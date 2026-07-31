"""HF Space — Max/Enterprise tier models: Parakeet-TDT-0.6B-v2 (ASR, NeMo) +
CosyVoice2-0.5B (TTS)."""
import io
import os
import tempfile

import numpy as np
import soundfile as sf
from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import Response
from pydub import AudioSegment

app = FastAPI(title="Mercury — Max-tier model space")

INTERNAL_SECRET = os.environ.get("SPACE_SECRET")
MODELS = {"nvidia/parakeet-tdt-0.6b-v2", "FunAudioLLM/CosyVoice2-0.5B"}

_asr_model = None
_tts_pipeline = None


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
        _tts_pipeline = CosyVoice2("FunAudioLLM/CosyVoice2-0.5B")
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


@app.get("/health")
def health():
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
