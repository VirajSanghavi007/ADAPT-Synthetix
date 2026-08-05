import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text

from Backend.db import get_session
from Backend.jwks import require_user

router = APIRouter(prefix="/api/profile", tags=["profile"])

USERNAME_RE = re.compile(r"^[a-z0-9_]{3,20}$")

# ~200KB image as base64 — enough for a small profile photo without letting the
# DB row balloon. No object storage bucket is provisioned yet (see migration 014).
MAX_AVATAR_URL_LEN = 300_000
ALLOWED_AVATAR_MIME_PREFIXES = ("data:image/png;base64,", "data:image/jpeg;base64,", "data:image/webp;base64,")


@router.get("")
def get_profile(user: dict = Depends(require_user)):
    db = get_session()
    try:
        row = db.execute(
            text(
                "select username, display_name, avatar_id, avatar_url, tier, is_enterprise, role "
                "from profiles where id = :uid"
            ),
            {"uid": user["id"]},
        ).first()
        if row is None:
            raise HTTPException(404, "profile not found")
        return {
            "username": row[0],
            "display_name": row[1],
            "avatar_id": row[2],
            "avatar_url": row[3],
            "tier": row[4],
            "is_enterprise": row[5],
            "role": row[6],
        }
    finally:
        db.close()


class UpdateProfileRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=20)
    avatar_id: int | None = Field(None, ge=1, le=10)
    avatar_url: str | None = Field(None, max_length=MAX_AVATAR_URL_LEN)
    display_name: str | None = Field(None, max_length=100)


@router.patch("")
def update_profile(req: UpdateProfileRequest, user: dict = Depends(require_user)):
    if not USERNAME_RE.match(req.username):
        raise HTTPException(400, "username must be 3-20 lowercase letters, numbers, or underscores")
    if req.avatar_id is None and not req.avatar_url:
        raise HTTPException(400, "pick a preset avatar or upload a photo")
    if req.avatar_url and not req.avatar_url.startswith(ALLOWED_AVATAR_MIME_PREFIXES):
        raise HTTPException(400, "avatar photo must be PNG, JPEG, or WebP")

    db = get_session()
    try:
        existing = db.execute(
            text("select id from profiles where username = :u and id != :uid"),
            {"u": req.username, "uid": user["id"]},
        ).first()
        if existing is not None:
            raise HTTPException(409, "username already taken")

        db.execute(
            text(
                "update profiles set username = :username, avatar_id = :avatar_id, "
                "avatar_url = :avatar_url, "
                "display_name = coalesce(:display_name, display_name) where id = :uid"
            ),
            {
                "username": req.username,
                "avatar_id": req.avatar_id,
                "avatar_url": req.avatar_url,
                "display_name": req.display_name,
                "uid": user["id"],
            },
        )
        db.commit()
    finally:
        db.close()

    return {"status": "ok"}
