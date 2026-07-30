"""Router to the 3 HF Space model servers (see spaces/space-{free,pro,max}/), one per
tier. The main backend no longer loads any ML model itself — every transcribe/synthesize
call is proxied over HTTP to whichever Space owns that model_id.

Function signatures are unchanged from the old local-loading version on purpose —
Backend/main.py, Backend/ingest.py, and Backend/mcp_server.py call these exactly as
before and don't need to change.
"""
import io
import os

import httpx
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

SPACE_SECRET = os.environ.get("SPACE_SECRET", "")
SPACE_URLS = {
    "free": os.environ.get("SPACE_FREE_URL", ""),
    "pro": os.environ.get("SPACE_PRO_URL", ""),
    "max": os.environ.get("SPACE_MAX_URL", ""),
}

MODEL_TO_SPACE = {}
for _model_id in ASR_CATALOG:
    if _model_id in ("distil-whisper/distil-large-v3",):
        MODEL_TO_SPACE[_model_id] = "free"
    elif _model_id in ("openai/whisper-large-v3-turbo",):
        MODEL_TO_SPACE[_model_id] = "pro"
    elif _model_id in ("nvidia/parakeet-tdt-0.6b-v2",):
        MODEL_TO_SPACE[_model_id] = "max"
for _model_id in TTS_CATALOG:
    if _model_id in ("kokoro",):
        MODEL_TO_SPACE[_model_id] = "free"
    elif _model_id in ("suno/bark",):
        MODEL_TO_SPACE[_model_id] = "pro"
    elif _model_id in ("FunAudioLLM/CosyVoice2-0.5B",):
        MODEL_TO_SPACE[_model_id] = "max"


def _space_url_for(model_id: str) -> str:
    space = MODEL_TO_SPACE.get(model_id)
    if space is None:
        raise ValueError(f"unknown model: {model_id}")
    url = SPACE_URLS.get(space)
    if not url:
        raise RuntimeError(f"SPACE_{space.upper()}_URL is not configured")
    return url.rstrip("/")


def decode_audio(raw: bytes) -> tuple[np.ndarray, int]:
    """Only used locally for duration calculation before forwarding — the Space does
    its own decode independently."""
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


def transcribe_audio(audio: np.ndarray, sr: int, model_id: str, engine: str | None = None) -> str:
    """Synchronous — call via run_in_threadpool from async routes. `engine` is accepted
    for signature compatibility with the old local-loading version (e.g. the eval
    harness) but ignored here — routing is purely by model_id -> Space."""
    url = _space_url_for(model_id)
    wav_buf = io.BytesIO()
    sf.write(wav_buf, audio, sr, format="WAV")
    wav_buf.seek(0)

    resp = httpx.post(
        f"{url}/transcribe",
        headers={"X-Internal-Secret": SPACE_SECRET},
        files={"file": ("audio.wav", wav_buf, "audio/wav")},
        data={"model_id": model_id},
        timeout=120.0,
    )
    resp.raise_for_status()
    return resp.json()["text"]


def synthesize_speech(text: str, voice: str, model_id: str) -> bytes | None:
    """Synchronous — call via run_in_threadpool from async routes. Returns MP3 bytes."""
    url = _space_url_for(model_id)
    resp = httpx.post(
        f"{url}/synthesize",
        headers={"X-Internal-Secret": SPACE_SECRET},
        data={"text": text, "voice": voice or "", "model_id": model_id},
        timeout=120.0,
    )
    if resp.status_code == 500:
        return None
    resp.raise_for_status()
    return resp.content
