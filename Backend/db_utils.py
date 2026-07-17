"""Shared database connection factory (SQLite + PostgreSQL)."""
from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from threading import Lock

from config import USE_POSTGRES, POSTGRES_URL, DB_PATH

# Postgres connection pool (simple thread-safe pool)
_pg_pool = None
_pg_pool_lock = Lock()


def _get_pg_pool():
    """Lazy-initialize a simple psycopg2 connection pool."""
    global _pg_pool
    if _pg_pool is None:
        with _pg_pool_lock:
            if _pg_pool is None:
                import psycopg2
                import psycopg2.pool
                import psycopg2.extras
                # Min=1, Max=10 connections — tune via env if needed
                _pg_pool = psycopg2.pool.SimpleConnectionPool(
                    minconn=1,
                    maxconn=10,
                    dsn=POSTGRES_URL,
                    cursor_factory=psycopg2.extras.RealDictCursor,
                )
    return _pg_pool


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
        pool = _get_pg_pool()
        conn = pool.getconn()
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            pool.putconn(conn)
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
