"""
database.py — Unified DB layer (SQLite + PostgreSQL).

Optimisations applied:
  • Schema initialised ONCE per process (module-level flag), not on every request
  • log_transcription now writes ALL diagnostic columns in a single INSERT
    (eliminates the separate update_diagnostics() round-trip per transcription)
  • get_recent_sessions projects only needed columns, accepts offset for pagination
  • WAL mode + NORMAL sync on every SQLite connection for concurrent read safety
  • contextmanager always closes connection — no leaks
"""
from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Optional

from config import DB_PATH, USE_POSTGRES, POSTGRES_URL

_schema_done = False   # initialised once per process


# ── Connection factory ────────────────────────────────────────
@contextmanager
def _get_conn():
    global _schema_done
    if USE_POSTGRES:
        try:
            import psycopg2, psycopg2.extras
        except ImportError as exc:
            raise ImportError("psycopg2-binary required for PostgreSQL") from exc
        conn = psycopg2.connect(POSTGRES_URL)
        conn.cursor_factory = psycopg2.extras.RealDictCursor
        if not _schema_done:
            _init_postgres(conn)
            _schema_done = True
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
        conn.execute("PRAGMA cache_size=-8000")   # 8 MB page cache
        conn.execute("PRAGMA foreign_keys=ON")
        if not _schema_done:
            _init_sqlite(conn)
            _schema_done = True
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

        CREATE TABLE IF NOT EXISTS priority_queue (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            transcription_id INTEGER NOT NULL,
            transcription    TEXT    NOT NULL,
            error_type       TEXT    NOT NULL,
            base_confidence  REAL    NOT NULL,
            domain_multiplier REAL   NOT NULL,
            final_priority   REAL    NOT NULL,
            domain_matches   TEXT    NOT NULL,
            status           TEXT    NOT NULL DEFAULT 'pending',
            created_at       TEXT    NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_pq_priority ON priority_queue(final_priority DESC);
        CREATE INDEX IF NOT EXISTS idx_pq_status   ON priority_queue(status);
    """)
    # Migrate older DBs
    existing = {r[1] for r in conn.execute("PRAGMA table_info(transcriptions)").fetchall()}
    for col, defn in [
        ("wer_score",           "REAL DEFAULT NULL"),
        ("per_score",           "REAL DEFAULT NULL"),
        ("snr_db",              "REAL DEFAULT NULL"),
        ("nonconformity_score", "REAL DEFAULT NULL"),
    ]:
        if col not in existing:
            conn.execute(f"ALTER TABLE transcriptions ADD COLUMN {col} {defn}")
    conn.commit()


# ── Schema — PostgreSQL ───────────────────────────────────────
def _init_postgres(conn) -> None:
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS transcriptions (
                id                   SERIAL PRIMARY KEY,
                session_id           TEXT, timestamp TEXT,
                audio_filename       TEXT, audio_path TEXT,
                transcription        TEXT,
                reference_transcript TEXT    DEFAULT NULL,
                duration_seconds     REAL,  model_used TEXT,
                cer_score            REAL   DEFAULT NULL,
                wer_score            REAL   DEFAULT NULL,
                per_score            REAL   DEFAULT NULL,
                error_type           TEXT   DEFAULT NULL,
                confidence_score     REAL   DEFAULT NULL,
                snr_db               REAL   DEFAULT NULL,
                noise_profile        TEXT   DEFAULT NULL,
                remedial_audio_path  TEXT   DEFAULT NULL,
                nonconformity_score  REAL   DEFAULT NULL
            )
        """)
        for idx in [
            "CREATE INDEX IF NOT EXISTS idx_tx_session ON transcriptions(session_id)",
            "CREATE INDEX IF NOT EXISTS idx_tx_timestamp ON transcriptions(timestamp)",
        ]:
            cur.execute(idx)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS phoneme_tracking (
                id SERIAL PRIMARY KEY, session_id TEXT,
                phoneme TEXT, confidence_score REAL, timestamp TEXT
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS phoneme_errors (
                id SERIAL PRIMARY KEY, session_id TEXT, transcription_id INTEGER,
                operation TEXT, reference_phoneme TEXT, hypothesis_phoneme TEXT,
                confidence_score REAL, timestamp TEXT
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS replay_buffer (
                id SERIAL PRIMARY KEY, audio_path TEXT NOT NULL,
                transcription TEXT NOT NULL, error_type TEXT NOT NULL, added_at TEXT NOT NULL
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS drift_events (
                id SERIAL PRIMARY KEY, detected_at TEXT,
                mmd_score REAL, n_high_risk INTEGER, triggered_retraining BOOLEAN DEFAULT FALSE
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS priority_queue (
                id SERIAL PRIMARY KEY, transcription_id INTEGER NOT NULL,
                transcription TEXT NOT NULL, error_type TEXT NOT NULL,
                base_confidence REAL NOT NULL, domain_multiplier REAL NOT NULL,
                final_priority REAL NOT NULL, domain_matches TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL
            )
        """)
    conn.commit()


# ── Write API ─────────────────────────────────────────────────

def log_transcription(
    session_id: str,
    audio_filename: str,
    audio_path: str,
    transcription: str,
    duration: float,
    model: str,
    reference_transcript: Optional[str] = None,
    # Diagnostic columns — written in the same INSERT to avoid a second round-trip
    cer_score: Optional[float]  = None,
    wer_score: Optional[float]  = None,
    per_score: Optional[float]  = None,
    error_type: Optional[str]   = None,
    confidence_score: Optional[float] = None,
    snr_db: Optional[float]     = None,
    noise_profile: Optional[str]= None,
    nonconformity_score: Optional[float] = None,
) -> int:
    ph = _ph()
    ts = datetime.now(timezone.utc).isoformat()
    with _get_conn() as conn:
        cur = conn.execute(
            f"""INSERT INTO transcriptions
                (session_id, timestamp, audio_filename, audio_path, transcription,
                 reference_transcript, duration_seconds, model_used,
                 cer_score, wer_score, per_score, error_type,
                 confidence_score, snr_db, noise_profile, nonconformity_score)
                VALUES ({ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},
                        {ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph})""",
            (session_id, ts, audio_filename, audio_path, transcription,
             reference_transcript, float(duration), model,
             cer_score, wer_score, per_score, error_type,
             confidence_score, snr_db, noise_profile, nonconformity_score),
        )
        if USE_POSTGRES:
            row = conn.execute("SELECT lastval()").fetchone()
            return int(list(row.values())[0])
        return cur.lastrowid


# Kept for backward compatibility — no-op if all diag fields passed to log_transcription
def update_diagnostics(row_id: int, *_, **__) -> None:
    """
    Deprecated: diagnostics now written in log_transcription INSERT.
    This no-op shim keeps old call-sites working without errors.
    """
    pass


def update_remedial_path(row_id: int, path: str) -> None:
    ph = _ph()
    with _get_conn() as conn:
        conn.execute(
            f"UPDATE transcriptions SET remedial_audio_path={ph} WHERE id={ph}",
            (path, row_id),
        )


# ── Read API ──────────────────────────────────────────────────

def get_recent_sessions(limit: int = 100, offset: int = 0) -> list[dict]:
    """Return most-recent transcriptions across all dates, newest first."""
    ph = _ph()
    with _get_conn() as conn:
        rows = conn.execute(
            f"""SELECT id, session_id, timestamp, audio_filename, transcription,
                       reference_transcript, duration_seconds, model_used,
                       cer_score, wer_score, per_score, error_type,
                       confidence_score, snr_db, noise_profile,
                       remedial_audio_path, nonconformity_score
                FROM transcriptions
                ORDER BY id DESC
                LIMIT {ph} OFFSET {ph}""",
            (min(limit, 500), max(offset, 0)),
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
    return {
        "total_transcriptions": total,
        "clean":                clean,
        "remediated":           remediated,
        "pending_remediation":  pending,
        "remediation_rate":     round((remediated / total) * 100, 1) if total else 0.0,
    }
