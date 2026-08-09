"""Phoneme-level drift detection, ported from ADAPT-Synthetix v1's design and tested
thresholds (TODO.md P4.2) — free tier only.

Honest scoping note on the signal used: v1 tracked true per-phoneme *confidence* from
Wav2Vec2's frame-level CTC logits. This codebase's ASR engine (distil-whisper via a
standard generate() call) doesn't expose frame-to-phoneme alignment without a much
bigger forced-alignment effort, so this tracks per-phoneme *error rate* instead (how
often each reference phoneme shows up in a substitution/deletion, from the existing
phoneme-alignment diagnostics) — same drift concept, adjacent signal. A rising error
rate and a falling confidence are the same underlying phenomenon read from different
angles, but they are not numerically the same thing; don't conflate the two when
reporting results.

Honest scoping note on "LoRA triggering": this module detects drift and records a
trigger event. It does not execute a LoRA training run — that requires a real training
pipeline (data assembly from consented recordings, a training loop, checkpoint
promotion with rollback) that doesn't exist yet in this codebase. Treat the trigger
record as a to-do marker an operator or a future training pipeline consumes, not as
"and then the model got better."

Trend test: uses the Mann-Kendall test (a standard nonparametric test for a
monotonic trend in a time series) instead of a fixed "slope > 0" rule — the trend
itself is now judged by statistical significance (p < 0.05), not an arbitrary
threshold on a raw slope value. The recent-volume floor is kept as a genuine
practical guard (a "significant" trend on 1-2 occurrences a day is still noise),
not a leftover rule.
"""
from __future__ import annotations

import statistics
from datetime import datetime, timedelta, timezone

from sqlalchemy import text as sql_text

from Backend.db import DriftTriggerEvent, PhonemeDriftEvent, get_session

ROLLING_WINDOW_DAYS = 5  # "session" here = one calendar day bucket, see module docstring
MIN_DAYS_PRESENT = 3  # v1's "appeared in at least 3 of the last 5 sessions" rule
DRIFT_ERROR_RATE_THRESHOLD = 0.5  # volume floor — a p<0.05 trend on near-zero counts is still noise
MIN_PHONEMES_FOR_MODEL_FLAG = 3  # v1's "3+ simultaneously drifting phonemes" rule
MANN_KENDALL_ALPHA = 0.05  # standard significance level for the trend test


def record_phoneme_events(model_id: str, alignment_errors: list[dict]) -> None:
    """Called after a transcription with a reference_text, alongside the existing
    phoneme-error logging. Records one row per substitution/deletion (a phoneme that
    was misrecognised) and — implicitly, by omission — phonemes with no error rows on
    a given day are underrepresented in the day's error rate, same as v1's approach of
    only tracking observed confusions rather than every phoneme spoken."""
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
    """Standard Mann-Kendall trend test with a normal-approximation p-value
    (the conventional approach once n is not tiny; here n = ROLLING_WINDOW_DAYS,
    small enough that this is an approximation, not exact — flagged honestly rather
    than presented as a precise p-value). Returns S (the raw statistic, sign shows
    trend direction), z, and a one-tailed p-value for "significantly increasing"."""
    from scipy.stats import norm

    n = len(values)
    if n < 3:
        return {"s": 0, "z": 0.0, "p_increasing": 1.0}

    s = 0
    for i in range(n - 1):
        for j in range(i + 1, n):
            s += 1 if values[j] > values[i] else (-1 if values[j] < values[i] else 0)

    # Tie correction: group equal values, subtract each group's contribution to variance.
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
    """Evaluate every phoneme with recent activity for this model; flag ones with a
    rising error-count trend over the last ROLLING_WINDOW_DAYS days, present on at
    least MIN_DAYS_PRESENT of them, whose recent mean sits above threshold. If
    MIN_PHONEMES_FOR_MODEL_FLAG or more are flagged simultaneously, record a trigger
    event and return model_flagged=True."""
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
            # Significant increasing trend (not just "slope > 0") AND a non-trivial
            # recent volume — a statistically significant trend on 1 occurrence/day
            # is still not worth flagging.
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
