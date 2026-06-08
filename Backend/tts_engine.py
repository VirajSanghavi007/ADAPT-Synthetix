"""TTS synthesis via Bark (suno/bark-small). Thread-safe loader."""
from __future__ import annotations

import logging
import threading
from pathlib import Path

logger = logging.getLogger(__name__)

import numpy as np
from scipy.io.wavfile import write as write_wav
from transformers import pipeline

_LOCAL_MODEL  = Path(__file__).parent / "models" / "bark-small"
TTS_MODEL_PATH = str(_LOCAL_MODEL) if (_LOCAL_MODEL / "config.json").exists() else "suno/bark-small"

TTS_AVAILABLE  = False
_tts_pipeline  = None
_load_attempted = False
_load_lock      = threading.Lock()


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
        except Exception as e:
            logger.warning("TTS model load failed: %s", e)
            TTS_AVAILABLE = False
    return _tts_pipeline


def synthesize(text: str, output_path: str) -> tuple[str, float]:
    """Synthesize text to WAV file. Returns (output_path, duration_seconds)."""
    load_tts()
    if not TTS_AVAILABLE or _tts_pipeline is None:
        raise RuntimeError("TTS model not loaded — check startup logs")

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
