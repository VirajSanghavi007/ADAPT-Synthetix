"""TTS synthesis via Kokoro. Thread-safe singleton loader.

Kokoro is not a `transformers` pipeline model — it ships its own inference
package (`kokoro`). Default voice/lang controlled by TTS_VOICE / TTS_LANG_CODE
env vars (see config.py).
"""
from __future__ import annotations

import logging
import threading

import numpy as np
from scipy.io.wavfile import write as write_wav

from config import TTS_MODEL, TTS_VOICE, TTS_LANG_CODE

logger = logging.getLogger(__name__)

KOKORO_SAMPLE_RATE = 24_000

# ── Singleton state ───────────────────────────────────────────
TTS_AVAILABLE    = False
_kpipeline       = None
_load_attempted  = False
_load_lock       = threading.Lock()


def load_tts():
    global TTS_AVAILABLE, _kpipeline, _load_attempted
    with _load_lock:
        if _kpipeline is not None or _load_attempted:
            return _kpipeline
        _load_attempted = True
        logger.info("Loading Kokoro TTS model %s (lang=%s) …", TTS_MODEL, TTS_LANG_CODE)
        try:
            from kokoro import KPipeline
            _kpipeline = KPipeline(lang_code=TTS_LANG_CODE, repo_id=TTS_MODEL)
            TTS_AVAILABLE = True
            logger.info("Kokoro TTS model ready.")
        except Exception as exc:
            logger.warning("TTS model load failed: %s", exc)
            TTS_AVAILABLE = False
    return _kpipeline


def synthesize(text: str, output_path: str) -> tuple[str, float]:
    """
    Synthesize text to WAV file.

    Returns (output_path, duration_seconds).
    Raises RuntimeError if TTS model failed to load at startup.
    """
    pipeline = load_tts()
    if not TTS_AVAILABLE or pipeline is None:
        raise RuntimeError("TTS model not available — check server startup logs")

    chunks = []
    for _, _, audio in pipeline(text, voice=TTS_VOICE):
        if hasattr(audio, "detach"):
            audio = audio.detach().cpu().numpy()
        chunks.append(np.asarray(audio, dtype=np.float32))

    audio = np.concatenate(chunks) if chunks else np.zeros(0, dtype=np.float32)
    audio = audio.squeeze()
    if audio.ndim != 1:
        audio = audio.flatten()

    audio_int16 = (np.clip(audio, -1.0, 1.0) * 32767).astype(np.int16)

    write_wav(output_path, KOKORO_SAMPLE_RATE, audio_int16)
    duration = len(audio_int16) / float(KOKORO_SAMPLE_RATE)
    return output_path, duration
