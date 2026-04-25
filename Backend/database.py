import sqlite3
from datetime import datetime, timezone
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
_BACKEND_DIR = Path(__file__).parent
DB_PATH = _BACKEND_DIR / "data" / "adaptsynthetix.db"


# ---------------------------------------------------------------------------
# Schema init
# ---------------------------------------------------------------------------
def _init_db(conn: sqlite3.Connection) -> None:
    """Create required tables if they do not already exist."""
    conn.execute("""
        CREATE TABLE IF NOT EXISTS transcriptions (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id          TEXT,
            timestamp           TEXT,
            audio_filename      TEXT,
            audio_path          TEXT,
            transcription       TEXT,
            duration_seconds    REAL,
            model_used          TEXT,
            cer_score           REAL    DEFAULT NULL,
            error_type          TEXT    DEFAULT NULL,
            confidence_score    REAL    DEFAULT NULL,
            noise_profile       TEXT    DEFAULT NULL,
            remedial_audio_path TEXT    DEFAULT NULL
        )
    """)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS phoneme_tracking (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            phoneme TEXT,
            confidence_score REAL,
            timestamp TEXT
        )
        """
    )
    conn.commit()


def _get_connection() -> sqlite3.Connection:
    """Return a connection with row_factory set and the schema ensured."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    _init_db(conn)
    return conn


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def log_transcription(
    session_id: str,
    audio_filename: str,
    audio_path: str,
    transcription: str,
    duration: float,
    model: str,
) -> int:
    """
    Insert a new transcription row and return the new row id.

    Parameters
    ----------
    session_id      : UUID string for the current server session.
    audio_filename  : Original filename of the uploaded audio.
    audio_path      : Permanent path where the audio copy was saved.
    transcription   : ASR transcription text.
    duration        : Audio duration in seconds.
    model           : Model identifier string, e.g. 'wav2vec2-base-960h'.

    Returns
    -------
    int : The ROWID of the newly inserted row.
    """
    timestamp = datetime.now(timezone.utc).isoformat()
    conn = _get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO transcriptions
            (session_id, timestamp, audio_filename, audio_path,
             transcription, duration_seconds, model_used)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (session_id, timestamp, audio_filename, audio_path,
         transcription, duration, model),
    )
    conn.commit()
    row_id = cursor.lastrowid
    conn.close()
    return row_id


def get_recent_sessions(limit: int = 20) -> list[dict]:
    """
    Return up to *limit* most-recent transcription rows as plain dicts,
    ordered newest-first.
    """
    conn = _get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT * FROM transcriptions
        ORDER BY id DESC
        LIMIT ?
        """,
        (limit,),
    )
    rows = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return rows


def update_diagnostics(
    row_id: int,
    cer_score: float | None,
    error_type: str | None,
    confidence_score: float | None,
    noise_profile: str | None,
) -> None:
    """
    Update diagnostic fields on an existing transcription row.

    Parameters
    ----------
    row_id           : The id of the row to update.
    cer_score        : Character Error Rate (0.0 – 1.0).
    error_type       : Human-readable error category string.
    confidence_score : Model confidence value.
    noise_profile    : Noise profile label / description.
    """
    conn = _get_connection()
    conn.execute(
        """
        UPDATE transcriptions
        SET cer_score        = ?,
            error_type       = ?,
            confidence_score = ?,
            noise_profile    = ?
        WHERE id = ?
        """,
        (cer_score, error_type, confidence_score, noise_profile, row_id),
    )
    conn.commit()
    conn.close()


def update_remedial_path(row_id: int, path: str) -> None:
    """Update remedial_audio_path for an existing transcription row."""
    conn = _get_connection()
    conn.execute(
        """
        UPDATE transcriptions
        SET remedial_audio_path = ?
        WHERE id = ?
        """,
        (path, row_id),
    )
    conn.commit()
    conn.close()


def get_remediation_status() -> dict:
    """Return aggregate remediation counters for dashboard/status endpoints."""
    conn = _get_connection()
    row = conn.execute(
        """
        SELECT
            COUNT(*) AS total_transcriptions,
            SUM(CASE WHEN LOWER(COALESCE(error_type, 'clean')) = 'clean' THEN 1 ELSE 0 END) AS clean,
            SUM(
                CASE
                    WHEN remedial_audio_path IS NOT NULL
                     AND TRIM(remedial_audio_path) != ''
                     AND LOWER(COALESCE(error_type, 'clean')) != 'clean'
                    THEN 1 ELSE 0
                END
            ) AS remediated
        FROM transcriptions
        """
    ).fetchone()
    conn.close()

    total = int(row["total_transcriptions"] or 0)
    clean = int(row["clean"] or 0)
    remediated = int(row["remediated"] or 0)
    pending = max(total - clean - remediated, 0)
    remediation_rate = round((remediated / total) * 100, 1) if total else 0.0
    return {
        "total_transcriptions": total,
        "clean": clean,
        "remediated": remediated,
        "pending_remediation": pending,
        "remediation_rate": remediation_rate,
    }
