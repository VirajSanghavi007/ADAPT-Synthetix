"""Shared database connection factory (SQLite + PostgreSQL)."""
from __future__ import annotations

import sqlite3
from contextlib import contextmanager

from config import USE_POSTGRES, POSTGRES_URL, DB_PATH


@contextmanager
def get_connection(db_path=None, *, sqlite_pragmas: bool = False):
    """
    Yield an open DB connection, commit on exit, close in all cases.

    Args:
        db_path:         Override the default DB path (SQLite only).
        sqlite_pragmas:  When True, apply WAL/NORMAL/cache/foreign_keys pragmas.
                         Pass True from database.py; leave False for readers.
    """
    if USE_POSTGRES:
        try:
            import psycopg2
            import psycopg2.extras
        except ImportError as exc:
            raise ImportError("psycopg2-binary required for PostgreSQL") from exc
        conn = psycopg2.connect(POSTGRES_URL)
        conn.cursor_factory = psycopg2.extras.RealDictCursor
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()
    else:
        from pathlib import Path
        path = str(db_path or DB_PATH)
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        if sqlite_pragmas:
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA synchronous=NORMAL")
            conn.execute("PRAGMA cache_size=-8000")
            conn.execute("PRAGMA foreign_keys=ON")
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()


def ph() -> str:
    """SQL placeholder: %s for PostgreSQL, ? for SQLite."""
    return "%s" if USE_POSTGRES else "?"
