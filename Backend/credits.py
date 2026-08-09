from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy import text

from Backend.db import get_session, utcnow

CREDIT_POOLS = {
    "free": {"total": 50, "cycle": timedelta(hours=5)},
    "pro": {"total": 2000, "cycle": timedelta(weeks=1)},
    "max": {"total": 10000, "cycle": timedelta(weeks=1)},
}

CREDIT_COST_PER_REQUEST = 1

PAY_PER_USE_RATE_USD = 0.01


def check_and_deduct_credit(user_id: str, tier: str) -> None:
    if tier not in CREDIT_POOLS:
        return

    pool = CREDIT_POOLS[tier]
    db = get_session()
    try:
        row = db.execute(
            text(
                "select credits_remaining, credits_total, credits_cycle_started_at "
                "from profiles where id = :uid"
            ),
            {"uid": user_id},
        ).first()
        if row is None:
            return

        remaining, total, cycle_started_at = row
        now = utcnow()
        if cycle_started_at is None or now - cycle_started_at >= pool["cycle"] or total != pool["total"]:
            remaining = pool["total"]
            cycle_started_at = now
            db.execute(
                text(
                    "update profiles set credits_remaining = :r, credits_total = :t, "
                    "credits_cycle_started_at = :c where id = :uid"
                ),
                {"r": remaining, "t": pool["total"], "c": cycle_started_at, "uid": user_id},
            )
            db.commit()

        if remaining < CREDIT_COST_PER_REQUEST:
            raise HTTPException(
                402,
                f"out of credits for this cycle ({pool['total']} per "
                f"{'5 hours' if tier == 'free' else 'week'}) — resets "
                f"{(cycle_started_at + pool['cycle']).isoformat()}",
            )

        db.execute(
            text("update profiles set credits_remaining = credits_remaining - :c where id = :uid"),
            {"c": CREDIT_COST_PER_REQUEST, "uid": user_id},
        )
        db.commit()
    except HTTPException:
        raise
    except Exception:
        db.rollback()
    finally:
        db.close()


def get_credit_status(user_id: str, tier: str) -> dict:
    if tier not in CREDIT_POOLS:
        return {"pooled": False, "tier": tier}

    pool = CREDIT_POOLS[tier]
    db = get_session()
    try:
        row = db.execute(
            text("select credits_remaining, credits_total, credits_cycle_started_at from profiles where id = :uid"),
            {"uid": user_id},
        ).first()
    finally:
        db.close()
    if row is None:
        return {"pooled": False, "tier": tier}
    remaining, total, cycle_started_at = row
    resets_at = (cycle_started_at + pool["cycle"]) if cycle_started_at else None
    return {
        "pooled": True,
        "tier": tier,
        "remaining": remaining,
        "total": total,
        "resets_at": resets_at.isoformat() if resets_at else None,
    }


def get_enterprise_usage(user_id: str) -> dict:
    db = get_session()
    try:
        asr_count = db.execute(
            text("select count(*) from asr_logs where user_id = :uid"), {"uid": user_id}
        ).scalar()
        tts_count = db.execute(
            text("select count(*) from tts_logs where user_id = :uid"), {"uid": user_id}
        ).scalar()
    finally:
        db.close()
    total_requests = (asr_count or 0) + (tts_count or 0)
    return {
        "pooled": False,
        "asr_requests": asr_count or 0,
        "tts_requests": tts_count or 0,
        "total_requests": total_requests,
        "estimated_cost_usd": round(total_requests * PAY_PER_USE_RATE_USD, 2),
        "rate_usd_per_request": PAY_PER_USE_RATE_USD,
    }
