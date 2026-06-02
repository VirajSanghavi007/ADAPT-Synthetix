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


def init_directories() -> None:
    """Create all required directories. Call once at app startup."""
    for d in [DB_DIR, RAW_AUDIO_DIR, REMEDIAL_DIR, LOGS_DIR, MODELS_DIR, TEMP_DIR]:
        d.mkdir(parents=True, exist_ok=True)
