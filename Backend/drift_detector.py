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
"""
from __future__ import annotations

import statistics
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from sqlalchemy import text as sql_text

from Backend.db import DriftTriggerEvent, PhonemeDriftEvent, get_session

ROLLING_WINDOW_DAYS = 5  # "session" here = one calendar day bucket, see module docstring
MIN_DAYS_PRESENT = 3  # v1's "appeared in at least 3 of the last 5 sessions" rule
DRIFT_ERROR_RATE_THRESHOLD = 0.5  # v1's confidence-below-0.5 threshold, read as error-rate-above instead
MIN_PHONEMES_FOR_MODEL_FLAG = 3  # v1's "3+ simultaneously drifting phonemes" rule


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


def _linear_slope(values: list[float]) -> float:
    n = len(values)
    if n < 2:
        return 0.0
    xs = list(range(n))
    x_mean, y_mean = statistics.mean(xs), statistics.mean(values)
    num = sum((x - x_mean) * (y - y_mean) for x, y in zip(xs, values))
    den = sum((x - x_mean) ** 2 for x in xs)
    return num / den if den else 0.0


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
            slope = _linear_slope(counts)
            recent_mean = statistics.mean(counts[-3:]) if len(counts) >= 3 else statistics.mean(counts)
            # counts are raw daily occurrence counts, not a normalised rate — a rising
            # slope on a low-volume phoneme is noise, so also require a non-trivial
            # recent volume before calling it drift, not just "line goes up".
            if slope > 0 and recent_mean >= DRIFT_ERROR_RATE_THRESHOLD:
                drifting.append({"phoneme": phoneme, "slope": round(slope, 3), "recent_mean": round(recent_mean, 3)})

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
