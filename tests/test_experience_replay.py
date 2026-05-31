import sqlite3
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "Backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from experience_replay import ReplayBuffer


@pytest.fixture
def buf(tmp_path):
    return ReplayBuffer(db_path=str(tmp_path / "test_replay.db"), buffer_size=10)


def test_replay_buffer_init_creates_table(tmp_path):
    db_path = tmp_path / "init_test.db"
    ReplayBuffer(db_path=str(db_path))
    conn = sqlite3.connect(str(db_path))
    tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
    conn.close()
    assert "replay_buffer" in tables


def test_replay_buffer_sample_returns_empty_list_when_no_data(buf):
    result = buf.sample(10)
    assert result == []


def test_replay_buffer_add_and_sample(buf):
    buf.add("/path/a.wav", "hello world", "noise")
    buf.add("/path/b.wav", "test speech", "accent")
    buf.add("/path/c.wav", "another one", "pronunciation")
    result = buf.sample(2)
    assert len(result) == 2
    for item in result:
        assert "audio_path" in item
        assert "transcription" in item
        assert "error_type" in item


def test_replay_buffer_prunes_on_overflow(tmp_path):
    db_path = tmp_path / "prune_test.db"
    buf = ReplayBuffer(db_path=str(db_path), buffer_size=3)
    for i in range(5):
        buf.add(f"/path/{i}.wav", f"transcript {i}", "noise")
    conn = sqlite3.connect(str(db_path))
    count = conn.execute("SELECT COUNT(*) FROM replay_buffer").fetchone()[0]
    conn.close()
    assert count == 3
