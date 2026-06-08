"""Smoke test for seed_demo.py — verifies it populates the DB correctly."""
import os
import sys
from pathlib import Path
from unittest.mock import patch

ROOT    = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "Backend"
for p in [str(ROOT), str(BACKEND)]:
    if p not in sys.path:
        sys.path.insert(0, p)


def test_seed_demo_populates_transcriptions(tmp_path):
    db_file = tmp_path / "seed_test.db"
    env = {"DB_PATH": str(db_file), "DB_DIR": str(tmp_path), "USE_POSTGRES": "false"}
    with patch.dict(os.environ, env):
        import importlib
        import config
        importlib.reload(config)
        import database
        importlib.reload(database)
        import seed_demo
        importlib.reload(seed_demo)

        seed_demo.seed(count=40, clear=False)

        with database._get_conn() as conn:
            row = conn.execute("SELECT COUNT(*) AS n FROM transcriptions").fetchone()
            count = int(row["n"])
            # Verify none have NULL confidence_score
            null_conf = conn.execute(
                "SELECT COUNT(*) AS n FROM transcriptions WHERE confidence_score IS NULL"
            ).fetchone()

    assert count >= 40, f"Expected >= 40 rows, got {count}"
    assert int(null_conf["n"]) == 0, "Some rows have NULL confidence_score after seeding"
