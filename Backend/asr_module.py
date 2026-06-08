"""Wav2Vec2 ASR inference. Thread-safe singleton model loader."""
from __future__ import annotations

import logging
import threading
from pathlib import Path

import librosa
import torch
from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor

logger = logging.getLogger(__name__)

_LOCAL_MODEL = Path(__file__).parent / "models" / "wav2vec2"
ASR_MODEL_PATH = str(_LOCAL_MODEL) if (_LOCAL_MODEL / "config.json").exists() \
                 else "facebook/wav2vec2-base-960h"

logger.info("ASR model path: %s", ASR_MODEL_PATH)

_lock      = threading.Lock()
_processor: Wav2Vec2Processor | None = None
_model:     Wav2Vec2ForCTC    | None = None


def load_model() -> tuple[Wav2Vec2Processor, Wav2Vec2ForCTC]:
    global _processor, _model
    if _processor is not None and _model is not None:
        return _processor, _model
    with _lock:
        # Double-checked locking
        if _processor is None or _model is None:
            logger.info("Loading ASR model from %s …", ASR_MODEL_PATH)
            _processor = Wav2Vec2Processor.from_pretrained(ASR_MODEL_PATH)
            _model     = Wav2Vec2ForCTC.from_pretrained(ASR_MODEL_PATH)
            _model.eval()
            logger.info("ASR model ready.")
    return _processor, _model


def transcribe_audio_with_logits(
    filepath: str,
) -> tuple[str, float, torch.Tensor, object]:
    """
    Transcribe audio file. Returns (transcription, duration, logits, audio_array).
    Uses torch.inference_mode() for maximum CPU inference speed.
    """
    processor, model = load_model()

    audio, sr = librosa.load(filepath, sr=16_000, mono=True)

    if audio.ndim != 1:
        audio = audio.flatten()

    inputs = processor(audio, sampling_rate=16_000, return_tensors="pt", padding=True)

    with torch.inference_mode():
        logits = model(**inputs).logits

    predicted_ids   = torch.argmax(logits, dim=-1)
    transcription   = processor.batch_decode(predicted_ids)[0]
    duration        = librosa.get_duration(y=audio, sr=16_000)

    return transcription, duration, logits, audio


def transcribe_audio(filepath: str) -> tuple[str, float]:
    """Convenience wrapper — returns (transcription, duration) without logits/audio array."""
    transcription, duration, _, _ = transcribe_audio_with_logits(filepath)
    return transcription, duration
