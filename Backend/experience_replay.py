"""
experience_replay.py — Replay buffer for LoRA continual learning.

Prevents catastrophic forgetting by mixing previously-seen remedial samples
into each training run at a 1:1 ratio with new samples.
"""

from datetime import datetime, timezone
from pathlib import Path

from config import USE_POSTGRES
from db_utils import get_connection, ph


class ReplayBuffer:
    def __init__(self, db_path, buffer_size=200):
        self.db_path = str(db_path)
        self.buffer_size = int(buffer_size)
        self._ensure_table()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _connect(self):
        return get_connection(self.db_path)

    def _ensure_table(self) -> None:
        """Create replay_buffer table if absent; prune oldest rows if over capacity."""
        with self._connect() as conn:
            ph_holder = ph()
            if USE_POSTGRES:
                conn.execute(f"""
                    CREATE TABLE IF NOT EXISTS replay_buffer (
                        id           SERIAL PRIMARY KEY,
                        audio_path   TEXT    NOT NULL,
                        transcription TEXT   NOT NULL,
                        error_type   TEXT    NOT NULL,
                        added_at     TEXT    NOT NULL
                    )
                """)
            else:
                conn.execute(f"""
                    CREATE TABLE IF NOT EXISTS replay_buffer (
                        id           INTEGER PRIMARY KEY AUTOINCREMENT,
                        audio_path   TEXT    NOT NULL,
                        transcription TEXT   NOT NULL,
                        error_type   TEXT    NOT NULL,
                        added_at     TEXT    NOT NULL
                    )
                """)
            conn.commit()
            self._prune(conn)

    def _prune(self, conn) -> None:
        """Delete oldest entries so total count stays within buffer_size."""
        ph_holder = ph()
        row = conn.execute(f"SELECT COUNT(*) AS cnt FROM replay_buffer").fetchone()
        excess = int(row["cnt"]) - self.buffer_size
        if excess > 0:
            conn.execute(f"""
                DELETE FROM replay_buffer
                WHERE id IN (
                    SELECT id FROM replay_buffer
                    ORDER BY id ASC
                    LIMIT {ph_holder}
                )
            """, (excess,))
            conn.commit()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def add(self, audio_path: str, transcription: str, error_type: str) -> None:
        """Insert a new entry and prune if the buffer exceeds capacity."""
        now = datetime.now(timezone.utc).isoformat()
        ph_holder = ph()
        with self._connect() as conn:
            conn.execute(
                f"INSERT INTO replay_buffer (audio_path, transcription, error_type, added_at) VALUES ({ph_holder}, {ph_holder}, {ph_holder}, {ph_holder})",
                (str(audio_path), str(transcription), str(error_type), now),
            )
            conn.commit()
            self._prune(conn)

    def sample(self, n: int) -> list[dict]:
        """
        Return up to n rows sampled uniformly at random from the transcriptions
        table where remedial_audio_path IS NOT NULL.

        Falls back to the replay_buffer table if the transcriptions table has
        no eligible rows (e.g. before the remediation pipeline has run).
        """
        n = max(0, int(n))
        if n == 0:
            return []

        ph_holder = ph()
        with self._connect() as conn:
            # Primary source: transcriptions with collected remedial audio
            try:
                rows = conn.execute(
                    f"""
                    SELECT
                        remedial_audio_path AS audio_path,
                        COALESCE(NULLIF(TRIM(reference_transcript), ''), transcription) AS transcription,
                        COALESCE(error_type, 'unknown') AS error_type
                    FROM transcriptions
                    WHERE remedial_audio_path IS NOT NULL
                      AND TRIM(remedial_audio_path) != ''
                    ORDER BY RANDOM()
                    LIMIT {ph_holder}
                    """,
                    (n,),
                ).fetchall()
            except Exception:
                rows = []

            if not rows:
                # Fallback: stored replay buffer
                rows = conn.execute(
                    f"SELECT audio_path, transcription, error_type FROM replay_buffer ORDER BY RANDOM() LIMIT {ph_holder}",
                    (n,),
                ).fetchall()

        return [
            {
                "audio_path":    row["audio_path"],
                "transcription": row["transcription"],
                "error_type":    row["error_type"],
            }
            for row in rows
        ]
