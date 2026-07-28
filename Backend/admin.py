from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text

from Backend.db import get_session
from Backend.jwks import require_user

router = APIRouter(prefix="/api/admin", tags=["admin"])


def require_admin(user: dict = Depends(require_user)) -> dict:
    db = get_session()
    try:
        row = db.execute(
            text("select role from profiles where id = :uid"),
            {"uid": user["id"]},
        ).first()
        if row is None or row[0] != "admin":
            raise HTTPException(403, "admin access required")
        return user
    finally:
        db.close()


def _log_admin_action(admin_id: str, action: str, target_user_id: str | None = None):
    db = get_session()
    try:
        db.execute(
            text(
                "insert into admin_audit_log (admin_id, action, target_user_id) "
                "values (:admin_id, :action, :target_user_id)"
            ),
            {"admin_id": admin_id, "action": action, "target_user_id": target_user_id},
        )
        db.commit()
    finally:
        db.close()


@router.get("/users")
def list_users(admin: dict = Depends(require_admin)):
    _log_admin_action(admin["id"], "list_users")
    db = get_session()
    try:
        rows = db.execute(
            text("select id, display_name, role, created_at from profiles order by created_at desc")
        ).all()
        return [
            {"id": str(r[0]), "display_name": r[1], "role": r[2], "created_at": r[3].isoformat()}
            for r in rows
        ]
    finally:
        db.close()


@router.get("/users/{user_id}")
def get_user(user_id: str, admin: dict = Depends(require_admin)):
    _log_admin_action(admin["id"], "view_user", target_user_id=user_id)
    db = get_session()
    try:
        row = db.execute(
            text("select id, display_name, role, created_at from profiles where id = :uid"),
            {"uid": user_id},
        ).first()
        if row is None:
            raise HTTPException(404, "user not found")
        return {"id": str(row[0]), "display_name": row[1], "role": row[2], "created_at": row[3].isoformat()}
    finally:
        db.close()


@router.get("/audit-log")
def get_audit_log(admin: dict = Depends(require_admin)):
    db = get_session()
    try:
        rows = db.execute(
            text(
                "select id, admin_id, action, target_user_id, created_at "
                "from admin_audit_log order by created_at desc limit 200"
            )
        ).all()
        return [
            {
                "id": r[0],
                "admin_id": str(r[1]),
                "action": r[2],
                "target_user_id": str(r[3]) if r[3] else None,
                "created_at": r[4].isoformat(),
            }
            for r in rows
        ]
    finally:
        db.close()
