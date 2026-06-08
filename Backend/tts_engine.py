"""TTS synthesis via Bark. Thread-safe singleton loader.

Default model: suno/bark (full model — much better prosody than bark-small).
Override with TTS_MODEL env var, e.g. TTS_MODEL=suno/bark-small for lighter inference.
"""
from __future__ import annotations

import logging
import threading
from pathlib import Path

import numpy as np
from scipy.io.wavfile import write as write_wav
from transformers import pipeline

from config import TTS_MODEL, MODELS_DIR

logger = logging.getLogger(__name__)

# ── Resolve model path ────────────────────────────────────────
# Prefer downloaded local copies; respect TTS_MODEL env var for hub fallback.
_LOCAL_BARK       = MODELS_DIR / "bark"
_LOCAL_BARK_SMALL = MODELS_DIR / "bark-small"

if _LOCAL_BARK.is_dir() and (_LOCAL_BARK / "config.json").exists():
    TTS_MODEL_PATH = str(_LOCAL_BARK)
elif _LOCAL_BARK_SMALL.is_dir() and (_LOCAL_BARK_SMALL / "config.json").exists():
    TTS_MODEL_PATH = str(_LOCAL_BARK_SMALL)
else:
    TTS_MODEL_PATH = TTS_MODEL  # from config — defaults to "suno/bark"

logger.info("TTS model path: %s", TTS_MODEL_PATH)

# ── Singleton state ───────────────────────────────────────────
TTS_AVAILABLE    = False
_tts_pipeline    = None
_load_attempted  = False
_load_lock       = threading.Lock()


def load_tts():
    global TTS_AVAILABLE, _tts_pipeline, _load_attempted
    with _load_lock:
        if _tts_pipeline is not None or _load_attempted:
            return _tts_pipeline
        _load_attempted = True
        logger.info("Loading TTS model from %s …", TTS_MODEL_PATH)
        try:
            _tts_pipeline = pipeline("text-to-speech", model=TTS_MODEL_PATH)
            TTS_AVAILABLE = True
            logger.info("TTS model ready.")
        except Exception as exc:
            logger.warning("TTS model load failed: %s", exc)
            TTS_AVAILABLE = False
    return _tts_pipeline


def synthesize(text: str, output_path: str) -> tuple[str, float]:
    """
    Synthesize text to WAV file.

    Returns (output_path, duration_seconds).
    Raises RuntimeError if TTS model failed to load at startup.
    """
    load_tts()
    if not TTS_AVAILABLE or _tts_pipeline is None:
        raise RuntimeError("TTS model not available — check server startup logs")

    result = _tts_pipeline(text)
    audio  = result["audio"]
    sr     = int(result["sampling_rate"])

    # Unwrap tensor if needed
    if hasattr(audio, "detach"):
        audio = audio.detach().cpu().numpy()

    audio = np.array(audio, dtype=np.float32)

    # Squeeze to 1-D (Bark may return (1, N) or (N,))
    audio = audio.squeeze()
    if audio.ndim != 1:
        audio = audio.flatten()

    # Convert to int16 for broad compatibility
    audio_int16 = (np.clip(audio, -1.0, 1.0) * 32767).astype(np.int16)

    write_wav(output_path, sr, audio_int16)
    duration = len(audio_int16) / float(sr)
    return output_path, duration
