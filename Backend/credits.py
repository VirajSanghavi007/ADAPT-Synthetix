"""Usage credits — the actual per-request allowance, separate from the hourly burst
rate limits in tiers.py. Tracking/accounting only, same as the rest of the app's
mock-Stripe billing (Subscription page) — no real payment processing happens here.

free: fixed pool, renews every 5 hours.
pro:  fixed pool, renews weekly.
max:  larger fixed pool, renews weekly.
enterprise: no pool — pay-per-use, metered from asr_logs/tts_logs directly instead
  of a credits_remaining balance (see get_enterprise_usage).
"""
from datetime import timedelta

from fastapi import HTTPException
from sqlalchemy import text

from Backend.db import get_session, utcnow

CREDIT_POOLS = {
    "free": {"total": 50, "cycle": timedelta(hours=5)},
    "pro": {"total": 2000, "cycle": timedelta(weeks=1)},
    "max": {"total": 10000, "cycle": timedelta(weeks=1)},
}

# Rough per-request credit cost — flat for now (matches the flat rate-limit model in
# tiers.py); could later scale with audio duration / text length.
CREDIT_COST_PER_REQUEST = 1

# Illustrative per-request price for enterprise/API pay-per-use display — not a real
# charge, just what the usage dashboard shows as "would have cost".
PAY_PER_USE_RATE_USD = 0.01


def check_and_deduct_credit(user_id: str, tier: str) -> None:
    """Enterprise is pay-per-use (metered, not pooled) — nothing to deduct. Every
    other tier draws from its pool, lazily resetting it if the cycle has elapsed."""
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
            return  # profile missing — let the request through, tier lookup already degrades elsewhere

        remaining, total, cycle_started_at = row
        now = utcnow()
        # Reset on cycle expiry, or if the stored pool doesn't match this tier's —
        # e.g. a row still holding the migration's generic column default from
        # before it was ever evaluated against a real tier, or a tier change.
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
        # Best-effort, same reasoning as tiers.py/mlops.py — a credits-ledger hiccup
        # must not block a request that would otherwise succeed.
        db.rollback()
    finally:
        db.close()


def get_credit_status(user_id: str, tier: str) -> dict:
    """For the Subscription/Settings page — current balance and reset time."""
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
    """Pay-per-use metering for enterprise/API consumers — sums real request counts
    from the actual log tables and multiplies by the illustrative rate. Not a real
    invoice, just what the usage dashboard shows."""
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
