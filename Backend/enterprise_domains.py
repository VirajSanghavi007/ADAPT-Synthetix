from __future__ import annotations

from Backend.db import get_session
from Backend.priority_queue import EMERGENCY_TERMS, MEDICAL_TERMS

DOMAINS = ("non_normative", "children")

CHILDREN_TERMS = {
    "hurt", "hurts", "scared", "help me", "lost", "stranger", "bathroom",
    "teacher", "recess", "bully", "bullying", "can't breathe", "allergic",
    "nurse", "fell down", "bleeding", "crying", "home alone", "don't feel good",
    "stomach hurts", "fire drill", "locked out",
}

DOMAIN_TERMS: dict[str, set[str]] = {
    "non_normative": MEDICAL_TERMS | EMERGENCY_TERMS,
    "children": CHILDREN_TERMS,
}


def get_enterprise_status(user_id: str) -> tuple[bool, str | None]:
    from sqlalchemy import text
    from sqlalchemy.exc import OperationalError, ProgrammingError

    db = get_session()
    try:
        row = db.execute(
            text("select is_enterprise, enterprise_domain from profiles where id = :uid"),
            {"uid": user_id},
        ).first()
        if not row:
            return False, None
        return bool(row[0]), row[1]
    except (OperationalError, ProgrammingError):
        db.rollback()
        return False, None
    finally:
        db.close()


def domain_terms(domain: str | None) -> set[str]:
    return DOMAIN_TERMS.get(domain, set())
