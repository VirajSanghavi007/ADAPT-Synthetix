from __future__ import annotations

import re
from datetime import datetime, timezone

from Backend.db import PriorityQueueEntry, get_session

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


def domain_match_count(transcript: str, term_set: set[str] | None = None) -> int:
    if not transcript:
        return 0
    lowered = transcript.lower()
    terms = term_set if term_set is not None else (MEDICAL_TERMS | EMERGENCY_TERMS)
    count = 0
    for term in terms:
        if re.search(rf"\b{re.escape(term)}\b", lowered):
            count += 1
    return count


def compute_priority(confidence: float | None, match_count: int) -> float:
    conf = confidence if confidence is not None else 0.5
    return round((1 - conf) * (1 + 0.5 * match_count), 4)


def enqueue(
    asr_log_id: int | None,
    transcript: str,
    confidence: float | None,
    error_type: str,
    term_set: set[str] | None = None,
) -> int | None:
    if error_type == "clean":
        return None
    match_count = domain_match_count(transcript, term_set)
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


def record_human_review(entry_id: int, importance: int, reviewer_user_id: str) -> bool:
    if not 1 <= importance <= 5:
        raise ValueError("importance must be 1-5")
    db = get_session()
    try:
        entry = db.get(PriorityQueueEntry, entry_id)
        if entry is None:
            return False
        entry.human_importance = importance
        entry.reviewed_at = datetime.now(timezone.utc)
        entry.reviewed_by = reviewer_user_id
        db.commit()
        return True
    except Exception:
        db.rollback()
        return False
    finally:
        db.close()
