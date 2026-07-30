"""Third-party API key issuance, auth, and tiered rate limiting.

Free/Pro/Max tiers mirror the Subscription page. Keys authenticate requests to the
public transcribe/TTS API (and the MCP server, which is just another API consumer)
as an alternative to a Supabase user session.
"""
import hashlib
import secrets
import time

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from Backend.db import ApiKey, get_session
from Backend.jwks import require_user
from Backend.redis_client import get_redis

router = APIRouter(prefix="/api/keys", tags=["api-keys"])

TIER_LIMITS = {
    "free": 60,     # requests / hour
    "pro": 1000,
    "max": 10000,
}


def _hash_key(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def _generate_key() -> tuple[str, str, str]:
    """Returns (raw_key, prefix, hash)."""
    raw = f"mk_live_{secrets.token_urlsafe(32)}"
    return raw, raw[:12], _hash_key(raw)


class CreateKeyRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


@router.post("")
def create_key(req: CreateKeyRequest, user: dict = Depends(require_user)):
    raw, prefix, key_hash = _generate_key()
    db = get_session()
    try:
        record = ApiKey(user_id=user["id"], name=req.name, key_prefix=prefix, key_hash=key_hash)
        db.add(record)
        db.commit()
        db.refresh(record)
    finally:
        db.close()
    # Full key is shown exactly once — only the hash is stored.
    return {"id": record.id, "name": record.name, "key": raw, "prefix": prefix, "tier": record.tier}


@router.get("")
def list_keys(user: dict = Depends(require_user)):
    db = get_session()
    try:
        rows = (
            db.query(ApiKey)
            .filter(ApiKey.user_id == user["id"], ApiKey.revoked == 0)
            .order_by(ApiKey.created_at.desc())
            .all()
        )
        return [
            {
                "id": r.id,
                "name": r.name,
                "prefix": r.key_prefix,
                "tier": r.tier,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "last_used_at": r.last_used_at.isoformat() if r.last_used_at else None,
            }
            for r in rows
        ]
    finally:
        db.close()


@router.delete("/{key_id}")
def revoke_key(key_id: int, user: dict = Depends(require_user)):
    db = get_session()
    try:
        record = db.query(ApiKey).filter(ApiKey.id == key_id, ApiKey.user_id == user["id"]).first()
        if record is None:
            raise HTTPException(404, "key not found")
        record.revoked = 1
        db.commit()
    finally:
        db.close()
    return {"status": "revoked"}


def _check_rate_limit(key_id: int, tier: str) -> None:
    """Fixed-window per-hour counter in Redis. No Redis => no rate limiting (fail open)."""
    r = get_redis()
    if r is None:
        return
    window = int(time.time() // 3600)
    redis_key = f"apikey_rl:{key_id}:{window}"
    count = r.incr(redis_key)
    if count == 1:
        r.expire(redis_key, 3600)
    limit = TIER_LIMITS.get(tier, TIER_LIMITS["free"])
    if count > limit:
        raise HTTPException(429, f"rate limit exceeded for {tier} tier ({limit}/hour)")


def require_api_key(request: Request) -> dict:
    """Auth dependency for third-party API consumers (X-API-Key header)."""
    raw = request.headers.get("X-API-Key")
    if not raw:
        raise HTTPException(401, "missing X-API-Key header")

    db = get_session()
    try:
        record = db.query(ApiKey).filter(ApiKey.key_hash == _hash_key(raw), ApiKey.revoked == 0).first()
        if record is None:
            raise HTTPException(401, "invalid API key")

        _check_rate_limit(record.id, record.tier)

        from Backend.db import utcnow
        record.last_used_at = utcnow()
        db.commit()

        return {"id": record.user_id, "api_key_id": record.id, "tier": record.tier}
    finally:
        db.close()


def require_user_or_api_key(request: Request) -> dict:
    """Accepts either a Supabase session bearer token or an X-API-Key header."""
    if request.headers.get("X-API-Key"):
        return require_api_key(request)
    return require_user(request)
