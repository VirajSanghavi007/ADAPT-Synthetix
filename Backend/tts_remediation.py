from __future__ import annotations

import os
import uuid

from sqlalchemy import text as sql_text

from Backend.asr_pipeline import synthesize_speech
from Backend.db import RemedialAudio, get_session

REMEDIAL_AUDIO_DIR = "Backend/data/remedial_audio"

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
    substitutions = [
        (e["reference"], e["hypothesis"])
        for e in alignment_errors
        if e["operation"] == "substitution" and e["reference"] and e["hypothesis"]
    ]
    if not substitutions:
        return None
    if len(substitutions) == 1:
        return substitutions[0]

    db = get_session()
    try:
        rows = db.execute(
            sql_text(
                "select reference_phoneme, hypothesis_phoneme, count(*) as n "
                "from phoneme_errors where operation = 'substitution' "
                "group by reference_phoneme, hypothesis_phoneme"
            )
        ).all()
        ref_totals: dict[str, int] = {}
        pair_counts: dict[tuple[str, str], int] = {}
        for ref, hyp, n in rows:
            ref_totals[ref] = ref_totals.get(ref, 0) + n
            pair_counts[(ref, hyp)] = n

        scored = [
            (pair, pair_counts.get(pair, 0) / ref_totals[pair[0]] if ref_totals.get(pair[0]) else 0.0)
            for pair in substitutions
        ]
        scored.sort(key=lambda item: -item[1])
        return scored[0][0]
    except Exception:
        return substitutions[0]
    finally:
        db.close()
