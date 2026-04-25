import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "Backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from drift_detector import DriftDetector


@pytest.fixture
def in_memory_drift(tmp_path):
    db_path = tmp_path / "drift_test.db"
    detector = DriftDetector(str(db_path))
    yield detector


@pytest.mark.db
def test_record_phoneme_confidence_inserts_row(in_memory_drift):
    detector = in_memory_drift
    detector.record_phoneme_confidence("session-1", ["AA", "B", "K"], 0.7)
    with detector._get_connection() as conn:
        row = conn.execute("SELECT COUNT(*) FROM phoneme_tracking").fetchone()
    assert row[0] == 3


@pytest.mark.db
def test_get_phoneme_trend_stable_when_consistent(in_memory_drift):
    detector = in_memory_drift
    for _i in range(5):
        detector.record_phoneme_confidence("s1", ["AH"], 0.7)
    trend = detector.get_phoneme_trend("AH", window=5)
    assert trend["trend"] == "stable"


@pytest.mark.db
def test_get_phoneme_trend_degrading_when_declining(in_memory_drift):
    detector = in_memory_drift
    for score in [0.9, 0.8, 0.7, 0.6, 0.5]:
        detector.record_phoneme_confidence("s2", ["EH"], score)
    trend = detector.get_phoneme_trend("EH", window=5)
    assert trend["trend"] == "degrading"


@pytest.mark.db
def test_should_trigger_retraining_false_when_insufficient_risk(in_memory_drift):
    detector = in_memory_drift
    assert detector.should_trigger_retraining() is False
