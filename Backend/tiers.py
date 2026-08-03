"""Subscription-tier model catalog, access control, and rate limiting.

Free/Pro get lighter models; Max and Enterprise get the best available. Enterprise is
free (hospitals etc.) but gets Max-equivalent model access — it's billing-free, not
capability-free.
"""
import time

from fastapi import HTTPException

from Backend.db import get_session
from Backend.redis_client import get_redis

ASR_CATALOG = {
    "distil-whisper/distil-large-v3": {"engine": "hf_asr_pipeline", "label": "Distil-Whisper (fast)"},
    "openai/whisper-large-v3-turbo": {"engine": "hf_asr_pipeline", "label": "Whisper Large v3 Turbo"},
    "nvidia/parakeet-tdt-0.6b-v2": {"engine": "nemo", "label": "Parakeet TDT 0.6B (best accuracy)"},
}

TTS_CATALOG = {
    "kokoro": {"engine": "kokoro", "label": "Kokoro (fast)"},
    "suno/bark": {"engine": "bark", "label": "Bark"},
    "FunAudioLLM/CosyVoice2-0.5B": {"engine": "cosyvoice2", "label": "CosyVoice2 (best quality, voice cloning)"},
}

# Tier -> allowed model ids. Enterprise mirrors max (best models, free billing).
TIER_MODELS = {
    "free": {
        "asr": ["distil-whisper/distil-large-v3"],
        "tts": ["kokoro"],
    },
    "pro": {
        "asr": ["distil-whisper/distil-large-v3", "openai/whisper-large-v3-turbo"],
        "tts": ["kokoro", "suno/bark"],
    },
    "max": {
        "asr": ["distil-whisper/distil-large-v3", "openai/whisper-large-v3-turbo", "nvidia/parakeet-tdt-0.6b-v2"],
        "tts": ["kokoro", "suno/bark", "FunAudioLLM/CosyVoice2-0.5B"],
    },
    "enterprise": {
        "asr": ["distil-whisper/distil-large-v3", "openai/whisper-large-v3-turbo", "nvidia/parakeet-tdt-0.6b-v2"],
        "tts": ["kokoro", "suno/bark", "FunAudioLLM/CosyVoice2-0.5B"],
    },
}

DEFAULT_MODEL = {
    "free": {"asr": "distil-whisper/distil-large-v3", "tts": "kokoro"},
    "pro": {"asr": "openai/whisper-large-v3-turbo", "tts": "suno/bark"},
    "max": {"asr": "nvidia/parakeet-tdt-0.6b-v2", "tts": "FunAudioLLM/CosyVoice2-0.5B"},
    "enterprise": {"asr": "nvidia/parakeet-tdt-0.6b-v2", "tts": "FunAudioLLM/CosyVoice2-0.5B"},
}

# Requests/hour, separate from the API-key tiers in api_keys.py (interactive UI usage).
TIER_RATE_LIMITS = {
    "free": 30,
    "pro": 300,
    "max": 5000,
    "enterprise": 5000,
}


def get_user_tier(user_id: str) -> str:
    from sqlalchemy import text
    from sqlalchemy.exc import OperationalError

    db = get_session()
    try:
        row = db.execute(
            text("select tier from profiles where id = :uid"), {"uid": user_id}
        ).first()
        return row[0] if row and row[0] else "free"
    except OperationalError:
        # DB unreachable (network outage, pooler down) — degrade to free rather
        # than taking down transcribe/TTS entirely.
        return "free"
    finally:
        db.close()


def resolve_model(tier: str, kind: str, requested: str | None) -> str:
    """Validate a requested model_id against the tier's allowed list, or return the
    tier's default. kind is 'asr' or 'tts'."""
    allowed = TIER_MODELS.get(tier, TIER_MODELS["free"])[kind]
    if requested is None:
        return DEFAULT_MODEL.get(tier, DEFAULT_MODEL["free"])[kind]
    if requested not in allowed:
        raise HTTPException(
            403,
            f"model '{requested}' is not available on the {tier} tier. "
            f"Available {kind} models: {', '.join(allowed)}",
        )
    return requested


def check_tier_rate_limit(user_id: str, tier: str) -> None:
    """Fixed-window per-hour counter in Redis, keyed per user. Fail-open if Redis is down."""
    r = get_redis()
    if r is None:
        return
    window = int(time.time() // 3600)
    key = f"tier_rl:{user_id}:{window}"
    count = r.incr(key)
    if count == 1:
        r.expire(key, 3600)
    limit = TIER_RATE_LIMITS.get(tier, TIER_RATE_LIMITS["free"])
    if count > limit:
        raise HTTPException(429, f"rate limit exceeded for {tier} tier ({limit}/hour)")
