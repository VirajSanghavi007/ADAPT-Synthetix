"""Closed-loop, phoneme-pair targeted TTS remediation, ported from ADAPT-Synthetix v1's
design (TODO.md P4.8) — free tier only (uses the free-tier TTS model, kokoro).

v1 mapped a confused phoneme pair to a natural-sentence prompt emphasising that
contrast, synthesised it, and stored the result as remedial training data. This module
does the same three steps, minus the actual LoRA retraining consumption of the result
(that's drift_detector.py's trigger + a future training pipeline, not this module's job
— this module's job ends at "corrective audio exists and is stored").
"""
from __future__ import annotations

import os
import uuid

from Backend.asr_pipeline import synthesize_speech
from Backend.db import RemedialAudio, get_session

REMEDIAL_AUDIO_DIR = "Backend/data/remedial_audio"

# Minimal-pair-flavoured carrier sentences per phoneme, so the corrective audio
# contrasts the target sound in context rather than reading an isolated phoneme,
# which both synthesises poorly and is a worse training signal (v1's finding).
_CARRIER_TEMPLATES = {
    "TH": "Think carefully about the thing you just said.",
    "DH": "This is the way things are done.",
    "S": "Sam saw the sun set slowly.",
    "Z": "The zoo has zebras and lizards.",
    "V": "Every voice deserves to be heard.",
    "F": "Fish swim fast in the fresh water.",
    "R": "Robert runs around the red road.",
    "L": "Little Lily likes long lists.",
    "P": "Peter picked a peck of pickled peppers.",
    "B": "Bob bought a big blue boat.",
}
_DEFAULT_CARRIER = "Please listen carefully to this sentence."


def _carrier_sentence(reference_phoneme: str) -> str:
    base = (reference_phoneme or "").rstrip("012")
    return _CARRIER_TEMPLATES.get(base, _DEFAULT_CARRIER)


def generate_remediation(
    transcription_id: int | None,
    reference_phoneme: str,
    hypothesis_phoneme: str,
    model_id: str,
) -> dict | None:
    """Synthesise one corrective audio sample targeting a confused phoneme pair and
    persist it. Returns the stored record's metadata, or None on any failure — this
    is best-effort background remediation, never allowed to break the caller's
    primary transcribe response."""
    try:
        sentence = _carrier_sentence(reference_phoneme)
        audio_bytes = synthesize_speech(sentence, voice="", model_id="kokoro")
        if not audio_bytes:
            return None

        os.makedirs(REMEDIAL_AUDIO_DIR, exist_ok=True)
        filename = f"{uuid.uuid4().hex}.mp3"
        path = os.path.join(REMEDIAL_AUDIO_DIR, filename)
        with open(path, "wb") as f:
            f.write(audio_bytes)

        db = get_session()
        try:
            record = RemedialAudio(
                transcription_id=transcription_id,
                reference_phoneme=reference_phoneme,
                hypothesis_phoneme=hypothesis_phoneme,
                carrier_text=sentence,
                audio_path=path,
                model_id=model_id,
            )
            db.add(record)
            db.commit()
            db.refresh(record)
            return {
                "id": record.id,
                "audio_path": path,
                "carrier_text": sentence,
                "reference_phoneme": reference_phoneme,
                "hypothesis_phoneme": hypothesis_phoneme,
            }
        except Exception:
            db.rollback()
            return None
        finally:
            db.close()
    except Exception:
        return None


def worst_phoneme_pair(alignment_errors: list[dict]) -> tuple[str, str] | None:
    """Pick the substitution error to target for remediation — first substitution
    found, since align_phoneme_errors() already returns them in sequence order and
    this module runs per-call rather than aggregating across a corpus (that
    aggregation is build_error_report()'s systematic-confusion job, upstream of
    this)."""
    for err in alignment_errors:
        if err["operation"] == "substitution" and err["reference"] and err["hypothesis"]:
            return err["reference"], err["hypothesis"]
    return None
