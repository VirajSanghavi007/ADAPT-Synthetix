import time

from fastapi import HTTPException

from Backend.db import get_session
from Backend.redis_client import get_redis

ASR_CATALOG = {
    "distil-whisper/distil-large-v3": {"engine": "hf_asr_pipeline", "label": "Echo 1.1"},
    "openai/whisper-large-v3-turbo": {"engine": "hf_asr_pipeline", "label": "Apollo 1.2"},
    "nvidia/parakeet-tdt-0.6b-v2": {"engine": "nemo", "label": "Thoth 1.3"},
}

TTS_CATALOG = {
    "kokoro": {"engine": "kokoro", "label": "Echo 1.1"},
    "suno/bark": {"engine": "bark", "label": "Apollo 1.2"},
    "FunAudioLLM/CosyVoice2-0.5B": {"engine": "cosyvoice2", "label": "Thoth 1.3"},
}

TIER_MODELS = {
    "free": {
        "asr": ["distil-whisper/distil-large-v3"],
        "tts": ["kokoro"],
    },
    "pro": {
        "asr": ["distil-whisper/distil-large-v3"],
        "tts": ["kokoro"],
    },
    "max": {
        "asr": ["distil-whisper/distil-large-v3"],
        "tts": ["kokoro"],
    },
    "enterprise": {
        "asr": ["distil-whisper/distil-large-v3", "openai/whisper-large-v3-turbo", "nvidia/parakeet-tdt-0.6b-v2"],
        "tts": ["kokoro", "suno/bark", "FunAudioLLM/CosyVoice2-0.5B"],
    },
}

DEFAULT_MODEL = {
    "free": {"asr": "distil-whisper/distil-large-v3", "tts": "kokoro"},
    "pro": {"asr": "distil-whisper/distil-large-v3", "tts": "kokoro"},
    "max": {"asr": "distil-whisper/distil-large-v3", "tts": "kokoro"},
    "enterprise": {"asr": "nvidia/parakeet-tdt-0.6b-v2", "tts": "FunAudioLLM/CosyVoice2-0.5B"},
}

TIER_RATE_LIMITS = {
    "free": 30,
    "pro": 300,
    "max": 5000,
    "enterprise": 5000,
}


def get_user_tier(user_id: str) -> str:
    from sqlalchemy import text
    from sqlalchemy.exc import OperationalError, ProgrammingError

    db = get_session()
    try:
        row = db.execute(
            text("select tier from profiles where id = :uid"), {"uid": user_id}
        ).first()
        return row[0] if row and row[0] else "free"
    except OperationalError:
        return "free"
    except ProgrammingError:
        db.rollback()
        return "free"
    finally:
        db.close()


def resolve_model(tier: str, kind: str, requested: str | None) -> str:
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
        _notify_rate_limit_once(r, user_id, tier, limit, window)
        raise HTTPException(429, f"rate limit exceeded for {tier} tier ({limit}/hour)")


def _notify_rate_limit_once(r, user_id: str, tier: str, limit: int, window: int) -> None:
    notify_key = f"tier_rl_notified:{user_id}:{window}"
    if not r.set(notify_key, "1", nx=True, ex=3600):
        return

    from sqlalchemy import text

    db = get_session()
    try:
        row = db.execute(text("select email from auth.users where id = :uid"), {"uid": user_id}).first()
    except Exception:
        row = None
    finally:
        db.close()
    if not row or not row[0]:
        return

    from Backend.email_utils import send_email

    send_email(
        row[0],
        "ADAPT-Synthetix — hourly rate limit reached",
        f"You've hit the {tier} tier's rate limit ({limit} requests/hour). "
        f"It resets at the top of the next hour — upgrade your plan for a higher limit.",
    )
