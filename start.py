#!/usr/bin/env python3
"""
start.py — Universal Mercury launcher (Windows / Linux / macOS).

Usage:
    python start.py              # auto-build React if needed, open browser
    python start.py --port 8080  # custom port
    python start.py --no-browser # skip auto-open
    python start.py --skip-build # skip npm build step
"""
from __future__ import annotations

import argparse
import os
import platform
import shutil
import socket
import subprocess
import sys
import threading
import time
import webbrowser
from pathlib import Path

ROOT   = Path(__file__).resolve().parent
IS_WIN = platform.system() == "Windows"

# ── Colour helpers ────────────────────────────────────────────
def _colours():
    if IS_WIN and not (os.environ.get("WT_SESSION") or os.environ.get("ANSICON")):
        return "", "", "", "", ""
    return "\033[36m", "\033[32m", "\033[33m", "\033[31m", "\033[0m"

CYAN, GREEN, YELLOW, RED, NC = _colours()
def log(m):  print(f"{CYAN}[INFO]{NC}  {m}", flush=True)
def ok(m):   print(f"{GREEN}[OK]{NC}    {m}", flush=True)
def warn(m): print(f"{YELLOW}[WARN]{NC}  {m}", flush=True)
def err(m):  print(f"{RED}[ERROR]{NC} {m}", flush=True); sys.exit(1)


# ── Find Python ───────────────────────────────────────────────
def find_python() -> str:
    for name in ("python", "python3", "py"):
        if shutil.which(name):
            return name
    err("Python not found. Install Python 3.10+ from https://python.org")


# ── Find / create venv ────────────────────────────────────────
def resolve_venv(python_exe: str) -> Path:
    activate_rel = Path("Scripts" if IS_WIN else "bin") / ("activate.bat" if IS_WIN else "activate")
    for name in ("venv", ".venv", "vir_env"):
        if (ROOT / name / activate_rel).exists():
            ok(f"venv: {name}"); return ROOT / name
    log("No venv found — creating venv/")
    subprocess.run([python_exe, "-m", "venv", str(ROOT / "venv")], check=True)
    return ROOT / "venv"

def venv_python(venv: Path) -> str:
    p = venv / ("Scripts" if IS_WIN else "bin") / ("python.exe" if IS_WIN else "python")
    return str(p)


# ── Find npm / inject Node PATH ───────────────────────────────
def find_npm() -> str | None:
    if shutil.which("npm"):
        return "npm"
    candidates = [
        Path("C:/Program Files/nodejs"),
        Path("C:/Program Files (x86)/nodejs"),
        Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "nodejs",
    ]
    for p in candidates:
        npm = p / ("npm.cmd" if IS_WIN else "npm")
        if npm.exists():
            os.environ["PATH"] = str(p) + os.pathsep + os.environ["PATH"]
            ok(f"Node.js found at {p}")
            return "npm" if IS_WIN else str(npm)
    return None


# ── Install Python deps ───────────────────────────────────────
def install_python_deps(python: str) -> None:
    req = ROOT / "requirements.txt"
    if not req.exists():
        warn("requirements.txt not found"); return
    log("Checking Python dependencies…")
    r = subprocess.run([python, "-m", "pip", "install", "--quiet", "-r", str(req)],
                       capture_output=True)
    if r.returncode != 0:
        warn("Retrying pip install verbosely…")
        subprocess.run([python, "-m", "pip", "install", "-r", str(req)], check=True)
    ok("Python deps satisfied.")


# ── Build React ───────────────────────────────────────────────
def build_react(npm: str) -> None:
    react_dir  = ROOT / "frontend-react"
    build_flag = react_dir / "build" / "index.html"
    if build_flag.exists():
        ok("React build already present."); return
    log("Installing npm packages…")
    subprocess.run([npm, "install", "--silent"], cwd=str(react_dir), check=True)
    log("Building React…")
    subprocess.run([npm, "run", "build"], cwd=str(react_dir), check=True)
    ok("React build complete.")


# ── ffmpeg ────────────────────────────────────────────────────
def find_ffmpeg() -> None:
    if shutil.which("ffmpeg"):
        ok("ffmpeg found."); return
    for base in [
        Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft" / "WinGet" / "Packages",
        Path("C:/ffmpeg/bin"), Path("C:/tools/ffmpeg/bin"),
        Path("/usr/bin"), Path("/usr/local/bin"),
    ]:
        if not base.exists(): continue
        for exe in base.rglob("ffmpeg" + (".exe" if IS_WIN else "")):
            os.environ["PATH"] = str(exe.parent) + os.pathsep + os.environ["PATH"]
            ok(f"ffmpeg: {exe}"); return
    warn("ffmpeg not found — MP3/M4A upload may not work.")
    if IS_WIN:    warn("  Install: winget install Gyan.FFmpeg")
    elif platform.system() == "Darwin": warn("  Install: brew install ffmpeg")
    else:         warn("  Install: sudo apt install ffmpeg")


# ── Port check ────────────────────────────────────────────────
def port_free(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.3)
        return s.connect_ex(("127.0.0.1", port)) != 0


# ── Main ──────────────────────────────────────────────────────
def main() -> None:
    parser = argparse.ArgumentParser(description="Mercury launcher")
    parser.add_argument("--port",         type=int, default=int(os.environ.get("PORT", 5000)))
    parser.add_argument("--no-browser",   action="store_true")
    parser.add_argument("--skip-build",   action="store_true")
    args = parser.parse_args()

    print(f"\n  {'='*42}")
    print( "   Mercury  |  Startup")
    print(f"  {'='*42}\n")

    py_name = find_python()
    venv    = resolve_venv(py_name)
    python  = venv_python(venv)
    ok(f"Python: {python}")

    install_python_deps(python)
    find_ffmpeg()

    npm = find_npm()
    if npm and not args.skip_build:
        build_react(npm)
    elif not npm:
        react_build = ROOT / "frontend-react" / "build" / "index.html"
        if react_build.exists():
            ok("Using existing React build.")
        else:
            warn("Node.js not found and no build present.")
            warn("Install Node.js from https://nodejs.org, then re-run.")

    if not port_free(args.port):
        warn(f"Port {args.port} already in use — kill existing process or use --port XXXX")

    env = os.environ.copy()
    env["PYTHONPATH"] = f"{ROOT}{os.pathsep}{ROOT / 'Backend'}"

    url = f"http://localhost:{args.port}/"
    print(f"\n  UI  →  {url}")
    print( "  Press Ctrl+C to stop.\n")

    if not args.no_browser:
        def _open():
            time.sleep(2.5)
            webbrowser.open(url)
        threading.Thread(target=_open, daemon=True).start()

    cmd = [python, "-m", "uvicorn", "Backend.app:app",
           "--host", "0.0.0.0", "--port", str(args.port), "--reload"]
    log(f"Launching backend…")
    try:
        subprocess.run(cmd, env=env, cwd=str(ROOT))
    except KeyboardInterrupt:
        print("\n[INFO] Stopped.")


if __name__ == "__main__":
    main()
