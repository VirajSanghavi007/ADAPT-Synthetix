import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text

from Backend.db import get_session
from Backend.jwks import require_user

router = APIRouter(prefix="/api/profile", tags=["profile"])

USERNAME_RE = re.compile(r"^[a-z0-9_]{3,20}$")


@router.get("")
def get_profile(user: dict = Depends(require_user)):
    db = get_session()
    try:
        row = db.execute(
            text("select username, display_name, avatar_id, tier, is_enterprise from profiles where id = :uid"),
            {"uid": user["id"]},
        ).first()
        if row is None:
            raise HTTPException(404, "profile not found")
        return {
            "username": row[0],
            "display_name": row[1],
            "avatar_id": row[2],
            "tier": row[3],
            "is_enterprise": row[4],
        }
    finally:
        db.close()


class UpdateProfileRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=20)
    avatar_id: int = Field(..., ge=1, le=10)
    display_name: str | None = Field(None, max_length=100)


@router.patch("")
def update_profile(req: UpdateProfileRequest, user: dict = Depends(require_user)):
    if not USERNAME_RE.match(req.username):
        raise HTTPException(400, "username must be 3-20 lowercase letters, numbers, or underscores")

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
                "display_name = coalesce(:display_name, display_name) where id = :uid"
            ),
            {
                "username": req.username,
                "avatar_id": req.avatar_id,
                "display_name": req.display_name,
                "uid": user["id"],
            },
        )
        db.commit()
    finally:
        db.close()

    return {"status": "ok"}
