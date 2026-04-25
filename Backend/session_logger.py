import datetime
from config import LOGS_DIR

class SessionLogger:
    def __init__(self):
        # Create timestamped filename: session_[YYYYMMDD_HHMMSS].txt
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        self.filename = LOGS_DIR / f"session_{timestamp}.txt"
        
        # Ensure directory exists
        LOGS_DIR.mkdir(parents=True, exist_ok=True)
        
        # Open file in append mode
        self.file = open(self.filename, "a", encoding="utf-8")
        self.log("SESSION_START", "New session logger initialized")

    def log(self, event, detail):
        """Writes a timestamped line to the session log file."""
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        line = f"[{timestamp}] {event}: {detail}\n"
        self.file.write(line)
        self.file.flush()  # Ensure it's written immediately

    def close(self):
        """Closes the log file session."""
        if not self.file.closed:
            self.log("SESSION_END", "Session logger closed")
            self.file.close()

    def __del__(self):
        """Ensure file is closed when object is destroyed."""
        try:
            if hasattr(self, 'file') and not self.file.closed:
                self.close()
        except Exception:
            pass
