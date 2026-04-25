import sqlite3
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "Backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from priority_queue import RemediationPriorityQueue


@pytest.fixture
def in_memory_queue(monkeypatch):
    uri = "file:adapt_priority_queue?mode=memory&cache=shared"
    keeper = sqlite3.connect(uri, uri=True)
    keeper.row_factory = sqlite3.Row

    queue = RemediationPriorityQueue(":memory:")

    def _get_connection():
        conn = sqlite3.connect(uri, uri=True)
        conn.row_factory = sqlite3.Row
        return conn

    monkeypatch.setattr(queue, "_get_connection", _get_connection)
    queue._init_table()
    yield queue
    keeper.close()


def test_calculate_priority_low_confidence_high_priority(in_memory_queue):
    priority, matches, multiplier = in_memory_queue.calculate_priority(
        "normal sentence", 0.1, "noise"
    )
    assert priority == pytest.approx(0.9, abs=0.05)
    assert matches == []
    assert multiplier == pytest.approx(1.0)


def test_domain_match_increases_priority(in_memory_queue):
    with_domain, _, _ = in_memory_queue.calculate_priority("patient cardiac arrest", 0.5, "noise")
    without_domain, _, _ = in_memory_queue.calculate_priority("generic filler words", 0.5, "noise")
    assert with_domain > without_domain


@pytest.mark.db
def test_enqueue_adds_row_to_db(in_memory_queue):
    queue_id = in_memory_queue.enqueue(1, "sample transcription", "noise", 0.5)
    assert isinstance(queue_id, int)
    items = in_memory_queue.get_queue(limit=20)
    assert len(items) == 1


@pytest.mark.db
def test_mark_completed_changes_status(in_memory_queue):
    queue_id = in_memory_queue.enqueue(2, "to remediate", "noise", 0.4)
    in_memory_queue.mark_completed(queue_id)
    items = in_memory_queue.get_queue(limit=20)
    assert len(items) == 0


@pytest.mark.db
def test_get_stats_returns_correct_counts(in_memory_queue):
    id1 = in_memory_queue.enqueue(11, "a", "noise", 0.2)
    in_memory_queue.enqueue(12, "b", "noise", 0.3)
    in_memory_queue.enqueue(13, "c", "accent", 0.4)
    in_memory_queue.mark_completed(id1)

    stats = in_memory_queue.get_stats()
    assert stats["pending"] == 2
    assert stats["completed"] == 1
    assert stats["total"] == 3
