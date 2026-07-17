"""Phoneme confidence drift monitoring with CUSUM trend detection."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import numpy as np

from config import USE_POSTGRES, DB_PATH
from db_utils import get_connection as _get_conn_factory, ph as _ph_fn


class DriftDetector:
    CUSUM_THRESHOLD = 0.04   # drift flagged when CUSUM score exceeds this
    CONFUSION_RATE_THRESHOLD = 0.30  # 30% rule from DyPCL / POWER
    HIGH_RISK_CONF_THRESHOLD = 0.50

    def __init__(self, db_path=None, window_size: int = 20) -> None:
        self.db_path     = str(db_path or DB_PATH)
        self.window_size = window_size
        self._ensure_tables()
        self._historical_points = self._count_phoneme_rows()

    # ── Connection ────────────────────────────────────────────

    def _conn(self):
        return _get_conn_factory(self.db_path)

    def _ph(self) -> str:
        return _ph_fn()

    # ── Schema ────────────────────────────────────────────────

    def _ensure_tables(self) -> None:
        """Create drift detector tables if absent (uses dual-mode connection)."""
        ph = self._ph()
        with self._conn() as c:
            cur = c.cursor()
            cur.execute(f"""
                CREATE TABLE IF NOT EXISTS phoneme_tracking (
                    id               INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id       TEXT,
                    phoneme          TEXT,
                    confidence_score REAL,
                    timestamp        TEXT
                )
            """ if not USE_POSTGRES else f"""
                CREATE TABLE IF NOT EXISTS phoneme_tracking (
                    id               SERIAL PRIMARY KEY,
                    session_id       TEXT,
                    phoneme          TEXT,
                    confidence_score REAL,
                    timestamp        TEXT
                )
            """)
            cur.execute(f"""
                CREATE TABLE IF NOT EXISTS phoneme_errors (
                    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id         TEXT,
                    transcription_id   INTEGER,
                    operation          TEXT,
                    reference_phoneme  TEXT,
                    hypothesis_phoneme TEXT,
                    confidence_score   REAL,
                    timestamp          TEXT
                )
            """ if not USE_POSTGRES else f"""
                CREATE TABLE IF NOT EXISTS phoneme_errors (
                    id                 SERIAL PRIMARY KEY,
                    session_id         TEXT,
                    transcription_id   INTEGER,
                    operation          TEXT,
                    reference_phoneme  TEXT,
                    hypothesis_phoneme TEXT,
                    confidence_score   REAL,
                    timestamp          TEXT
                )
            """)
            cur.execute(f"""
                CREATE TABLE IF NOT EXISTS drift_events (
                    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
                    detected_at          TEXT,
                    mmd_score            REAL,
                    n_high_risk          INTEGER,
                    triggered_retraining INTEGER DEFAULT 0
                )
            """ if not USE_POSTGRES else f"""
                CREATE TABLE IF NOT EXISTS drift_events (
                    id                   SERIAL PRIMARY KEY,
                    detected_at          TEXT,
                    mmd_score            REAL,
                    n_high_risk          INTEGER,
                    triggered_retraining BOOLEAN DEFAULT FALSE
                )
            """)
            # Indexes
            for idx_sql in [
                f"CREATE INDEX IF NOT EXISTS idx_pt_phoneme ON phoneme_tracking(phoneme)",
                f"CREATE INDEX IF NOT EXISTS idx_pt_session ON phoneme_tracking(session_id)",
                f"CREATE INDEX IF NOT EXISTS idx_pe_ops ON phoneme_errors(operation, reference_phoneme, hypothesis_phoneme)",
            ]:
                try:
                    cur.execute(idx_sql)
                except Exception:
                    pass
            c.commit()

    def _count_phoneme_rows(self) -> int:
        with self._conn() as c:
            row = c.execute("SELECT COUNT(*) AS n FROM phoneme_tracking").fetchone()
            return int(row["n"] or 0)

    # ── Recording ─────────────────────────────────────────────

    def record_phoneme_confidence(self, session_id: str, phonemes: list[str], confidence_score: float) -> None:
        if not phonemes:
            return
        ts   = datetime.now(timezone.utc).isoformat()
        ph   = self._ph()
        rows = [(session_id, str(p), float(confidence_score), ts) for p in phonemes if str(p).strip()]
        if not rows:
            return
        with self._conn() as c:
            c.executemany(
                f"INSERT INTO phoneme_tracking (session_id, phoneme, confidence_score, timestamp) VALUES ({ph},{ph},{ph},{ph})",
                rows,
            )
            c.commit()
        self._historical_points += len(rows)

    def record_phoneme_errors(self, session_id: str, transcription_id: int, alignment: dict, confidence_score: float) -> None:
        errors = alignment.get("errors", []) if isinstance(alignment, dict) else []
        if not errors:
            return
        ts   = datetime.now(timezone.utc).isoformat()
        ph   = self._ph()
        rows = [
            (session_id, int(transcription_id), e.get("operation", ""), e.get("reference", ""), e.get("hypothesis", ""), float(confidence_score), ts)
            for e in errors
        ]
        with self._conn() as c:
            c.executemany(
                f"INSERT INTO phoneme_errors (session_id,transcription_id,operation,reference_phoneme,hypothesis_phoneme,confidence_score,timestamp) VALUES ({ph},{ph},{ph},{ph},{ph},{ph},{ph})",
                rows,
            )
            c.commit()

    # ── Trend analysis (CUSUM-enhanced) ──────────────────────

    def get_phoneme_trend(self, phoneme: str, window: int | None = None) -> dict:
        """
        Improved trend detection using CUSUM alongside simple slope.
        CUSUM accumulates deviations from mean — more sensitive to
        sustained but small degradations than first-vs-last comparison.
        """
        w = window or self.window_size
        ph = self._ph()
        with self._conn() as c:
            rows = c.execute(
                f"SELECT confidence_score FROM phoneme_tracking WHERE phoneme={ph} ORDER BY id DESC LIMIT ?",
                (phoneme, w),
            ).fetchall()

        if not rows:
            return {"phoneme": phoneme, "avg_confidence": 0.0, "trend": "stable", "sample_count": 0, "cusum": 0.0}

        scores = list(reversed([float(r["confidence_score"]) for r in rows]))
        avg    = float(np.mean(scores))

        # Two-sided CUSUM: separate degradation and improvement signals
        S_low, S_high = 0.0, 0.0
        for s in scores:
            S_low  = max(0.0, S_low  + (avg - s))   # degradation signal
            S_high = max(0.0, S_high + (s - avg))    # improvement signal
        cusum_deg = S_low
        cusum_imp = S_high

        # Slope-based (original method)
        slope = scores[-1] - scores[0]
        if cusum_deg > self.CUSUM_THRESHOLD or slope <= -0.05:
            trend = "degrading"
        elif cusum_imp > self.CUSUM_THRESHOLD or slope >= 0.05:
            trend = "improving"
        else:
            trend = "stable"

        return {
            "phoneme":        phoneme,
            "avg_confidence": round(avg, 4),
            "trend":          trend,
            "sample_count":   len(scores),
            "cusum":          round(cusum_deg, 4),
            "cusum_deg":      round(cusum_deg, 4),
            "cusum_imp":      round(cusum_imp, 4),
        }

    # ── Drift report ──────────────────────────────────────────

    def get_drift_report(self) -> dict:
        ph = self._ph()
        with self._conn() as c:
            rows = c.execute(
                f"SELECT phoneme FROM phoneme_tracking GROUP BY phoneme HAVING COUNT(*) >= 3 ORDER BY phoneme ASC"
            ).fetchall()

        phonemes = [r["phoneme"] for r in rows]
        trends   = [self.get_phoneme_trend(p) for p in phonemes]

        degrading  = sorted([t for t in trends if t["trend"] == "degrading"],  key=lambda x: x["avg_confidence"])
        stable     = [t for t in trends if t["trend"] == "stable"]
        improving  = sorted([t for t in trends if t["trend"] == "improving"],  key=lambda x: -x["avg_confidence"])
        high_risk  = [t["phoneme"] for t in degrading if t["avg_confidence"] < self.HIGH_RISK_CONF_THRESHOLD]

        return {
            "total_phonemes_tracked": len(phonemes),
            "degrading":              degrading,
            "stable":                 stable,
            "improving":              improving,
            "high_risk_phonemes":     high_risk,
            "basis":                  "cusum_and_slope_window",
        }

    # ── Error report with confusion matrix ────────────────────

    def get_error_report(self) -> dict:
        with self._conn() as c:
            rows = c.execute(
                """SELECT operation, reference_phoneme, hypothesis_phoneme, COUNT(*) AS count
                   FROM phoneme_errors
                   GROUP BY operation, reference_phoneme, hypothesis_phoneme
                   ORDER BY count DESC, operation ASC LIMIT 50"""
            ).fetchall()

        errors = [dict(r) for r in rows]

        # Compute confusion matrix rates (DyPCL / POWER 30% threshold)
        systematic = []
        from collections import defaultdict
        ref_totals: dict[str, int] = defaultdict(int)
        for e in errors:
            if e["operation"] == "substitution":
                ref_totals[e["reference_phoneme"]] += e["count"]
        for e in errors:
            if e["operation"] == "substitution" and ref_totals.get(e["reference_phoneme"], 0) > 0:
                rate = e["count"] / ref_totals[e["reference_phoneme"]]
                if rate >= self.CONFUSION_RATE_THRESHOLD:
                    systematic.append({
                        **e,
                        "confusion_rate": round(rate, 3),
                        "systematic": True,
                    })

        return {
            "basis":      "reference_aligned_phoneme_errors",
            "top_errors": errors[:25],
            "systematic_confusions": systematic,
        }

    # ── Calibration metrics ───────────────────────────────────

    def get_calibration_metrics(self) -> dict:
        """
        Expected Calibration Error (ECE) and overconfidence ratio
        computed from stored phoneme confidence scores.
        ECE = Σ_b (|B_b|/n) |acc_b - conf_b|  (Guo et al. 2017)
        For unsupervised proxy: treat confidence > 0.5 as "correct".
        """
        with self._conn() as c:
            rows = c.execute("SELECT confidence_score FROM phoneme_tracking WHERE confidence_score IS NOT NULL").fetchall()

        scores = np.array([float(r["confidence_score"]) for r in rows])
        if len(scores) == 0:
            return {"ece": None, "overconfidence_ratio": None, "n_samples": 0}

        bins   = np.linspace(0, 1, 11)
        ece    = 0.0
        n      = len(scores)
        for lo, hi in zip(bins[:-1], bins[1:]):
            mask  = (scores >= lo) & (scores < hi)
            if not mask.any():
                continue
            b_conf = scores[mask].mean()
            # proxy accuracy: fraction of frames that are "not the blank token" (confidence > 0.5)
            b_acc  = float((scores[mask] > 0.5).mean())
            ece   += (mask.sum() / n) * abs(b_acc - b_conf)

        overconfident = float((scores > 0.7).mean())  # fraction of frames > 0.7 confidence

        return {
            "ece":                  round(float(ece), 4),
            "overconfidence_ratio": round(overconfident, 4),
            "mean_confidence":      round(float(scores.mean()), 4),
            "n_samples":            int(n),
        }

    # ── Retraining trigger ────────────────────────────────────

    def should_trigger_retraining(self) -> bool:
        report = self.get_drift_report()
        return len(report["high_risk_phonemes"]) >= 5

    def log_drift_event(self, mmd_score: float = 0.0) -> None:
        report    = self.get_drift_report()
        n_risk    = len(report["high_risk_phonemes"])
        retrain   = n_risk >= 5
        ts        = datetime.now(timezone.utc).isoformat()
        ph        = self._ph()
        with self._conn() as c:
            c.execute(
                f"INSERT INTO drift_events (detected_at, mmd_score, n_high_risk, triggered_retraining) VALUES ({ph},{ph},{ph},{ph})",
                (ts, float(mmd_score), n_risk, retrain),
            )
            c.commit()

    # ── Histogram ─────────────────────────────────────────────

    def get_confidence_histogram(self, bins: int = 20) -> dict:
        with self._conn() as c:
            rows = c.execute("SELECT confidence_score FROM phoneme_tracking WHERE confidence_score IS NOT NULL").fetchall()
        scores = [float(r["confidence_score"]) for r in rows]
        if scores:
            counts, edges = np.histogram(scores, bins=bins, range=(0.0, 1.0))
            return {"bins": [round(float(e), 4) for e in edges[:-1]], "counts": [int(c) for c in counts], "total_samples": len(scores)}
        step = 1.0 / bins
        return {"bins": [round(i * step, 4) for i in range(bins)], "counts": [0] * bins, "total_samples": 0}
