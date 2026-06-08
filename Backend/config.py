"""
config.py — Centralised configuration.

All settings read from environment variables with sensible defaults.
Directory creation is done via init_directories() called at app startup
(not at import time — makes tests cleaner).
"""
from __future__ import annotations

import os
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent.absolute()

# ── Database ──────────────────────────────────────────────────
DB_DIR  = Path(os.environ.get("DB_DIR",  str(ROOT_DIR / "Backend" / "data")))
DB_PATH = Path(os.environ.get("DB_PATH", str(DB_DIR / "adaptsynthetix.db")))

# ── Dataset ───────────────────────────────────────────────────
DATASET_DIR     = Path(os.environ.get("DATASET_DIR",     str(ROOT_DIR / "Dataset")))
RAW_AUDIO_DIR   = Path(os.environ.get("RAW_AUDIO_DIR",   str(DATASET_DIR / "raw_audio")))
REMEDIAL_DIR    = Path(os.environ.get("REMEDIAL_DIR",    str(DATASET_DIR / "remedial_audio")))

# ── Application paths ─────────────────────────────────────────
LOGS_DIR        = Path(os.environ.get("LOGS_DIR",        str(ROOT_DIR / "Backend" / "logs")))
MODELS_DIR      = Path(os.environ.get("MODELS_DIR",      str(ROOT_DIR / "Backend" / "models")))
TEMP_DIR        = Path(os.environ.get("TEMP_DIR",        str(ROOT_DIR / "Backend" / "temp")))
FRONTEND_DIR    = os.environ.get("FRONTEND_DIR",         str(ROOT_DIR / "Frontend"))

# ── HuggingFace cache ─────────────────────────────────────────
HF_CACHE        = os.environ.get("TRANSFORMERS_CACHE",   str(ROOT_DIR / ".cache" / "huggingface"))

# ── PostgreSQL ────────────────────────────────────────────────
USE_POSTGRES    = os.environ.get("USE_POSTGRES", "false").lower() == "true"
POSTGRES_URL    = os.environ.get("DATABASE_URL",  "postgresql://adapt:adapt@localhost:5432/adaptsynthetix")

# ── Inference tunables ────────────────────────────────────────
CONFIDENCE_TEMPERATURE = float(os.environ.get("CONFIDENCE_TEMPERATURE", "1.0"))
CONF_THRESHOLD_LOW     = float(os.environ.get("CONF_THRESHOLD_LOW",      "0.40"))
SNR_THRESHOLD_LOW      = float(os.environ.get("SNR_THRESHOLD_LOW",       "10.0"))

# ── ASR / TTS model backends ──────────────────────────────────
# ASR_BACKEND: "whisper" (default, best accuracy) or "wav2vec2" (CTC, faster on CPU)
ASR_BACKEND    = os.environ.get("ASR_BACKEND",    "whisper")
# ASR_MODEL: HuggingFace model ID or local path.
#   Whisper: "openai/whisper-small" | "openai/whisper-medium" | "openai/whisper-large-v3"
#   Wav2Vec2: "facebook/wav2vec2-large-robust-ft-swbd-300h" | "facebook/wav2vec2-base-960h"
ASR_MODEL      = os.environ.get("ASR_MODEL",      "openai/whisper-small")
WAV2VEC2_MODEL = os.environ.get("WAV2VEC2_MODEL", "facebook/wav2vec2-large-robust-ft-swbd-300h")

# TTS_MODEL: "suno/bark" (full, best quality) or "suno/bark-small" (faster, lower quality)
TTS_MODEL      = os.environ.get("TTS_MODEL",      "suno/bark")

# Audio denoising via noisereduce before ASR (spectral subtraction)
ENABLE_DENOISING = os.environ.get("ENABLE_DENOISING", "true").lower() == "true"

# Whisper-specific settings
WHISPER_LANGUAGE      = os.environ.get("WHISPER_LANGUAGE", "en")   # set "" for auto-detect
WHISPER_DOMAIN_PROMPT = os.environ.get(
    "WHISPER_DOMAIN_PROMPT",
    "Medical emergency transcription: dyspnea, tachycardia, hypertension, bradycardia, "
    "arrhythmia, intubation, defibrillation, myocardial infarction, hypoxemia, "
    "resuscitation, epinephrine, atropine, anaphylaxis, diaphoresis, cyanosis.",
)

# Auto-training: trigger LoRA fine-tuning when phoneme drift fires AND this many
# remedial samples are available (set 0 to disable auto-training)
AUTO_TRAIN_THRESHOLD = int(os.environ.get("AUTO_TRAIN_THRESHOLD", "50"))


def init_directories() -> None:
    """Create all required directories. Call once at app startup."""
    for d in [DB_DIR, RAW_AUDIO_DIR, REMEDIAL_DIR, LOGS_DIR, MODELS_DIR, TEMP_DIR]:
        d.mkdir(parents=True, exist_ok=True)
