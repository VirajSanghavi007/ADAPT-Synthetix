#!/usr/bin/env bash
# start_app.sh — Cross-platform launcher for Mercury (Linux / macOS)
set -euo pipefail
cd "$(dirname "$0")"

CYAN='\033[0;36m' GREEN='\033[0;32m' YELLOW='\033[1;33m' RED='\033[0;31m' NC='\033[0m'
log()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()   { echo -e "${GREEN}[OK]${NC}    $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()  { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

echo ""
echo "  ========================================="
echo "   Mercury  |  Startup"
echo "  ========================================="
echo ""

# ── Python ────────────────────────────────────────────────────────────────────
PYTHON=""
for P in python3 python python3.11 python3.12 python3.13 python3.14; do
    if command -v "$P" &>/dev/null; then PYTHON="$P"; break; fi
done
[ -z "$PYTHON" ] && err "Python 3.10+ not found. Install from https://python.org"
ok "Python: $PYTHON ($($PYTHON --version 2>&1))"

# ── venv ──────────────────────────────────────────────────────────────────────
VENV_DIR=""
for V in venv .venv vir_env; do
    [ -f "$V/bin/activate" ] && { VENV_DIR="$V"; break; }
done
if [ -z "$VENV_DIR" ]; then
    log "No venv found. Creating venv..."
    $PYTHON -m venv venv || err "Failed to create venv"
    VENV_DIR="venv"
fi
ok "venv: $VENV_DIR"

# shellcheck disable=SC1090
source "$VENV_DIR/bin/activate"

# ── Dependencies ──────────────────────────────────────────────────────────────
log "Checking dependencies..."
pip install --quiet -r requirements.txt || {
    warn "Quiet install had issues. Retrying verbosely..."
    pip install -r requirements.txt || err "Dependency install failed"
}
ok "Dependencies satisfied."

# ── ffmpeg ────────────────────────────────────────────────────────────────────
if command -v ffmpeg &>/dev/null; then
    ok "ffmpeg found."
else
    warn "ffmpeg not found — MP3/M4A upload may not work."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        warn "  Install with: brew install ffmpeg"
    else
        warn "  Install with: sudo apt install ffmpeg  (or your distro's package manager)"
    fi
fi

# ── PYTHONPATH ────────────────────────────────────────────────────────────────
export PYTHONPATH="$(pwd):$(pwd)/Backend"

# ── Port ──────────────────────────────────────────────────────────────────────
PORT="${PORT:-5000}"
if lsof -i ":$PORT" -sTCP:LISTEN &>/dev/null 2>&1; then
    warn "Port $PORT already in use — set PORT env var to override."
fi

# ── Optional React frontend ───────────────────────────────────────────────────
REACT_STARTED=0
if command -v npm &>/dev/null && [ -f "frontend-react/package.json" ]; then
    log "npm found — starting React dev server on :3000 (background)..."
    (cd frontend-react && npm install --silent && npm run dev) &
    REACT_STARTED=1
fi

# ── Open browser ─────────────────────────────────────────────────────────────
(
    sleep 3
    URL="http://localhost:$PORT/"
    [ "$REACT_STARTED" = "1" ] && URL="http://localhost:3000/app"
    if [[ "$OSTYPE" == "darwin"* ]]; then open "$URL"
    elif command -v xdg-open &>/dev/null; then xdg-open "$URL"
    fi
) &

# ── Launch backend ────────────────────────────────────────────────────────────
echo ""
if [ "$REACT_STARTED" = "1" ]; then
    echo "  Vanilla UI : http://localhost:$PORT/"
    echo "  React UI   : http://localhost:3000/app  (starting...)"
else
    echo "  UI : http://localhost:$PORT/"
fi
echo ""
echo "  Press Ctrl+C to stop."
echo ""

log "Launching uvicorn..."
python -m uvicorn Backend.app:app --host 0.0.0.0 --port "$PORT" --reload
