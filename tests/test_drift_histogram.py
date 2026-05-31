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
    return DriftDetector(db_path=str(tmp_path / "hist_test.db"))


def test_histogram_returns_correct_schema(detector):
    result = detector.get_confidence_histogram()
    assert "bins" in result
    assert "counts" in result
    assert "total_samples" in result
    assert isinstance(result["total_samples"], int)


def test_histogram_bin_count_matches_request(detector):
    result = detector.get_confidence_histogram(bins=5)
    assert len(result["bins"]) == 5
    assert len(result["counts"]) == 5
