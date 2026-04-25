import sqlite3
from datetime import datetime, timezone


MEDICAL_VOCABULARY = [
    "patient", "dosage", "cardiac", "respiratory", "medication", "diagnosis",
    "prescription", "symptoms", "treatment", "emergency", "critical", "vital",
    "pulse", "oxygen", "blood", "pressure", "trauma", "surgery", "anesthesia",
    "ambulance", "triage", "fracture", "hemorrhage", "unconscious", "seizure"
]

EMERGENCY_VOCABULARY = [
    "help", "emergency", "fire", "police", "ambulance", "accident", "danger",
    "evacuate", "mayday", "distress", "injury", "trapped", "explosion", "flood",
    "attack", "urgent", "critical", "respond", "location", "coordinates"
]


class RemediationPriorityQueue:
    def __init__(self, db_path):
        self.db_path = str(db_path)
        self._init_table()

    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_table(self):
        conn = self._get_connection()
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS priority_queue (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                transcription_id INTEGER NOT NULL,
                transcription TEXT NOT NULL,
                error_type TEXT NOT NULL,
                base_confidence REAL NOT NULL,
                domain_multiplier REAL NOT NULL,
                final_priority REAL NOT NULL,
                domain_matches TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TEXT NOT NULL
            )
            """
        )
        conn.commit()
        conn.close()

    def calculate_priority(self, transcription, confidence_score, error_type):
        _ = error_type
        text = str(transcription or "").lower()
        words = text.split()
        vocab_matches = []
        combined_vocab = set(MEDICAL_VOCABULARY + EMERGENCY_VOCABULARY)
        for word in words:
            cleaned = "".join(ch for ch in word if ch.isalpha())
            if cleaned and cleaned in combined_vocab:
                vocab_matches.append(cleaned)

        unique_matches = sorted(set(vocab_matches))
        confidence = float(confidence_score if confidence_score is not None else 0.0)
        base_priority = 1.0 - confidence
        domain_multiplier = 1.0 + (0.5 * len(unique_matches))
        final_priority = base_priority * domain_multiplier
        return final_priority, unique_matches, domain_multiplier

    def enqueue(self, transcription_id, transcription, error_type, confidence_score):
        final_priority, domain_matches, domain_multiplier = self.calculate_priority(
            transcription, confidence_score, error_type
        )
        timestamp = datetime.now(timezone.utc).isoformat()
        confidence = float(confidence_score if confidence_score is not None else 0.0)
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO priority_queue (
                transcription_id, transcription, error_type, base_confidence,
                domain_multiplier, final_priority, domain_matches, status, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
            """,
            (
                int(transcription_id),
                str(transcription or ""),
                str(error_type or ""),
                confidence,
                float(domain_multiplier),
                float(final_priority),
                ",".join(domain_matches),
                timestamp,
            ),
        )
        conn.commit()
        queue_id = cursor.lastrowid
        conn.close()
        return queue_id

    def get_queue(self, limit=20):
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT *
            FROM priority_queue
            WHERE status = 'pending'
            ORDER BY final_priority DESC, id DESC
            LIMIT ?
            """,
            (int(limit),),
        )
        rows = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return rows

    def mark_completed(self, queue_id):
        conn = self._get_connection()
        conn.execute(
            """
            UPDATE priority_queue
            SET status = 'completed'
            WHERE id = ?
            """,
            (int(queue_id),),
        )
        conn.commit()
        conn.close()

    def get_stats(self):
        conn = self._get_connection()
        row = conn.execute(
            """
            SELECT
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
                SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) AS processing,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
                COUNT(*) AS total,
                AVG(final_priority) AS avg_priority
            FROM priority_queue
            """
        ).fetchone()
        conn.close()
        return {
            "pending": int(row["pending"] or 0),
            "processing": int(row["processing"] or 0),
            "completed": int(row["completed"] or 0),
            "total": int(row["total"] or 0),
            "avg_priority": round(float(row["avg_priority"] or 0.0), 4),
        }
