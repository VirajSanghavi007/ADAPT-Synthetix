"""
session_logger.py — Structured session event logger.

Fixes:
  • Uses structured logging format (JSON-lines) for machine readability
  • close() is idempotent and safe to call multiple times
  • __del__ removed — caller (app.py lifespan) is responsible for close()
  • Rotation: keeps only last 50 log files
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

from config import LOGS_DIR

_MAX_LOGS = 50  # maximum number of session log files to keep


class SessionLogger:
    def __init__(self) -> None:
        LOGS_DIR.mkdir(parents=True, exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        self._path = LOGS_DIR / f"session_{ts}.jsonl"
        self._fh   = self._path.open("a", encoding="utf-8")
        self._closed = False
        self._rotate()
        self.log("SESSION_START", "Logger initialised")

    def log(self, event: str, detail: str) -> None:
        if self._closed:
            return
        entry = {
            "ts":     datetime.now(timezone.utc).isoformat(),
            "event":  event,
            "detail": detail,
        }
        try:
            self._fh.write(json.dumps(entry) + "\n")
            self._fh.flush()
        except Exception as exc:
            logging.warning("SessionLogger write error: %s", exc)

    def close(self) -> None:
        if self._closed:
            return
        self.log("SESSION_END", "Logger closed")
        self._fh.close()
        self._closed = True

    def _rotate(self) -> None:
        """Delete oldest log files if count exceeds _MAX_LOGS."""
        logs = sorted(LOGS_DIR.glob("session_*.jsonl"), key=lambda p: p.stat().st_mtime)
        for old in logs[:-_MAX_LOGS]:
            try:
                old.unlink()
            except Exception:
                pass
