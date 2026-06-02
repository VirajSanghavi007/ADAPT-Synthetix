"""
auth.py — Auth layer: Google OAuth, email/name, backdoor.

Routes:
  GET  /auth/login        → Google OAuth redirect
  GET  /auth/callback     → OAuth code exchange → JWT cookie
  POST /auth/email        → email + name sign-in (no verification, trust input)
  POST /auth/backdoor     → owner backdoor (requires BACKDOOR_KEY env var)
  GET  /auth/me           → current user from cookie
  POST /auth/logout       → clear cookie
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import os
import time
import urllib.parse

import httpx
from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────
CLIENT_ID     = os.environ.get("GOOGLE_CLIENT_ID",     "")
CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
SECRET_KEY    = os.environ.get("AUTH_SECRET_KEY",      "change-me-in-production-min-32-chars!!")
REDIRECT_URI  = os.environ.get("AUTH_REDIRECT_URI",    "http://localhost:5000/auth/callback")
AUTH_ENABLED  = os.environ.get("AUTH_ENABLED",         "true").lower() != "false"
BACKDOOR_KEY  = os.environ.get("BACKDOOR_KEY",         "adapt-owner-2024")  # change this
COOKIE_NAME   = "adapt_session"
COOKIE_MAX_AGE = 60 * 60 * 24 * 7   # 7 days

GOOGLE_AUTH_URL  = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO  = "https://www.googleapis.com/oauth2/v3/userinfo"
SCOPES           = "openid email profile"

router = APIRouter(prefix="/auth", tags=["auth"])


# ── Minimal JWT (no external lib) ─────────────────────────────
def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

def _sign(payload: dict) -> str:
    h = json.dumps({"alg": "HS256", "typ": "JWT"}).encode()
    b = json.dumps(payload).encode()
    header, body = _b64url(h), _b64url(b)
    sig = _b64url(hmac.new(SECRET_KEY.encode(), f"{header}.{body}".encode(), hashlib.sha256).digest())
    return f"{header}.{body}.{sig}"

def _verify(token: str) -> dict | None:
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header, body, sig = parts
        expected = _b64url(hmac.new(SECRET_KEY.encode(), f"{header}.{body}".encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, expected):
            return None
        payload = json.loads(base64.urlsafe_b64decode(body + "=="))
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except Exception:
        return None

def _set_cookie(response: Response, payload: dict) -> None:
    jwt = _sign({**payload, "exp": int(time.time()) + COOKIE_MAX_AGE})
    response.set_cookie(
        COOKIE_NAME, jwt,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        samesite="lax",
        secure=REDIRECT_URI.startswith("https"),
    )


# ── Helpers ───────────────────────────────────────────────────
def get_current_user(request: Request) -> dict | None:
    if not AUTH_ENABLED:
        return {"email": "dev@local", "name": "Dev User", "picture": "", "method": "dev"}
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return None
    return _verify(token)

def require_user(request: Request) -> dict:
    user = get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


# ── Google OAuth ──────────────────────────────────────────────
@router.get("/login")
def login():
    if not AUTH_ENABLED:
        return {"message": "Auth disabled — dev mode"}
    if not CLIENT_ID:
        raise HTTPException(503, "GOOGLE_CLIENT_ID not configured. Use email sign-in or backdoor.")
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
async def callback(code: str):
    if not AUTH_ENABLED:
        return {"message": "Auth disabled"}
    async with httpx.AsyncClient() as client:
        token_res = await client.post(GOOGLE_TOKEN_URL, data={
            "code": code, "client_id": CLIENT_ID, "client_secret": CLIENT_SECRET,
            "redirect_uri": REDIRECT_URI, "grant_type": "authorization_code",
        })
        if token_res.status_code != 200:
            raise HTTPException(502, "Failed to exchange token")
        access_token = token_res.json().get("access_token")
        user_res = await client.get(GOOGLE_USERINFO, headers={"Authorization": f"Bearer {access_token}"})
        if user_res.status_code != 200:
            raise HTTPException(502, "Failed to fetch user info")
        u = user_res.json()

    res = RedirectResponse("/")
    _set_cookie(res, {"sub": u.get("sub"), "email": u.get("email"),
                      "name": u.get("name"), "picture": u.get("picture"), "method": "google"})
    return res


# ── Email / name sign-in ──────────────────────────────────────
class EmailSignIn(BaseModel):
    name:              str
    email:             str
    accepted_terms:    bool

@router.post("/email")
def email_signin(body: EmailSignIn, response: Response):
    if not body.accepted_terms:
        raise HTTPException(400, "You must accept the Terms of Service to continue")
    name  = body.name.strip()
    email = body.email.strip().lower()
    if not name:
        raise HTTPException(400, "Name is required")
    if "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(400, "Invalid email address")
    _set_cookie(response, {
        "sub":     f"email:{email}",
        "email":   email,
        "name":    name,
        "picture": "",
        "method":  "email",
    })
    return {"ok": True, "name": name, "email": email}


# ── Owner backdoor ────────────────────────────────────────────
class BackdoorPayload(BaseModel):
    key: str

@router.post("/backdoor")
def backdoor(body: BackdoorPayload, response: Response):
    if not body.key or body.key != BACKDOOR_KEY:
        raise HTTPException(403, "Invalid key")
    _set_cookie(response, {
        "sub":     "owner",
        "email":   "owner@adapt-synthetix",
        "name":    "Owner",
        "picture": "",
        "method":  "backdoor",
        "role":    "admin",
    })
    return {"ok": True}


# ── Session ───────────────────────────────────────────────────
@router.get("/me")
def me(request: Request):
    user = get_current_user(request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    return {
        "email":    user.get("email"),
        "name":     user.get("name"),
        "picture":  user.get("picture"),
        "method":   user.get("method", "unknown"),
        "dev_mode": not AUTH_ENABLED,
    }

@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE_NAME)
    return {"message": "Logged out"}
