"""
conftest.py — Shared pytest setup.

Ensures Backend/ is on sys.path regardless of how pytest is invoked,
so all test files can do `import diagnostics` etc. without the Backend. prefix.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
for p in [str(ROOT), str(ROOT / "Backend")]:
    if p not in sys.path:
        sys.path.insert(0, p)
