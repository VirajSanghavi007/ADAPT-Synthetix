"""
migrate_to_postgres.py — Copy all data from SQLite to PostgreSQL.

Usage:
    DATABASE_URL=postgresql://postgres:pass@localhost:5432/adaptsynthetix python Backend/migrate_to_postgres.py

The script is idempotent-safe: it truncates each target table before inserting,
so re-running will not duplicate rows.
"""

import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from config import DB_PATH, POSTGRES_URL
from database import _init_db_postgres

TABLES = [
    "transcriptions",
    "phoneme_tracking",
    "phoneme_errors",
    "replay_buffer",
]


def _sqlite_rows(sqlite_conn, table: str) -> tuple[list[str], list[tuple]]:
    cur = sqlite_conn.execute(f"SELECT * FROM {table}")
    cols = [d[0] for d in cur.description]
    rows = cur.fetchall()
    return cols, [tuple(r) for r in rows]


def main():
    try:
        import psycopg2
        import psycopg2.extras
    except ImportError:
        print("ERROR: psycopg2-binary not installed. Run: pip install psycopg2-binary", file=sys.stderr)
        sys.exit(1)

    print(f"Source : {DB_PATH}")
    print(f"Target : {POSTGRES_URL}\n")

    sqlite_conn = sqlite3.connect(str(DB_PATH))
    sqlite_conn.row_factory = sqlite3.Row

    pg_conn = psycopg2.connect(POSTGRES_URL)
    _init_db_postgres(pg_conn)

    counts = {}

    with pg_conn.cursor() as cur:
        for table in TABLES:
            # Check if table exists in SQLite
            exists = sqlite_conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table,)
            ).fetchone()
            if not exists:
                print(f"  SKIP {table} (not in SQLite)")
                counts[table] = 0
                continue

            cols, rows = _sqlite_rows(sqlite_conn, table)
            # Truncate then re-insert (idempotent)
            cur.execute(f"TRUNCATE TABLE {table} RESTART IDENTITY CASCADE")

            if rows:
                placeholders = ", ".join(["%s"] * len(cols))
                col_list = ", ".join(cols)
                psycopg2.extras.execute_batch(
                    cur,
                    f"INSERT INTO {table} ({col_list}) VALUES ({placeholders})",
                    rows,
                )

            counts[table] = len(rows)
            print(f"  Migrated {table}: {len(rows)} rows")

    pg_conn.commit()
    sqlite_conn.close()
    pg_conn.close()

    print("\nMigration complete.")
    summary = ", ".join(f"{t}={c}" for t, c in counts.items())
    print(f"Migrated: {summary}")


if __name__ == "__main__":
    main()
