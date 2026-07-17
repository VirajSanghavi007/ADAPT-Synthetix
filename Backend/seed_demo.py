"""Standalone script to populate the database with realistic synthetic demo data."""
from __future__ import annotations

import argparse
import json
import random
import sys
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
for p in [str(ROOT), str(ROOT / "Backend")]:
    if p not in sys.path:
        sys.path.insert(0, p)

from database import _get_conn

SENTENCES = [
    "Patient requires immediate triage",
    "Administer 5mg dosage orally",
    "The oxygen levels are dropping",
    "Code blue in ward three",
    "Prepare for emergency surgery",
    "Blood pressure is critically low",
    "Allergic reaction to penicillin noted",
    "Evacuate the building immediately",
    "Apply direct pressure to the wound",
    "Request backup at sector seven",
    "Cardiac arrest detected on monitor",
    "Intubation required for airway management",
    "Transfer patient to intensive care unit",
    "Call for the trauma team now",
    "Administer epinephrine without delay",
]

PHONEMES = ["AE", "IH", "OW", "AH", "T", "N", "S", "R", "L", "D"]

ERROR_WEIGHTS = ["clean"] * 5 + ["noise"] * 2 + ["accent"] * 2 + ["pronunciation"]

SESSION_IDS = [str(uuid.uuid4()) for _ in range(5)]


def _clear(conn) -> None:
    for table in ("phoneme_tracking", "phoneme_errors", "priority_queue", "transcriptions"):
        conn.execute(f"DELETE FROM {table}")
    conn.commit()


def seed(count: int = 40, clear: bool = False) -> None:
    now = datetime.now(timezone.utc)

    with _get_conn() as conn:
        if clear:
            _clear(conn)

        tx_ids = []
        for i in range(count):
            ts = (now - timedelta(
                seconds=random.randint(0, 7 * 24 * 3600)
            )).isoformat()
            error_type = random.choice(ERROR_WEIGHTS)
            confidence = round(random.uniform(0.45, 0.97), 4)
            cer = None if error_type == "clean" else round(random.uniform(0.05, 0.35), 4)
            wer = round(cer * random.uniform(1.1, 1.8), 4) if cer is not None else None
            snr = round(random.uniform(5.0, 35.0), 2)
            noise_type = (
                "clean" if error_type == "clean"
                else random.choice(["traffic", "crowd", "machinery", "indoor"])
            )
            noise_profile = json.dumps({
                "noise_type": noise_type,
                "rms_energy": round(random.uniform(0.001, 0.05), 6),
                "spectral_centroid": round(random.uniform(800, 4000), 2),
                "zero_crossing_rate": round(random.uniform(0.02, 0.15), 4),
                "mfcc_variance": round(random.uniform(0.1, 2.0), 4),
            })
            ncs = round(1.0 - confidence, 4)
            sid = random.choice(SESSION_IDS)
            text = random.choice(SENTENCES)

            cur = conn.execute(
                """INSERT INTO transcriptions
                   (session_id, timestamp, audio_filename, audio_path, transcription,
                    reference_transcript, duration_seconds, model_used,
                    cer_score, wer_score, per_score, error_type,
                    confidence_score, snr_db, noise_profile, nonconformity_score)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    sid, ts,
                    f"demo_{i:04d}.wav",
                    f"/demo/audio/demo_{i:04d}.wav",
                    text, None,
                    round(random.uniform(0.5, 8.0), 2),
                    "wav2vec2-base-960h",
                    cer, wer,
                    round(cer * random.uniform(0.8, 1.2), 4) if cer else None,
                    error_type,
                    confidence, snr, noise_profile, ncs,
                ),
            )
            tx_ids.append((cur.lastrowid, error_type, text, confidence))

        # Phoneme tracking rows
        phoneme_count = 0
        for _ in range(random.randint(15, 20)):
            ts = (now - timedelta(seconds=random.randint(0, 7 * 24 * 3600))).isoformat()
            phoneme = random.choice(PHONEMES)
            conf = round(random.uniform(0.3, 0.95), 4)
            conn.execute(
                "INSERT INTO phoneme_tracking (session_id, phoneme, confidence_score, timestamp) VALUES (?,?,?,?)",
                (random.choice(SESSION_IDS), phoneme, conf, ts),
            )
            phoneme_count += 1

        # Priority queue rows for non-clean transcriptions
        queue_count = 0
        non_clean = [(tid, et, tx, cf) for tid, et, tx, cf in tx_ids if et != "clean"]
        for tid, et, tx, cf in non_clean[:5]:
            dm = {"noise": 1.2, "accent": 1.1, "pronunciation": 1.0}.get(et, 1.0)
            fp = round((1.0 - cf) * dm, 4)
            conn.execute(
                """INSERT INTO priority_queue
                   (transcription_id, transcription, error_type, base_confidence,
                    domain_multiplier, final_priority, domain_matches, status, created_at)
                   VALUES (?,?,?,?,?,?,?,?,?)""",
                (tid, tx, et, cf, dm, fp, "[]", "pending",
                 datetime.now(timezone.utc).isoformat()),
            )
            queue_count += 1

        conn.commit()

    print(f"Inserted {count} transcriptions, {phoneme_count} phoneme records, {queue_count} queue items.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed demo data into the Mercury database")
    parser.add_argument("--count", type=int, default=40, help="Number of transcription rows to insert")
    parser.add_argument("--clear", action="store_true", help="Truncate all tables before seeding")
    args = parser.parse_args()
    seed(count=args.count, clear=args.clear)
