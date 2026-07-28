from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from Backend.jwks import require_user
from Backend.limiter import limiter
from Backend.supabase_admin import update_user_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


class UpdatePasswordBody(BaseModel):
    password: str = Field(..., min_length=8)


@router.post("/update-password")
@limiter.limit("10/minute")
def update_password(request: Request, body: UpdatePasswordBody, user: dict = Depends(require_user)):
    try:
        update_user_password(user["id"], body.password)
    except Exception:
        raise HTTPException(500, "failed to update password")
    return {"status": "ok"}
