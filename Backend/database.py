"""Database layer — SQLite/PostgreSQL dual-mode schema and queries."""
from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Optional

from config import DB_PATH, USE_POSTGRES
from db_utils import get_connection, ph as _ph

_schema_done = False   # initialised once per process


# ── Connection factory ────────────────────────────────────────
@contextmanager
def _get_conn():
    global _schema_done
    with get_connection(sqlite_pragmas=True) as conn:
        if not _schema_done:
            if USE_POSTGRES:
                _init_postgres(conn)
            else:
                _init_sqlite(conn)
            _schema_done = True
        yield conn


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

        CREATE TABLE IF NOT EXISTS vocabulary_terms (
            domain TEXT NOT NULL,
            term   TEXT NOT NULL,
            PRIMARY KEY (domain, term)
        );
        CREATE INDEX IF NOT EXISTS idx_vocab_domain ON vocabulary_terms(domain);

        CREATE TABLE IF NOT EXISTS training_runs (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            state       TEXT    NOT NULL DEFAULT 'idle',
            progress    INTEGER NOT NULL DEFAULT 0,
            message     TEXT    NOT NULL DEFAULT '',
            error_type  TEXT,
            epochs      INTEGER,
            started_at  TEXT,
            finished_at TEXT
        );
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
        cur.execute("""
            CREATE TABLE IF NOT EXISTS vocabulary_terms (
                domain TEXT NOT NULL,
                term   TEXT NOT NULL,
                PRIMARY KEY (domain, term)
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS training_runs (
                id          SERIAL PRIMARY KEY,
                state       TEXT    NOT NULL DEFAULT 'idle',
                progress    INTEGER NOT NULL DEFAULT 0,
                message     TEXT    NOT NULL DEFAULT '',
                error_type  TEXT,
                epochs      INTEGER,
                started_at  TEXT,
                finished_at TEXT
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


def get_session_by_id(row_id: int) -> dict | None:
    ph = _ph()
    with _get_conn() as conn:
        row = conn.execute(
            f"SELECT * FROM transcriptions WHERE id={ph}",
            (row_id,),
        ).fetchone()
        if row is None:
            return None
        result = dict(row)
        # Parse noise_profile JSON
        if result.get("noise_profile") and isinstance(result["noise_profile"], str):
            try:
                result["noise_profile"] = json.loads(result["noise_profile"])
            except Exception:
                result["noise_profile"] = None
        # Fetch phoneme errors
        pe_rows = conn.execute(
            f"SELECT * FROM phoneme_errors WHERE transcription_id={ph} ORDER BY id ASC",
            (row_id,),
        ).fetchall()
        result["phoneme_errors"] = [dict(r) for r in pe_rows]
        # Fetch priority queue entry
        pq_row = conn.execute(
            f"SELECT * FROM priority_queue WHERE transcription_id={ph} LIMIT 1",
            (row_id,),
        ).fetchone()
        result["queue_entry"] = dict(pq_row) if pq_row else None
    return result


def get_vocabulary_terms(domain: str) -> list[str]:
    """Return all terms for a given domain (e.g. 'medical', 'emergency')."""
    with _get_conn() as conn:
        rows = conn.execute(
            f"SELECT term FROM vocabulary_terms WHERE domain={_ph()} ORDER BY term",
            (domain,),
        ).fetchall()
    return [r["term"] for r in rows]


def add_vocabulary_term(domain: str, term: str) -> None:
    """Insert a new term (no-op if already exists — PRIMARY KEY conflict)."""
    ph = _ph()
    with _get_conn() as conn:
        conn.execute(
            f"INSERT OR IGNORE INTO vocabulary_terms (domain, term) VALUES ({ph},{ph})",
            (domain, term),
        )


def seed_vocabulary_if_empty(medical: frozenset, emergency: frozenset) -> None:
    """Seed vocabulary_terms from static sets on first run (if table is empty)."""
    ph = _ph()
    with _get_conn() as conn:
        count = conn.execute("SELECT COUNT(*) FROM vocabulary_terms").fetchone()[0]
        if count == 0:
            conn.executemany(
                f"INSERT OR IGNORE INTO vocabulary_terms (domain, term) VALUES ({ph},{ph})",
                [("medical", t) for t in sorted(medical)] + [("emergency", t) for t in sorted(emergency)],
            )


def upsert_training_status(
    state: str,
    progress: int,
    message: str,
    run_id: Optional[int] = None,
) -> int:
    ph = _ph()
    ts = datetime.now(timezone.utc).isoformat()
    with _get_conn() as conn:
        if run_id is None:
            cur = conn.execute(
                f"""INSERT INTO training_runs (state, progress, message, started_at)
                    VALUES ({ph},{ph},{ph},{ph})""",
                (state, progress, message, ts),
            )
            if USE_POSTGRES:
                row = conn.execute("SELECT lastval()").fetchone()
                return int(list(row.values())[0])
            return cur.lastrowid
        finished = ts if state in ("idle", "error") else None
        conn.execute(
            f"""UPDATE training_runs
                SET state={ph}, progress={ph}, message={ph}, finished_at={ph}
                WHERE id={ph}""",
            (state, progress, message, finished, run_id),
        )
        return run_id


def get_training_status() -> dict:
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM training_runs ORDER BY id DESC LIMIT 1"
        ).fetchone()
    if row is None:
        return {"state": "idle", "progress": 0, "message": ""}
    d = dict(row)
    return {
        "state":    d.get("state", "idle"),
        "progress": d.get("progress", 0),
        "message":  d.get("message", ""),
    }


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
