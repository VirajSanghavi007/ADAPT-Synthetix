"""
auth.py — Google OAuth2 + JWT session.

Flow:
  GET /auth/login         → redirect to Google consent screen
  GET /auth/callback      → exchange code → create JWT → set httpOnly cookie
  GET /auth/me            → return current user from cookie
  POST /auth/logout       → clear cookie

Required env vars:
  GOOGLE_CLIENT_ID
  GOOGLE_CLIENT_SECRET
  AUTH_SECRET_KEY         → random 32-char string for JWT signing
  AUTH_REDIRECT_URI       → must match Google Cloud Console (e.g. http://localhost:5000/auth/callback)
  AUTH_ENABLED            → set "false" to disable auth entirely (dev mode)
"""
from __future__ import annotations

import os
import time
import urllib.parse
import logging

import httpx
from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import RedirectResponse

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────
CLIENT_ID      = os.environ.get("GOOGLE_CLIENT_ID", "")
CLIENT_SECRET  = os.environ.get("GOOGLE_CLIENT_SECRET", "")
SECRET_KEY     = os.environ.get("AUTH_SECRET_KEY", "change-me-in-production-min-32-chars!!")
REDIRECT_URI   = os.environ.get("AUTH_REDIRECT_URI", "http://localhost:5000/auth/callback")
AUTH_ENABLED   = os.environ.get("AUTH_ENABLED", "true").lower() != "false"
COOKIE_NAME    = "adapt_session"
COOKIE_MAX_AGE = 60 * 60 * 24 * 7  # 7 days

GOOGLE_AUTH_URL  = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO  = "https://www.googleapis.com/oauth2/v3/userinfo"
SCOPES           = "openid email profile"

router = APIRouter(prefix="/auth", tags=["auth"])


# ── JWT (minimal, no external lib needed) ────────────────────
import base64
import hashlib
import hmac
import json


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _sign(payload: dict, secret: str) -> str:
    header  = _b64url(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    body    = _b64url(json.dumps(payload).encode())
    sig     = _b64url(hmac.new(secret.encode(), f"{header}.{body}".encode(), hashlib.sha256).digest())
    return f"{header}.{body}.{sig}"


def _verify(token: str, secret: str) -> dict | None:
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header, body, sig = parts
        expected = _b64url(hmac.new(secret.encode(), f"{header}.{body}".encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, expected):
            return None
        payload = json.loads(base64.urlsafe_b64decode(body + "=="))
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None


# ── Helpers ───────────────────────────────────────────────────
def get_current_user(request: Request) -> dict | None:
    """Extract and verify the session cookie. Returns user dict or None."""
    if not AUTH_ENABLED:
        return {"email": "dev@local", "name": "Dev User", "picture": ""}
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return None
    return _verify(token, SECRET_KEY)


def require_user(request: Request) -> dict:
    """Raise 401 if not authenticated."""
    user = get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


# ── Routes ────────────────────────────────────────────────────

@router.get("/login")
def login(request: Request):
    """Redirect to Google consent screen."""
    if not AUTH_ENABLED:
        return {"message": "Auth disabled — dev mode"}
    if not CLIENT_ID:
        raise HTTPException(503, "GOOGLE_CLIENT_ID not configured")

    params = urllib.parse.urlencode({
        "client_id":     CLIENT_ID,
        "redirect_uri":  REDIRECT_URI,
        "response_type": "code",
        "scope":         SCOPES,
        "access_type":   "offline",
        "prompt":        "select_account",
    })
    return RedirectResponse(f"{GOOGLE_AUTH_URL}?{params}")


@router.get("/callback")
async def callback(code: str, response: Response):
    """Exchange OAuth code for tokens, set session cookie."""
    if not AUTH_ENABLED:
        return {"message": "Auth disabled"}

    async with httpx.AsyncClient() as client:
        # Exchange code for tokens
        token_res = await client.post(GOOGLE_TOKEN_URL, data={
            "code":          code,
            "client_id":     CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "redirect_uri":  REDIRECT_URI,
            "grant_type":    "authorization_code",
        })
        if token_res.status_code != 200:
            raise HTTPException(502, "Failed to exchange token with Google")

        access_token = token_res.json().get("access_token")

        # Fetch user info
        user_res = await client.get(GOOGLE_USERINFO, headers={"Authorization": f"Bearer {access_token}"})
        if user_res.status_code != 200:
            raise HTTPException(502, "Failed to fetch user info from Google")

        user = user_res.json()

    # Create session JWT
    payload = {
        "sub":     user.get("sub"),
        "email":   user.get("email"),
        "name":    user.get("name"),
        "picture": user.get("picture"),
        "exp":     int(time.time()) + COOKIE_MAX_AGE,
    }
    jwt = _sign(payload, SECRET_KEY)

    # Redirect to app with cookie set
    res = RedirectResponse("/")
    res.set_cookie(
        COOKIE_NAME, jwt,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=REDIRECT_URI.startswith("https"),
    )
    return res


@router.get("/me")
def me(request: Request):
    """Return current user info (used by frontend to check auth state)."""
    user = get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {
        "email":    user.get("email"),
        "name":     user.get("name"),
        "picture":  user.get("picture"),
        "dev_mode": not AUTH_ENABLED,
    }


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE_NAME)
    return {"message": "Logged out"}
