"""Multi-model ASR/TTS integration. Each model is lazy-loaded once and cached by id,
dispatched by engine type (see Backend/tiers.py for the tier -> model catalog).
"""
import io
import os
import tempfile
import threading

import numpy as np
import soundfile as sf

from Backend.tiers import ASR_CATALOG, TTS_CATALOG

# soundfile handles wav/flac/ogg directly; mp3/mp4/aac/3gpp/webm/amr fall back to
# ffmpeg via pydub in decode_audio(). Anything else is rejected with a 415.
ALLOWED_AUDIO_TYPES = {
    "audio/webm",
    "audio/wav",
    "audio/x-wav",
    "audio/mpeg",       # mp3
    "audio/mp3",
    "audio/ogg",
    "audio/flac",
    "audio/x-flac",
    "audio/mp4",
    "audio/x-m4a",
    "audio/aac",
    "audio/3gpp",
    "audio/amr",
    "video/mp4",        # some recorders (iOS Safari) wrap audio-only capture in an mp4 container
}

_hf_token = os.environ.get("HF_TOKEN")
if _hf_token:
    from huggingface_hub import login
    login(token=_hf_token)

_models: dict[str, object] = {}
_locks: dict[str, threading.Lock] = {}


def _lock_for(key: str) -> threading.Lock:
    if key not in _locks:
        _locks[key] = threading.Lock()
    return _locks[key]


def decode_audio(raw: bytes) -> tuple[np.ndarray, int]:
    """soundfile (libsndfile) handles wav/flac/ogg natively but can't decode
    compressed containers like mp3/mp4/aac — those fall back to ffmpeg via pydub."""
    try:
        audio, sr = sf.read(io.BytesIO(raw), dtype="float32", always_2d=False)
    except Exception:
        from pydub import AudioSegment

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


# ── ASR engines ──────────────────────────────────────────────────────────────

def _load_nemo(model_id: str):
    import nemo.collections.asr as nemo_asr
    return nemo_asr.models.ASRModel.from_pretrained(model_name=model_id)


def _run_nemo(model, audio: np.ndarray, sr: int) -> str:
    with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
        sf.write(tmp.name, audio, sr, format="WAV")
        (hyp,) = model.transcribe([tmp.name])
    return (hyp.text if hasattr(hyp, "text") else str(hyp)).strip()


def _load_hf_asr_pipeline(model_id: str):
    from transformers import pipeline
    return pipeline("automatic-speech-recognition", model=model_id, device="cpu")


def _run_hf_asr_pipeline(pipe, audio: np.ndarray, sr: int) -> str:
    result = pipe({"array": audio, "sampling_rate": sr})
    return result["text"].strip()


_ASR_ENGINES = {
    "nemo": (_load_nemo, _run_nemo),
    "hf_asr_pipeline": (_load_hf_asr_pipeline, _run_hf_asr_pipeline),
}


def get_asr_model(model_id: str):
    if model_id not in ASR_CATALOG:
        raise ValueError(f"unknown ASR model: {model_id}")
    if model_id not in _models:
        with _lock_for(model_id):
            if model_id not in _models:
                engine = ASR_CATALOG[model_id]["engine"]
                loader, _ = _ASR_ENGINES[engine]
                _models[model_id] = loader(model_id)
    return _models[model_id]


def transcribe_audio(audio: np.ndarray, sr: int, model_id: str) -> str:
    """Synchronous — call via run_in_threadpool from async routes."""
    engine = ASR_CATALOG[model_id]["engine"]
    _, runner = _ASR_ENGINES[engine]
    model = get_asr_model(model_id)
    return runner(model, audio, sr)


# ── TTS engines ──────────────────────────────────────────────────────────────

def _load_kokoro(_model_id: str):
    from kokoro import KPipeline
    return KPipeline(lang_code="a")


def _run_kokoro(pipeline, text: str, voice: str) -> tuple[np.ndarray, int]:
    chunks = [audio for _g, _p, audio in pipeline(text, voice=voice or "af_heart")]
    if not chunks:
        return None, 24000
    return np.concatenate(chunks), 24000


def _load_bark(model_id: str):
    from transformers import pipeline
    return pipeline("text-to-speech", model=model_id, device="cpu")


def _run_bark(pipe, text: str, _voice: str) -> tuple[np.ndarray, int]:
    out = pipe(text)
    return np.asarray(out["audio"]).squeeze(), out["sampling_rate"]


def _load_cosyvoice2(model_id: str):
    from cosyvoice.cli.cosyvoice import CosyVoice2
    return CosyVoice2(model_id)


def _run_cosyvoice2(pipeline, text: str, voice: str) -> tuple[np.ndarray, int]:
    # spk_id must match one of pipeline.list_available_spks() — confirm exact set once
    # the model is pulled in Docker.
    chunks = [out["tts_speech"].numpy() for out in pipeline.inference_sft(text, voice or "default")]
    if not chunks:
        return None, pipeline.sample_rate
    return np.concatenate(chunks), pipeline.sample_rate


_TTS_ENGINES = {
    "kokoro": (_load_kokoro, _run_kokoro),
    "bark": (_load_bark, _run_bark),
    "cosyvoice2": (_load_cosyvoice2, _run_cosyvoice2),
}


def get_tts_pipeline(model_id: str):
    if model_id not in TTS_CATALOG:
        raise ValueError(f"unknown TTS model: {model_id}")
    if model_id not in _models:
        with _lock_for(model_id):
            if model_id not in _models:
                engine = TTS_CATALOG[model_id]["engine"]
                loader, _ = _TTS_ENGINES[engine]
                _models[model_id] = loader(model_id)
    return _models[model_id]


def synthesize_speech(text: str, voice: str, model_id: str) -> bytes | None:
    """Synchronous — call via run_in_threadpool from async routes."""
    engine = TTS_CATALOG[model_id]["engine"]
    _, runner = _TTS_ENGINES[engine]
    pipeline = get_tts_pipeline(model_id)
    audio, sr = runner(pipeline, text, voice)
    if audio is None:
        return None
    buf = io.BytesIO()
    sf.write(buf, audio, sr, format="WAV")
    buf.seek(0)
    return buf.read()
