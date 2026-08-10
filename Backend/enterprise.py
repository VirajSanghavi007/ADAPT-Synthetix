import hashlib

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text

from Backend.db import get_session
from Backend.jwks import require_user

router = APIRouter(prefix="/api/enterprise", tags=["enterprise"])


def _hash_id(employee_id: str) -> str:
    return hashlib.sha256(employee_id.strip().encode()).hexdigest()


class RegisterRequest(BaseModel):
    company_name: str = Field(..., min_length=1, max_length=200)
    role: str = Field(..., min_length=1, max_length=100)
    employee_id: str = Field(..., min_length=3, max_length=100)
    domain: str = Field(..., pattern="^(non_normative|children)$")


@router.post("/register")
def register_enterprise(req: RegisterRequest, user: dict = Depends(require_user)):
    db = get_session()
    try:
        db.execute(
            text(
                "update profiles set is_enterprise = true, tier = 'enterprise', "
                "company_name = :company_name, enterprise_role = :role, "
                "enterprise_employee_id_hash = :id_hash, enterprise_domain = :domain "
                "where id = :uid"
            ),
            {
                "company_name": req.company_name,
                "role": req.role,
                "id_hash": _hash_id(req.employee_id),
                "domain": req.domain,
                "uid": user["id"],
            },
        )
        db.commit()
    finally:
        db.close()
    return {"status": "ok", "domain": req.domain}


class VerifyIdRequest(BaseModel):
    employee_id: str = Field(..., min_length=1, max_length=100)


@router.post("/verify-id")
def verify_employee_id(req: VerifyIdRequest, user: dict = Depends(require_user)):
    db = get_session()
    try:
        row = db.execute(
            text("select enterprise_employee_id_hash from profiles where id = :uid"),
            {"uid": user["id"]},
        ).first()
    finally:
        db.close()

    if row is None or not row[0]:
        raise HTTPException(400, "no employee ID on file for this account")

    verified = _hash_id(req.employee_id) == row[0]
    return {"verified": verified}
