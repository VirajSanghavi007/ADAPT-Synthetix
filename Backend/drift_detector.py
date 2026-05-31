import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import numpy as np


class DriftDetector:
    def __init__(self, db_path, window_size=20):
        self.db_path = str(db_path)
        self.window_size = window_size
        self._ensure_table()
        self._load_historical_data()

    def _get_connection(self):
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _ensure_table(self):
        with self._get_connection() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS phoneme_tracking (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT,
                    phoneme TEXT,
                    confidence_score REAL,
                    timestamp TEXT
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS phoneme_errors (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT,
                    transcription_id INTEGER,
                    operation TEXT,
                    reference_phoneme TEXT,
                    hypothesis_phoneme TEXT,
                    confidence_score REAL,
                    timestamp TEXT
                )
                """
            )
            conn.commit()

    def _load_historical_data(self):
        with self._get_connection() as conn:
            row = conn.execute("SELECT COUNT(*) AS total FROM phoneme_tracking").fetchone()
            self.historical_points = int(row["total"] or 0)

    def record_phoneme_confidence(self, session_id, phonemes, confidence_score):
        if not phonemes:
            return
        timestamp = datetime.now(timezone.utc).isoformat()
        rows = [
            (session_id, str(phoneme), float(confidence_score), timestamp)
            for phoneme in phonemes
            if str(phoneme).strip()
        ]
        if not rows:
            return
        with self._get_connection() as conn:
            conn.executemany(
                """
                INSERT INTO phoneme_tracking (session_id, phoneme, confidence_score, timestamp)
                VALUES (?, ?, ?, ?)
                """,
                rows,
            )
            conn.commit()
        self.historical_points += len(rows)

    def record_phoneme_errors(self, session_id, transcription_id, alignment, confidence_score):
        errors = alignment.get("errors", []) if isinstance(alignment, dict) else []
        if not errors:
            return
        timestamp = datetime.now(timezone.utc).isoformat()
        rows = [
            (
                session_id,
                int(transcription_id),
                str(error.get("operation", "")),
                str(error.get("reference", "")),
                str(error.get("hypothesis", "")),
                float(confidence_score),
                timestamp,
            )
            for error in errors
        ]
        with self._get_connection() as conn:
            conn.executemany(
                """
                INSERT INTO phoneme_errors (
                    session_id, transcription_id, operation, reference_phoneme,
                    hypothesis_phoneme, confidence_score, timestamp
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                rows,
            )
            conn.commit()

    def get_phoneme_trend(self, phoneme, window=5):
        with self._get_connection() as conn:
            rows = conn.execute(
                """
                SELECT confidence_score
                FROM phoneme_tracking
                WHERE phoneme = ?
                ORDER BY id DESC
                LIMIT ?
                """,
                (phoneme, int(window)),
            ).fetchall()

        if not rows:
            return {
                "phoneme": phoneme,
                "avg_confidence": 0.0,
                "trend": "stable",
                "sample_count": 0,
            }

        scores_desc = [float(r["confidence_score"]) for r in rows]
        scores = list(reversed(scores_desc))
        avg_confidence = sum(scores) / len(scores)
        earliest = scores[0]
        latest = scores[-1]

        if latest <= earliest - 0.05:
            trend = "degrading"
        elif latest >= earliest + 0.05:
            trend = "improving"
        else:
            trend = "stable"

        return {
            "phoneme": phoneme,
            "avg_confidence": round(avg_confidence, 4),
            "trend": trend,
            "sample_count": len(scores),
        }

    def get_drift_report(self):
        with self._get_connection() as conn:
            phoneme_rows = conn.execute(
                """
                SELECT phoneme
                FROM phoneme_tracking
                GROUP BY phoneme
                HAVING COUNT(*) >= 3
                ORDER BY phoneme ASC
                """
            ).fetchall()

        phonemes = [row["phoneme"] for row in phoneme_rows]
        trends = [self.get_phoneme_trend(phoneme, self.window_size) for phoneme in phonemes]

        degrading = [t for t in trends if t["trend"] == "degrading"]
        stable = [t for t in trends if t["trend"] == "stable"]
        improving = [t for t in trends if t["trend"] == "improving"]
        high_risk = [t["phoneme"] for t in degrading if t["avg_confidence"] < 0.5]

        return {
            "total_phonemes_tracked": len(phonemes),
            "degrading": degrading,
            "stable": stable,
            "improving": improving,
            "high_risk_phonemes": high_risk,
            "basis": "utterance_confidence_by_phoneme",
        }

    def get_error_report(self):
        with self._get_connection() as conn:
            rows = conn.execute(
                """
                SELECT operation, reference_phoneme, hypothesis_phoneme, COUNT(*) AS count
                FROM phoneme_errors
                GROUP BY operation, reference_phoneme, hypothesis_phoneme
                ORDER BY count DESC, operation ASC
                LIMIT 25
                """
            ).fetchall()
        return {
            "basis": "reference_aligned_phoneme_errors",
            "top_errors": [dict(row) for row in rows],
        }

    def should_trigger_retraining(self):
        report = self.get_drift_report()
        return len(report["high_risk_phonemes"]) >= 5

    def get_confidence_histogram(self, bins: int = 10) -> dict:
        """
        Compute a histogram of confidence scores from phoneme_tracking.

        Returns:
            {
                "bins":          [float, ...]  — left edge of each bin (length == bins),
                "counts":        [int, ...]    — sample count per bin  (length == bins),
                "total_samples": int
            }
        """
        with self._get_connection() as conn:
            rows = conn.execute(
                "SELECT confidence_score FROM phoneme_tracking WHERE confidence_score IS NOT NULL"
            ).fetchall()

        scores = [float(r["confidence_score"]) for r in rows]
        if scores:
            counts, edges = np.histogram(scores, bins=bins, range=(0.0, 1.0))
            bin_edges = [round(float(e), 6) for e in edges[:-1]]   # drop the rightmost edge
            bin_counts = [int(c) for c in counts]
        else:
            step = 1.0 / bins
            bin_edges = [round(i * step, 6) for i in range(bins)]
            bin_counts = [0] * bins

        return {
            "bins": bin_edges,
            "counts": bin_counts,
            "total_samples": len(scores),
        }
