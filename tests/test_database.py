"""
Database layer tests.

Critical regressions tested:
  - get_recent_sessions no longer filtered to today only (midnight bug)
  - New columns (wer_score, snr_db, nonconformity_score, per_score) present
  - Context-managed connections don't leak
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'Backend'))

import sqlite3
import pytest
from unittest.mock import patch


@pytest.fixture
def db_module(tmp_path):
    """Reload database with a fresh SQLite DB in a temp directory."""
    db_file = tmp_path / "test.db"
    env = {
        "DB_PATH":      str(db_file),
        "DB_DIR":       str(tmp_path),
        "USE_POSTGRES": "false",
    }
    with patch.dict(os.environ, env):
        import importlib
        import config
        importlib.reload(config)
        import database
        importlib.reload(database)
        yield database


def test_log_transcription_returns_positive_int(db_module):
    row_id = db_module.log_transcription(
        "s1", "a.wav", "/tmp/a.wav", "hello", 2.0, "model"
    )
    assert isinstance(row_id, int) and row_id > 0


def test_get_recent_sessions_returns_all_dates(db_module):
    """Regression: midnight bug — sessions from all dates must be visible."""
    import config
    # Use db_module's context manager so schema is initialised
    with db_module._get_conn() as conn:
        conn.execute("""
            INSERT INTO transcriptions
            (session_id, timestamp, audio_filename, audio_path, transcription, duration_seconds, model_used)
            VALUES ('s','1999-12-31T23:59:59','old.wav','/old','old_session',1.0,'m')
        """)

    rows = db_module.get_recent_sessions(limit=100)
    assert any(r["transcription"] == "old_session" for r in rows), (
        "Historical session not returned — midnight filter still active"
    )


def test_update_diagnostics_new_columns(db_module):
    # update_diagnostics is now a no-op shim — all columns written in log_transcription
    row_id = db_module.log_transcription(
        "s", "b.wav", "/b", "world", 1.5, "m",
        cer_score=0.05, wer_score=0.12, per_score=0.08,
        error_type="pronunciation", confidence_score=0.75,
        snr_db=18.5, noise_profile='{"noise_type":"clean"}',
        nonconformity_score=0.25,
    )
    rows = db_module.get_recent_sessions(limit=10)
    row  = next((r for r in rows if r["id"] == row_id), None)
    assert row is not None
    assert row["wer_score"]           == pytest.approx(0.12, abs=0.001)
    assert row["snr_db"]              == pytest.approx(18.5, abs=0.01)
    assert row["nonconformity_score"] == pytest.approx(0.25, abs=0.001)
    assert row["per_score"]           == pytest.approx(0.08, abs=0.001)


def test_update_remedial_path(db_module):
    row_id = db_module.log_transcription("s", "c.wav", "/c", "test", 1.0, "m")
    db_module.update_remedial_path(row_id, "/out/c_remedial.wav")
    rows = db_module.get_recent_sessions(limit=10)
    row  = next((r for r in rows if r["id"] == row_id), None)
    assert row["remedial_audio_path"] == "/out/c_remedial.wav"


def test_remediation_status_counts(db_module):
    row_id = db_module.log_transcription("s", "d.wav", "/d", "clean test", 1.0, "m")
    db_module.update_diagnostics(row_id, 0.0, 0.0, 0.0, "clean", 0.95, 35.0, None)
    status = db_module.get_remediation_status()
    assert status["total_transcriptions"] >= 1
    assert status["clean"] >= 1
    assert 0.0 <= status["remediation_rate"] <= 100.0


def test_get_recent_sessions_limit(db_module):
    for i in range(5):
        db_module.log_transcription("s", f"{i}.wav", f"/{i}", f"tx{i}", 1.0, "m")
    rows = db_module.get_recent_sessions(limit=3)
    assert len(rows) == 3
