"""Domain-critical priority queue, ported from ADAPT-Synthetix v1's design and
validated formula (TODO.md P4.7) — free tier only.

Honest scoping note: v1 curated ~800 medical terms and ~120 emergency phrases. This is
a smaller seed list covering the same two categories, meant to prove the mechanism
works end-to-end — expand it before relying on the domain_match_count for anything
beyond a demo. Word lists live here as plain Python sets rather than files, since
they're short enough that a separate data file would just add an extra place to look.
"""
from __future__ import annotations

import re

from Backend.db import PriorityQueueEntry, get_session

# Seed list — expand before production use. Lowercase, matched as whole words.
MEDICAL_TERMS = {
    "aspirin", "ibuprofen", "acetaminophen", "paracetamol", "insulin", "metformin",
    "lisinopril", "atorvastatin", "amoxicillin", "penicillin", "warfarin", "morphine",
    "oxycodone", "prednisone", "albuterol", "hypertension", "diabetes", "asthma",
    "stroke", "seizure", "chest pain", "shortness of breath", "blood pressure",
    "heart rate", "allergic reaction", "anaphylaxis", "dosage", "milligrams",
    "prescription", "diagnosis", "symptom", "fracture", "infection", "bleeding",
    "unconscious", "overdose", "cardiac arrest", "diabetic", "epilepsy",
}

EMERGENCY_TERMS = {
    "fire", "help", "emergency", "ambulance", "police", "911", "112", "gunshot",
    "accident", "collapsed", "not breathing", "trapped", "flooding", "gas leak",
    "explosion", "assault", "intruder", "evacuate", "hazard", "injured", "danger",
    "call for help", "send help",
}

_WORD_RE = re.compile(r"[a-z0-9]+(?:\s+[a-z0-9]+)*")


def domain_match_count(transcript: str) -> int:
    """Case-insensitive whole-phrase match count against both term sets."""
    if not transcript:
        return 0
    lowered = transcript.lower()
    count = 0
    for term in MEDICAL_TERMS | EMERGENCY_TERMS:
        # word-boundary match so "aspirin" doesn't match inside a longer token
        if re.search(rf"\b{re.escape(term)}\b", lowered):
            count += 1
    return count


def compute_priority(confidence: float | None, match_count: int) -> float:
    """priority = (1 - confidence) * (1 + 0.5 * domain_match_count) — v1's validated
    formula (measured 1.8-2.7x separation between domain-matched and non-domain
    utterances at equal confidence). confidence=None (engine gave no signal) is
    treated as 0.5 (neutral) rather than 0 or 1, to avoid the formula silently
    maxing or zeroing out priority when we simply don't know the confidence."""
    conf = confidence if confidence is not None else 0.5
    return round((1 - conf) * (1 + 0.5 * match_count), 4)


def enqueue(
    asr_log_id: int | None,
    transcript: str,
    confidence: float | None,
    error_type: str,
) -> int | None:
    """Insert a priority-queue entry for a non-clean transcription. Best-effort, same
    reasoning as the rest of this codebase's logging: a queue-insert failure must
    never turn an already-successful transcription into an error for the caller."""
    if error_type == "clean":
        return None
    match_count = domain_match_count(transcript)
    priority = compute_priority(confidence, match_count)

    db = get_session()
    try:
        entry = PriorityQueueEntry(
            asr_log_id=asr_log_id,
            priority_score=priority,
            domain_match_count=match_count,
            error_type=error_type,
            status="pending",
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)
        return entry.id
    except Exception:
        db.rollback()
        return None
    finally:
        db.close()
