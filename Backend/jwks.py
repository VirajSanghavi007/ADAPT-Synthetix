import os
import time

import jwt
from fastapi import HTTPException, Request
from jwt import PyJWKClient

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
if not SUPABASE_URL:
    raise RuntimeError("SUPABASE_URL must be set")

_JWKS_URL = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
_jwk_client = PyJWKClient(_JWKS_URL, cache_keys=True, lifespan=3600)


def verify_token(token: str) -> dict:
    signing_key = _jwk_client.get_signing_key_from_jwt(token)
    payload = jwt.decode(
        token,
        signing_key.key,
        algorithms=["ES256"],
        audience="authenticated",
    )
    return payload


def get_current_user(request: Request) -> dict | None:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    token = auth_header[len("Bearer "):]
    try:
        payload = verify_token(token)
    except Exception:
        return None
    return {"id": payload["sub"], "email": payload.get("email"), "aal": payload.get("aal")}


def _has_mfa_enrolled(user_id: str) -> bool:
    from sqlalchemy import text

    from Backend.db import get_session

    db = get_session()
    try:
        row = db.execute(
            text(
                "select 1 from auth.mfa_factors "
                "where user_id = :uid and status = 'verified' limit 1"
            ),
            {"uid": user_id},
        ).first()
        return row is not None
    finally:
        db.close()


def require_user(request: Request) -> dict:
    user = get_current_user(request)
    if user is None:
        raise HTTPException(401, "not authenticated")
    if user["aal"] != "aal2" and _has_mfa_enrolled(user["id"]):
        raise HTTPException(401, "MFA challenge required")
    return user


def require_user_id(request: Request) -> str:
    return require_user(request)["id"]
