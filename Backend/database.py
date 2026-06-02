"""
database.py — Unified DB layer with SQLite + PostgreSQL support.

Bug fixes from audit:
  • DB_PATH now sourced from config.py (was hardcoded)
  • get_recent_sessions no longer filtered to today only
  • get_recent_sessions accepts limit param exposed via API
  • All connections properly closed in finally blocks
  • PRAGMA indexes added for SQLite performance
  • wer_score column added to transcriptions
  • snr_db column added to transcriptions
"""
from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Optional

from config import DB_PATH, USE_POSTGRES, POSTGRES_URL


# ── Connection factory ────────────────────────────────────────

@contextmanager
def _get_conn():
    """Context-managed DB connection — always closed on exit."""
    if USE_POSTGRES:
        try:
            import psycopg2, psycopg2.extras
        except ImportError as exc:
            raise ImportError("psycopg2-binary required: pip install psycopg2-binary") from exc
        conn = psycopg2.connect(POSTGRES_URL)
        conn.cursor_factory = psycopg2.extras.RealDictCursor
        _init_postgres(conn)
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()
    else:
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")
        conn.execute("PRAGMA foreign_keys=ON")
        _init_sqlite(conn)
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()


def _ph() -> str:
    return "%s" if USE_POSTGRES else "?"


# ── Schema — SQLite ───────────────────────────────────────────

