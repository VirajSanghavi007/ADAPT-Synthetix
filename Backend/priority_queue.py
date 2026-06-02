"""
priority_queue.py — Error remediation priority queue.

Fixes:
  • MEDICAL_VOCABULARY and EMERGENCY_VOCABULARY are now frozensets (O(1) lookup)
  • error_type now used in priority multiplier (noise=1.2×, accent=1.1×, pronunciation=1.0×)
  • Connection uses context manager for proper cleanup
  • get_queue returns all statuses for dashboard visibility
  • Index added for final_priority column
"""
from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone

from config import USE_POSTGRES, POSTGRES_URL

# ── Vocabularies (frozensets for O(1) lookup) ─────────────────
MEDICAL_VOCABULARY: frozenset[str] = frozenset({
    "patient", "dosage", "cardiac", "respiratory", "medication", "diagnosis",
    "prescription", "symptoms", "treatment", "emergency", "critical", "vital",
    "pulse", "oxygen", "blood", "pressure", "trauma", "surgery", "anesthesia",
    "ambulance", "triage", "fracture", "hemorrhage", "unconscious", "seizure",
    "allergic", "injection", "ventilator", "catheter", "biopsy",
})

EMERGENCY_VOCABULARY: frozenset[str] = frozenset({
    "help", "emergency", "fire", "police", "ambulance", "accident", "danger",
    "evacuate", "mayday", "distress", "injury", "trapped", "explosion", "flood",
    "attack", "urgent", "critical", "respond", "location", "coordinates",
    "rescue", "hazard", "threat", "alarm",
})

# Error-type multipliers (domain-specific weighting)
_ERROR_TYPE_MULTIPLIER: dict[str, float] = {
    "noise":        1.20,
    "accent":       1.10,
    "pronunciation":1.00,
}


class RemediationPriorityQueue:
    def __init__(self, db_path) -> None:
        self.db_path = str(db_path)
        self._init_table()

    @contextmanager
    def _conn(self):
        if USE_POSTGRES:
            import psycopg2, psycopg2.extras
            c = psycopg2.connect(POSTGRES_URL)
            c.cursor_factory = psycopg2.extras.RealDictCursor
            try:
                yield c
                c.commit()
            finally:
                c.close()
        else:
            c = sqlite3.connect(self.db_path)
            c.row_factory = sqlite3.Row
            try:
                yield c
                c.commit()
            finally:
                c.close()

    def _ph(self) -> str:
        return "%s" if USE_POSTGRES else "?"

    def _init_table(self) -> None:
        ph = self._ph()
        with self._conn() as c:
            c.execute("""
                CREATE TABLE IF NOT EXISTS priority_queue (
                    id               SERIAL PRIMARY KEY,
                    transcription_id INTEGER NOT NULL,
                    transcription    TEXT    NOT NULL,
                    error_type       TEXT    NOT NULL,
                    base_confidence  REAL    NOT NULL,
                    domain_multiplier REAL   NOT NULL,
                    final_priority   REAL    NOT NULL,
                    domain_matches   TEXT    NOT NULL,
                    status           TEXT    NOT NULL DEFAULT 'pending',
                    created_at       TEXT    NOT NULL
                )
            """ if USE_POSTGRES else """
                CREATE TABLE IF NOT EXISTS priority_queue (
                    id               INTEGER PRIMARY KEY AUTOINCREMENT,
                    transcription_id INTEGER NOT NULL,
                    transcription    TEXT    NOT NULL,
                    error_type       TEXT    NOT NULL,
                    base_confidence  REAL    NOT NULL,
                    domain_multiplier REAL   NOT NULL,
                    final_priority   REAL    NOT NULL,
                    domain_matches   TEXT    NOT NULL,
                    status           TEXT    NOT NULL DEFAULT 'pending',
                    created_at       TEXT    NOT NULL
                )
            """)
            try:
                c.execute("CREATE INDEX IF NOT EXISTS idx_pq_priority ON priority_queue(final_priority DESC)")
                c.execute("CREATE INDEX IF NOT EXISTS idx_pq_status   ON priority_queue(status)")
            except Exception:
                pass

    def calculate_priority(self, transcription: str, confidence_score: float, error_type: str) -> tuple[float, list[str], float]:
        """
        Priority = base × domain_multiplier × error_type_multiplier
        base = 1 - confidence  (higher error → higher priority)
        domain_multiplier = 1 + 0.5 × |domain_vocab_matches|
        """
        text  = str(transcription or "").lower()
        words = {"".join(ch for ch in w if ch.isalpha()) for w in text.split()}
        words.discard("")
        matches = sorted(words & (MEDICAL_VOCABULARY | EMERGENCY_VOCABULARY))

        conf     = float(confidence_score or 0.0)
        base     = 1.0 - conf
        d_mult   = 1.0 + 0.5 * len(matches)
        e_mult   = _ERROR_TYPE_MULTIPLIER.get(str(error_type), 1.0)
        final    = base * d_mult * e_mult
        return final, matches, d_mult

    def enqueue(self, transcription_id: int, transcription: str, error_type: str, confidence_score: float) -> int:
        final, matches, d_mult = self.calculate_priority(transcription, confidence_score, error_type)
        ts   = datetime.now(timezone.utc).isoformat()
        ph   = self._ph()
        conf = float(confidence_score or 0.0)
        with self._conn() as c:
            cur = c.execute(
                f"""INSERT INTO priority_queue
                    (transcription_id, transcription, error_type, base_confidence,
                     domain_multiplier, final_priority, domain_matches, status, created_at)
                    VALUES ({ph},{ph},{ph},{ph},{ph},{ph},{ph},'pending',{ph})""",
                (int(transcription_id), str(transcription or ""), str(error_type or ""),
                 conf, float(d_mult), float(final), ",".join(matches), ts),
            )
            if USE_POSTGRES:
                row = c.execute("SELECT lastval()").fetchone()
                return int(list(row.values())[0])
            return cur.lastrowid

    def mark_completed(self, queue_id: int) -> None:
        ph = self._ph()
        with self._conn() as c:
            c.execute(f"UPDATE priority_queue SET status='completed' WHERE id={ph}", (int(queue_id),))

    def get_queue(self, limit: int = 50) -> list[dict]:
        ph = self._ph()
        with self._conn() as c:
            rows = c.execute(
                f"SELECT * FROM priority_queue ORDER BY final_priority DESC, id DESC LIMIT {ph}",
                (min(limit, 200),),
            ).fetchall()
        return [dict(r) for r in rows]

    def get_stats(self) -> dict:
        with self._conn() as c:
            row = c.execute("""
                SELECT
                    SUM(CASE WHEN status='pending'    THEN 1 ELSE 0 END) AS pending,
                    SUM(CASE WHEN status='processing' THEN 1 ELSE 0 END) AS processing,
                    SUM(CASE WHEN status='completed'  THEN 1 ELSE 0 END) AS completed,
                    COUNT(*) AS total,
                    AVG(final_priority) AS avg_priority
                FROM priority_queue
            """).fetchone()
        return {
            "pending":      int(row["pending"]    or 0),
            "processing":   int(row["processing"] or 0),
            "completed":    int(row["completed"]  or 0),
            "total":        int(row["total"]      or 0),
            "avg_priority": round(float(row["avg_priority"] or 0.0), 4),
        }
