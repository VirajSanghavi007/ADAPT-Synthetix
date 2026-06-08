"""
conftest.py — Shared pytest setup.

Ensures Backend/ is on sys.path regardless of how pytest is invoked,
so all test files can do `import diagnostics` etc. without the Backend. prefix.
"""
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
for p in [str(ROOT), str(ROOT / "Backend")]:
    if p not in sys.path:
        sys.path.insert(0, p)

# Required auth env vars — set before any module imports auth.py.
# Tests run with AUTH_ENABLED=false so Google credentials are not required.
os.environ.setdefault("AUTH_SECRET_KEY", "test-only-secret-min-32-chars-xxxxxxx")
os.environ.setdefault("BACKDOOR_KEY",    "test-backdoor-key")
os.environ.setdefault("AUTH_ENABLED",    "false")
