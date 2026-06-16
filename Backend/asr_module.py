"""Multi-backend ASR: Whisper (default) or Wav2Vec2. Thread-safe singleton loaders."""
from __future__ import annotations

import logging
import threading
from pathlib import Path

import librosa
import numpy as np
import torch

from config import (
    ASR_BACKEND,
    ASR_MODEL,
    WAV2VEC2_MODEL,
    ENABLE_DENOISING,
    WHISPER_LANGUAGE,
    WHISPER_DOMAIN_PROMPT,
    MODELS_DIR,
)

logger = logging.getLogger(__name__)

# ── Resolved local model paths ────────────────────────────────
_LOCAL_WHISPER  = MODELS_DIR / "whisper"
_LOCAL_WAV2VEC2 = MODELS_DIR / "wav2vec2"

# Base fine-tuned adapters (produced by base_trainer.py)
# Prefer the most recently trained dataset adapter
def _find_base_finetuned() -> Path | None:
    base = MODELS_DIR / "base_finetuned"
    if not base.exists():
        return None
    candidates = sorted(
        [d / "final" for d in base.iterdir() if (d / "final" / "adapter_config.json").exists()],
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    return candidates[0] if candidates else None


def _resolve_asr_model_path(backend: str) -> str:
    """Resolve model path: local fine-tuned adapter > local weights > HF hub."""
    if backend == "whisper":
        fine_tuned = _find_base_finetuned()
        if fine_tuned:
            logger.info("Using locally fine-tuned Whisper adapter: %s", fine_tuned)
            return str(fine_tuned)
        if (_LOCAL_WHISPER / "config.json").exists():
            return str(_LOCAL_WHISPER)
        return ASR_MODEL
    else:
        if (_LOCAL_WAV2VEC2 / "config.json").exists():
            return str(_LOCAL_WAV2VEC2)
        return WAV2VEC2_MODEL


# Resolve once at startup; reloadable via reload_asr_model()
ASR_MODEL_PATH = _resolve_asr_model_path(ASR_BACKEND)


def reload_asr_model_path() -> str:
    """Re-resolve ASR_MODEL_PATH (call after base_trainer.py completes)."""
    global ASR_MODEL_PATH
    ASR_MODEL_PATH = _resolve_asr_model_path(ASR_BACKEND)
    logger.info("ASR model path reloaded: %s", ASR_MODEL_PATH)
    return ASR_MODEL_PATH

logger.info("ASR backend: %s  —  model: %s  —  denoising: %s",
            ASR_BACKEND, ASR_MODEL_PATH, ENABLE_DENOISING)

# ── Singleton state ───────────────────────────────────────────
_lock = threading.Lock()

# Whisper singletons
_whisper_processor = None
_whisper_model     = None

# Wav2Vec2 singletons
_w2v2_processor = None
_w2v2_model     = None


# ── Optional audio denoising ──────────────────────────────────

def _maybe_denoise(audio: np.ndarray, sr: int = 16_000) -> np.ndarray:
    """Spectral noise reduction via noisereduce (when ENABLE_DENOISING=true)."""
    if not ENABLE_DENOISING:
        return audio
    try:
        import noisereduce as nr  # optional dependency
        return nr.reduce_noise(y=audio, sr=sr, stationary=False, prop_decrease=0.75)
    except ImportError:
        logger.debug("noisereduce not installed — skipping denoising (pip install noisereduce)")
        return audio
    except Exception as exc:
        logger.warning("Denoising failed (%s) — using raw audio", exc)
        return audio


# ── Whisper backend ───────────────────────────────────────────

def _load_whisper():
    global _whisper_processor, _whisper_model
    if _whisper_processor is not None and _whisper_model is not None:
        return _whisper_processor, _whisper_model
    with _lock:
        if _whisper_processor is None or _whisper_model is None:
            from transformers import WhisperForConditionalGeneration, WhisperProcessor
            logger.info("Loading Whisper model from %s …", ASR_MODEL_PATH)
            _whisper_processor = WhisperProcessor.from_pretrained(ASR_MODEL_PATH)
            _whisper_model = WhisperForConditionalGeneration.from_pretrained(ASR_MODEL_PATH)
            _whisper_model.eval()
            logger.info("Whisper model ready.")
    return _whisper_processor, _whisper_model


def _transcribe_whisper(
    filepath: str,
) -> tuple[str, float, torch.Tensor, np.ndarray]:
    """
    Whisper inference with domain prompting and token-level confidence scores.

    Whisper (Radford et al. 2022) is an encoder-decoder transformer trained on
    680 K hours of multilingual speech — far more robust to noise and accents than
    CTC-based models trained on clean read speech.

    Returns a stacked scores tensor [1, T, vocab_size] so diagnostics.extract_confidence
    works identically for both Whisper and Wav2Vec2.
    """
    processor, model = _load_whisper()

    audio, sr = librosa.load(filepath, sr=16_000, mono=True)
    audio = _maybe_denoise(audio, sr)

    input_features = processor(
        audio, sampling_rate=16_000, return_tensors="pt"
    ).input_features

    generate_kwargs: dict = {
        "task": "transcribe",
        "return_dict_in_generate": True,
        "output_scores": True,
    }
    if WHISPER_LANGUAGE:
        generate_kwargs["language"] = WHISPER_LANGUAGE
    if WHISPER_DOMAIN_PROMPT:
        generate_kwargs["initial_prompt"] = WHISPER_DOMAIN_PROMPT

    with torch.inference_mode():
        outputs = model.generate(input_features, **generate_kwargs)

    transcription = processor.batch_decode(
        outputs.sequences, skip_special_tokens=True
    )[0].strip()
    duration = librosa.get_duration(y=audio, sr=16_000)

    # Stack per-token scores → [1, T, vocab_size] (compatible with extract_confidence)
    if outputs.scores:
        stacked = torch.stack(outputs.scores, dim=1)  # (1, T, vocab)
    else:
        stacked = torch.zeros(1, 1, model.config.vocab_size)

    return transcription, duration, stacked, audio


# ── Wav2Vec2 backend ──────────────────────────────────────────

def _load_wav2vec2():
    global _w2v2_processor, _w2v2_model
    if _w2v2_processor is not None and _w2v2_model is not None:
        return _w2v2_processor, _w2v2_model
    with _lock:
        if _w2v2_processor is None or _w2v2_model is None:
            from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor
            logger.info("Loading Wav2Vec2 model from %s …", ASR_MODEL_PATH)
            _w2v2_processor = Wav2Vec2Processor.from_pretrained(ASR_MODEL_PATH)
            _w2v2_model = Wav2Vec2ForCTC.from_pretrained(ASR_MODEL_PATH)
            _w2v2_model.eval()
            logger.info("Wav2Vec2 model ready.")
    return _w2v2_processor, _w2v2_model


def _transcribe_wav2vec2(
    filepath: str,
) -> tuple[str, float, torch.Tensor, np.ndarray]:
    """
    Wav2Vec2 CTC inference.  Uses wav2vec2-large-robust-ft-swbd-300h by default —
    the "robust" variant fine-tuned on Switchboard + 300h of noisy data, significantly
    more accent/noise resilient than the base-960h model.
    """
    processor, model = _load_wav2vec2()

    audio, sr = librosa.load(filepath, sr=16_000, mono=True)
    audio = _maybe_denoise(audio, sr)

    if audio.ndim != 1:
        audio = audio.flatten()

    inputs = processor(audio, sampling_rate=16_000, return_tensors="pt", padding=True)
    with torch.inference_mode():
        logits = model(**inputs).logits

    predicted_ids = torch.argmax(logits, dim=-1)
    transcription = processor.batch_decode(predicted_ids)[0]
    duration = librosa.get_duration(y=audio, sr=16_000)
    return transcription, duration, logits, audio


# ── Public API ────────────────────────────────────────────────

def transcribe_audio_with_logits(
    filepath: str,
) -> tuple[str, float, torch.Tensor, np.ndarray]:
    """
    Transcribe audio file.

    Returns (transcription, duration_seconds, logits_tensor, audio_array).
    logits_tensor shape: [1, T, vocab_size] for both backends.
    Backend is controlled by ASR_BACKEND env var ("whisper" | "wav2vec2").
    """
    if ASR_BACKEND == "whisper":
        return _transcribe_whisper(filepath)
    return _transcribe_wav2vec2(filepath)


def transcribe_audio(filepath: str) -> tuple[str, float]:
    """Convenience wrapper — returns (transcription, duration) without logits/audio array."""
    transcription, duration, _, _ = transcribe_audio_with_logits(filepath)
    return transcription, duration


def get_model_info() -> dict:
    """Return current ASR configuration (safe to call at any time)."""
    return {
        "backend":        ASR_BACKEND,
        "model":          ASR_MODEL_PATH,
        "denoising":      ENABLE_DENOISING,
        "language":       WHISPER_LANGUAGE or "auto",
        "domain_prompt":  bool(WHISPER_DOMAIN_PROMPT),
    }
