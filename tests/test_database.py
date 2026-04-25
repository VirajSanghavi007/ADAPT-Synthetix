import sys
import time
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "Backend"
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

import database


@pytest.fixture
def in_memory_db(monkeypatch):
    uri = "file:adapt_synthetix_test?mode=memory&cache=shared"
    keeper = database.sqlite3.connect(uri, uri=True)
    keeper.row_factory = database.sqlite3.Row
    database._init_db(keeper)

    def _get_connection():
        conn = database.sqlite3.connect(uri, uri=True)
        conn.row_factory = database.sqlite3.Row
        database._init_db(conn)
        return conn

    monkeypatch.setattr(database, "_get_connection", _get_connection)
    yield uri
    keeper.close()


def test_log_transcription_creates_row(in_memory_db):
    row_id = database.log_transcription(
        session_id="session-1",
        audio_filename="a.wav",
        audio_path="Backend/data/audio/a.wav",
        transcription="hello world",
        duration=1.25,
        model="wav2vec2-base-960h",
    )
    with database.sqlite3.connect(in_memory_db, uri=True) as conn:
        conn.row_factory = database.sqlite3.Row
        row = conn.execute("SELECT * FROM transcriptions WHERE id = ?", (row_id,)).fetchone()
    assert row is not None
    assert row["session_id"] == "session-1"
    assert row["audio_filename"] == "a.wav"
    assert row["transcription"] == "hello world"
    assert row["model_used"] == "wav2vec2-base-960h"


def test_update_diagnostics_updates_existing_row(in_memory_db):
    row_id = database.log_transcription(
        session_id="session-2",
        audio_filename="b.wav",
        audio_path="Backend/data/audio/b.wav",
        transcription="diagnostic",
        duration=2.0,
        model="wav2vec2-base-960h",
    )
    database.update_diagnostics(
        row_id=row_id,
        cer_score=0.1234,
        error_type="noise",
        confidence_score=0.7777,
        noise_profile='{"noise_type":"traffic"}',
    )
    with database.sqlite3.connect(in_memory_db, uri=True) as conn:
        conn.row_factory = database.sqlite3.Row
        row = conn.execute("SELECT * FROM transcriptions WHERE id = ?", (row_id,)).fetchone()
    assert row["cer_score"] == pytest.approx(0.1234)
    assert row["error_type"] == "noise"
    assert row["confidence_score"] == pytest.approx(0.7777)
    assert row["noise_profile"] == '{"noise_type":"traffic"}'


def test_get_recent_sessions_returns_correct_count(in_memory_db):
    for i in range(5):
        database.log_transcription(
            session_id=f"session-{i}",
            audio_filename=f"{i}.wav",
            audio_path=f"Backend/data/audio/{i}.wav",
            transcription=f"text-{i}",
            duration=0.5 + i,
            model="wav2vec2-base-960h",
        )
    sessions = database.get_recent_sessions(3)
    assert len(sessions) == 3


def test_get_recent_sessions_orders_by_timestamp_desc(in_memory_db):
    for i in range(3):
        database.log_transcription(
            session_id=f"ordered-{i}",
            audio_filename=f"ordered-{i}.wav",
            audio_path=f"Backend/data/audio/ordered-{i}.wav",
            transcription=f"ordered-{i}",
            duration=1.0,
            model="wav2vec2-base-960h",
        )
        time.sleep(0.01)

    sessions = database.get_recent_sessions(3)
    timestamps = [entry["timestamp"] for entry in sessions]
    assert timestamps == sorted(timestamps, reverse=True)
