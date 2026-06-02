"""
test_priority_queue.py

Fixture uses tmp_path (real SQLite file) instead of monkeypatching
internals — decoupled from implementation details of _conn / _get_connection.
"""
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "Backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from priority_queue import RemediationPriorityQueue


@pytest.fixture
def queue(tmp_path):
    """Real SQLite DB in a temp directory — no monkeypatching needed."""
    db = tmp_path / "test_pq.db"
    q  = RemediationPriorityQueue(str(db))
    yield q


def test_calculate_priority_low_confidence_high_priority(queue):
    priority, matches, multiplier = queue.calculate_priority(
        "normal sentence", 0.1, "noise"
    )
    assert priority == pytest.approx(0.9 * 1.2, abs=0.05)   # noise multiplier 1.2×
    assert matches == []
    assert multiplier == pytest.approx(1.0)


def test_domain_match_increases_priority(queue):
    with_domain, _, _    = queue.calculate_priority("patient cardiac arrest", 0.5, "noise")
    without_domain, _, _ = queue.calculate_priority("generic filler words",   0.5, "noise")
    assert with_domain > without_domain


def test_enqueue_adds_row_to_db(queue):
    queue_id = queue.enqueue(1, "sample transcription", "noise", 0.5)
    assert isinstance(queue_id, int)
    items = queue.get_queue(limit=20)
    assert len(items) >= 1


def test_mark_completed_changes_status(queue):
    queue_id = queue.enqueue(2, "to remediate", "noise", 0.4)
    queue.mark_completed(queue_id)
    # Only pending items are in get_queue default view — but check stats
    stats = queue.get_stats()
    assert stats["completed"] >= 1


def test_get_stats_returns_correct_counts(queue):
    id1 = queue.enqueue(11, "a", "noise",   0.2)
    _   = queue.enqueue(12, "b", "noise",   0.3)
    _   = queue.enqueue(13, "c", "accent",  0.4)
    queue.mark_completed(id1)

    stats = queue.get_stats()
    assert stats["pending"]   == 2
    assert stats["completed"] == 1
    assert stats["total"]     == 3


def test_priority_formula_domain_multiplier(queue):
    """domain_multiplier = 1 + 0.5 × |matches|"""
    _, matches, mult = queue.calculate_priority("help fire ambulance", 0.5, "noise")
    assert len(matches) >= 2
    assert mult == pytest.approx(1.0 + 0.5 * len(matches), abs=0.01)


def test_medical_vocabulary_recognised(queue):
    _, matches, _ = queue.calculate_priority("patient needs cardiac medication", 0.6, "pronunciation")
    assert len(matches) > 0
    assert any(m in {"patient", "cardiac", "medication"} for m in matches)