def _init_sqlite(conn: sqlite3.Connection) -> None:
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS transcriptions (
            id                   INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id           TEXT,
            timestamp            TEXT,
            audio_filename       TEXT,
            audio_path           TEXT,
            transcription        TEXT,
            reference_transcript TEXT    DEFAULT NULL,
            duration_seconds     REAL,
            model_used           TEXT,
            cer_score            REAL    DEFAULT NULL,
            wer_score            REAL    DEFAULT NULL,
            per_score            REAL    DEFAULT NULL,
            error_type           TEXT    DEFAULT NULL,
            confidence_score     REAL    DEFAULT NULL,
            snr_db               REAL    DEFAULT NULL,
            noise_profile        TEXT    DEFAULT NULL,
            remedial_audio_path  TEXT    DEFAULT NULL,
            nonconformity_score  REAL    DEFAULT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_tx_session   ON transcriptions(session_id);
        CREATE INDEX IF NOT EXISTS idx_tx_timestamp ON transcriptions(timestamp);
        CREATE INDEX IF NOT EXISTS idx_tx_error     ON transcriptions(error_type);

        CREATE TABLE IF NOT EXISTS phoneme_tracking (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id       TEXT,
            phoneme          TEXT,
            confidence_score REAL,
            timestamp        TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_pt_phoneme ON phoneme_tracking(phoneme);
        CREATE INDEX IF NOT EXISTS idx_pt_session ON phoneme_tracking(session_id);

        CREATE TABLE IF NOT EXISTS phoneme_errors (
            id                 INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id         TEXT,
            transcription_id   INTEGER,
            operation          TEXT,
            reference_phoneme  TEXT,
            hypothesis_phoneme TEXT,
            confidence_score   REAL,
            timestamp          TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_pe_op ON phoneme_errors(operation, reference_phoneme, hypothesis_phoneme);

        CREATE TABLE IF NOT EXISTS replay_buffer (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            audio_path    TEXT NOT NULL,
            transcription TEXT NOT NULL,
            error_type    TEXT NOT NULL,
            added_at      TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS drift_events (
            id                   INTEGER PRIMARY KEY AUTOINCREMENT,
            detected_at          TEXT,
            mmd_score            REAL,
            n_high_risk          INTEGER,
            triggered_retraining INTEGER DEFAULT 0
        );
    """)
    # Migrate older DBs — add new columns if absent
    for col, defn in [
        ("wer_score",           "REAL DEFAULT NULL"),
        ("per_score",           "REAL DEFAULT NULL"),
        ("snr_db",              "REAL DEFAULT NULL"),
        ("nonconformity_score", "REAL DEFAULT NULL"),
    ]:
        cols = [r[1] for r in conn.execute("PRAGMA table_info(transcriptions)").fetchall()]
        if col not in cols:
            conn.execute(f"ALTER TABLE transcriptions ADD COLUMN {col} {defn}")
    conn.commit()


# ── Schema — PostgreSQL ───────────────────────────────────────

def _init_postgres(conn) -> None:
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS transcriptions (
                id                   SERIAL PRIMARY KEY,
                session_id           TEXT,
                timestamp            TEXT,
                audio_filename       TEXT,
                audio_path           TEXT,
                transcription        TEXT,
                reference_transcript TEXT    DEFAULT NULL,
                duration_seconds     REAL,
                model_used           TEXT,
                cer_score            REAL    DEFAULT NULL,
                wer_score            REAL    DEFAULT NULL,
                per_score            REAL    DEFAULT NULL,
                error_type           TEXT    DEFAULT NULL,
                confidence_score     REAL    DEFAULT NULL,
                snr_db               REAL    DEFAULT NULL,
                noise_profile        TEXT    DEFAULT NULL,
                remedial_audio_path  TEXT    DEFAULT NULL,
                nonconformity_score  REAL    DEFAULT NULL
            )
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS idx_tx_session   ON transcriptions(session_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_tx_timestamp ON transcriptions(timestamp)")
        cur.execute("""
            CREATE TABLE IF NOT EXISTS phoneme_tracking (
                id               SERIAL PRIMARY KEY,
                session_id       TEXT,
                phoneme          TEXT,
                confidence_score REAL,
                timestamp        TEXT
            )
        """)
        cur.execute("""
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
        cur.execute("""
            CREATE TABLE IF NOT EXISTS replay_buffer (
                id            SERIAL PRIMARY KEY,
                audio_path    TEXT NOT NULL,
                transcription TEXT NOT NULL,
                error_type    TEXT NOT NULL,
                added_at      TEXT NOT NULL
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS drift_events (
                id                   SERIAL PRIMARY KEY,
                detected_at          TEXT,
                mmd_score            REAL,
                n_high_risk          INTEGER,
                triggered_retraining BOOLEAN DEFAULT FALSE
            )
        """)
    conn.commit()


# ── Public write API ──────────────────────────────────────────

def log_transcription(
    session_id: str,
    audio_filename: str,
    audio_path: str,
    transcription: str,
    duration: float,
    model: str,
    reference_transcript: Optional[str] = None,
) -> int:
    ph = _ph()
    ts = datetime.now(timezone.utc).isoformat()
    with _get_conn() as conn:
        cur = conn.execute(
            f"""INSERT INTO transcriptions
                (session_id, timestamp, audio_filename, audio_path,
                 transcription, reference_transcript, duration_seconds, model_used)
                VALUES ({ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph})""",
            (session_id, ts, audio_filename, audio_path,
             transcription, reference_transcript, float(duration), model),
        )
        if USE_POSTGRES:
            row = conn.execute("SELECT lastval()").fetchone()
            return int(list(row.values())[0])
        return cur.lastrowid


def update_diagnostics(
    row_id: int,
    cer_score: Optional[float],
    wer_score: Optional[float],
    per_score: Optional[float],
    error_type: Optional[str],
    confidence_score: Optional[float],
    snr_db: Optional[float],
    noise_profile: Optional[str],
    nonconformity_score: Optional[float] = None,
) -> None:
    ph = _ph()
    with _get_conn() as conn:
        conn.execute(
            f"""UPDATE transcriptions SET
                cer_score={ph}, wer_score={ph}, per_score={ph},
                error_type={ph}, confidence_score={ph},
                snr_db={ph}, noise_profile={ph}, nonconformity_score={ph}
                WHERE id={ph}""",
            (cer_score, wer_score, per_score, error_type,
             confidence_score, snr_db, noise_profile, nonconformity_score, row_id),
        )


def update_remedial_path(row_id: int, path: str) -> None:
    ph = _ph()
    with _get_conn() as conn:
        conn.execute(
            f"UPDATE transcriptions SET remedial_audio_path={ph} WHERE id={ph}",
            (path, row_id),
        )


# ── Public read API ───────────────────────────────────────────

def get_recent_sessions(limit: int = 100) -> list[dict]:
    """Return most-recent transcriptions across ALL dates, newest first."""
    ph = _ph()
    with _get_conn() as conn:
        rows = conn.execute(
            f"SELECT * FROM transcriptions ORDER BY id DESC LIMIT {ph}",
            (min(limit, 500),),
        ).fetchall()
    return [dict(r) for r in rows]


def get_remediation_status() -> dict:
    with _get_conn() as conn:
        row = conn.execute("""
            SELECT
                COUNT(*)  AS total_transcriptions,
                SUM(CASE WHEN LOWER(COALESCE(error_type,'clean'))='clean' THEN 1 ELSE 0 END) AS clean,
                SUM(CASE WHEN remedial_audio_path IS NOT NULL
                          AND TRIM(remedial_audio_path)!=''
                          AND LOWER(COALESCE(error_type,'clean'))!='clean' THEN 1 ELSE 0 END) AS remediated
            FROM transcriptions
        """).fetchone()

    total      = int(row["total_transcriptions"] or 0)
    clean      = int(row["clean"]      or 0)
    remediated = int(row["remediated"] or 0)
    pending    = max(total - clean - remediated, 0)
    rate       = round((remediated / total) * 100, 1) if total else 0.0
    return {
        "total_transcriptions": total,
        "clean":                clean,
        "remediated":           remediated,
        "pending_remediation":  pending,
        "remediation_rate":     rate,
    }
