from __future__ import annotations

import statistics
from datetime import datetime, timedelta, timezone

from sqlalchemy import text as sql_text

from Backend.db import DriftTriggerEvent, PhonemeDriftEvent, get_session

ROLLING_WINDOW_DAYS = 5
MIN_DAYS_PRESENT = 3
DRIFT_ERROR_RATE_THRESHOLD = 0.5
MIN_PHONEMES_FOR_MODEL_FLAG = 3
MANN_KENDALL_ALPHA = 0.05


def record_phoneme_events(model_id: str, alignment_errors: list[dict]) -> None:
    if not alignment_errors:
        return
    today = datetime.now(timezone.utc).date()
    db = get_session()
    try:
        for err in alignment_errors:
            if err["operation"] not in ("substitution", "deletion"):
                continue
            phoneme = err["reference"]
            if not phoneme:
                continue
            db.add(PhonemeDriftEvent(model_id=model_id, phoneme=phoneme, day=today))
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


def _daily_error_rates(db, model_id: str, phoneme: str, since_day) -> list[tuple[object, int]]:
    rows = db.execute(
        sql_text(
            """
            select day, count(*) as n
            from phoneme_drift_events
            where model_id = :model_id and phoneme = :phoneme and day >= :since_day
            group by day
            order by day
            """
        ),
        {"model_id": model_id, "phoneme": phoneme, "since_day": since_day},
    ).all()
    return [(r[0], r[1]) for r in rows]


def _mann_kendall(values: list[float]) -> dict:
    from scipy.stats import norm

    n = len(values)
    if n < 3:
        return {"s": 0, "z": 0.0, "p_increasing": 1.0}

    s = 0
    for i in range(n - 1):
        for j in range(i + 1, n):
            s += 1 if values[j] > values[i] else (-1 if values[j] < values[i] else 0)

    unique_vals, counts = {}, []
    for v in values:
        unique_vals[v] = unique_vals.get(v, 0) + 1
    tie_term = sum(t * (t - 1) * (2 * t + 5) for t in unique_vals.values())
    var_s = (n * (n - 1) * (2 * n + 5) - tie_term) / 18.0

    if var_s <= 0:
        return {"s": s, "z": 0.0, "p_increasing": 1.0}

    if s > 0:
        z = (s - 1) / (var_s ** 0.5)
    elif s < 0:
        z = (s + 1) / (var_s ** 0.5)
    else:
        z = 0.0

    p_increasing = 1 - norm.cdf(z) if z > 0 else 1.0
    return {"s": s, "z": round(z, 3), "p_increasing": round(float(p_increasing), 4)}


def check_drift(model_id: str) -> dict:
    since_day = (datetime.now(timezone.utc) - timedelta(days=ROLLING_WINDOW_DAYS)).date()
    db = get_session()
    try:
        phoneme_rows = db.execute(
            sql_text(
                "select distinct phoneme from phoneme_drift_events where model_id = :model_id and day >= :since_day"
            ),
            {"model_id": model_id, "since_day": since_day},
        ).all()
        phonemes = [r[0] for r in phoneme_rows]

        drifting = []
        for phoneme in phonemes:
            daily = _daily_error_rates(db, model_id, phoneme, since_day)
            if len(daily) < MIN_DAYS_PRESENT:
                continue
            counts = [n for _, n in daily]
            trend = _mann_kendall(counts)
            recent_mean = statistics.mean(counts[-3:]) if len(counts) >= 3 else statistics.mean(counts)
            if trend["p_increasing"] < MANN_KENDALL_ALPHA and recent_mean >= DRIFT_ERROR_RATE_THRESHOLD:
                drifting.append({
                    "phoneme": phoneme,
                    "mann_kendall_s": trend["s"],
                    "p_value": trend["p_increasing"],
                    "recent_mean": round(recent_mean, 3),
                })

        model_flagged = len(drifting) >= MIN_PHONEMES_FOR_MODEL_FLAG
        if model_flagged:
            db.add(
                DriftTriggerEvent(
                    model_id=model_id,
                    drifting_phonemes=",".join(d["phoneme"] for d in drifting),
                    reason=f"{len(drifting)} phonemes with rising error trend over {ROLLING_WINDOW_DAYS}d",
                )
            )
            db.commit()

        return {"model_id": model_id, "drifting_phonemes": drifting, "model_flagged": model_flagged}
    finally:
        db.close()
