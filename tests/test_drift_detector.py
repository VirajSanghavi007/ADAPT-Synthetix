"""
test_drift_detector.py — uses public API only, no internal method patching.
"""
import sqlite3
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "Backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from drift_detector import DriftDetector


@pytest.fixture
def detector(tmp_path):
    return DriftDetector(db_path=str(tmp_path / "drift_test.db"))


@pytest.mark.db
def test_record_phoneme_confidence_inserts_row(detector):
    detector.record_phoneme_confidence("session-1", ["AA", "B", "K"], 0.7)
    # Verify via public API — total_phonemes_tracked counts distinct phonemes with >=3 rows
    # For a quick row-count check, open the DB file directly (not via internal method)
    conn = sqlite3.connect(detector.db_path)
    count = conn.execute("SELECT COUNT(*) FROM phoneme_tracking").fetchone()[0]
    conn.close()
    assert count == 3


@pytest.mark.db
def test_get_phoneme_trend_stable_when_consistent(detector):
    for _ in range(6):
        detector.record_phoneme_confidence("s1", ["AH"], 0.7)
    trend = detector.get_phoneme_trend("AH", window=6)
    assert trend["trend"] == "stable"
    assert trend["avg_confidence"] == pytest.approx(0.7, abs=0.01)


@pytest.mark.db
def test_get_phoneme_trend_degrading_when_declining(detector):
    for score in [0.9, 0.8, 0.7, 0.6, 0.5]:
        detector.record_phoneme_confidence("s2", ["EH"], score)
    trend = detector.get_phoneme_trend("EH", window=5)
    assert trend["trend"] == "degrading"


@pytest.mark.db
def test_get_phoneme_trend_improving(detector):
    for score in [0.4, 0.5, 0.6, 0.7, 0.9]:
        detector.record_phoneme_confidence("s3", ["IY"], score)
    trend = detector.get_phoneme_trend("IY", window=5)
    assert trend["trend"] == "improving"


@pytest.mark.db
def test_should_trigger_retraining_false_when_insufficient_risk(detector):
    assert detector.should_trigger_retraining() is False


@pytest.mark.db
def test_get_confidence_histogram_empty(detector):
    result = detector.get_confidence_histogram(bins=10)
    assert result["total_samples"] == 0
    assert len(result["bins"])   == 10
    assert len(result["counts"]) == 10


@pytest.mark.db
def test_get_error_report_empty(detector):
    result = detector.get_error_report()
    assert "top_errors" in result
    assert isinstance(result["top_errors"], list)
