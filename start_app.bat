@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

title ADAPT-Synthetix
echo.
echo  =========================================
echo   ADAPT-Synthetix  ^|  Startup
echo  =========================================
echo.

:: ── Locate Python ─────────────────────────────────────────────────────────────
set "PYTHON_EXE="
for %%P in (python python3 py) do (
    where %%P >nul 2>nul
    if not errorlevel 1 if not defined PYTHON_EXE set "PYTHON_EXE=%%P"
)
if not defined PYTHON_EXE (
    echo [ERROR] Python not found. Install from https://python.org
    pause & exit /b 1
)
echo [OK] Python: %PYTHON_EXE%

:: ── Locate / create venv ──────────────────────────────────────────────────────
set "VENV_DIR="
for %%V in (venv .venv vir_env) do (
    if exist "%%V\Scripts\activate.bat" if not defined VENV_DIR set "VENV_DIR=%%V"
)
if not defined VENV_DIR (
    echo [INFO] Creating venv...
    %PYTHON_EXE% -m venv venv || ( echo [ERROR] venv failed. & pause & exit /b 1 )
    set "VENV_DIR=venv"
)
call "%VENV_DIR%\Scripts\activate.bat" || ( echo [ERROR] Activate failed. & pause & exit /b 1 )
echo [OK] venv: %VENV_DIR%

:: ── Install Python deps ───────────────────────────────────────────────────────
echo [1/4] Checking Python dependencies...
python -m pip install --quiet -r requirements.txt
if errorlevel 1 python -m pip install -r requirements.txt
echo [OK] Python deps ready.

:: ── Node.js PATH injection ────────────────────────────────────────────────────
set "NODE_EXE="
where npm >nul 2>nul && set "NODE_EXE=npm"
if not defined NODE_EXE (
    :: Common install paths
    for %%N in (
        "C:\Program Files\nodejs"
        "C:\Program Files (x86)\nodejs"
        "%LOCALAPPDATA%\Programs\nodejs"
    ) do (
        if exist "%%~N\npm.cmd" if not defined NODE_EXE (
            set "PATH=%%~N;!PATH!"
            set "NODE_EXE=npm"
            echo [OK] Node.js found at %%~N
        )
    )
)

:: ── Build React if needed ─────────────────────────────────────────────────────
if defined NODE_EXE (
    if not exist "frontend-react\build\index.html" (
        echo [2/4] Building React frontend...
        pushd frontend-react
        call npm install --silent
        call npm run build
        popd
        echo [OK] React build complete.
    ) else (
        echo [2/4] React build already up to date.
    )
) else (
    echo [2/4] Node.js not found - using existing build if available.
    echo        Install Node.js from https://nodejs.org for React frontend.
)

:: ── ffmpeg (optional) ─────────────────────────────────────────────────────────
set "FFMPEG_OK=0"
where ffmpeg >nul 2>nul && set "FFMPEG_OK=1"
if "!FFMPEG_OK!"=="0" (
    for %%F in (
        "%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg*\ffmpeg-*\bin"
        "%ProgramFiles%\ffmpeg\bin"
        "C:\ffmpeg\bin"
        "C:\tools\ffmpeg\bin"
    ) do if exist "%%~F\ffmpeg.exe" ( set "PATH=%%~F;!PATH!" & set "FFMPEG_OK=1" )
)
if "!FFMPEG_OK!"=="1" ( echo [OK] ffmpeg found.
) else ( echo [WARN] ffmpeg not found - MP3/M4A upload limited. & echo        Install: winget install Gyan.FFmpeg )

:: ── Set PYTHONPATH ────────────────────────────────────────────────────────────
set "PYTHONPATH=%CD%;%CD%\Backend"

:: ── Port check ────────────────────────────────────────────────────────────────
if not defined PORT set "PORT=5000"
netstat -ano | findstr ":!PORT! " >nul 2>nul
if not errorlevel 1 echo [WARN] Port !PORT! already in use.

:: ── Open browser ─────────────────────────────────────────────────────────────
echo.
echo  UI : http://localhost:!PORT!/
echo.
echo  Press Ctrl+C to stop.
echo.
timeout /t 2 /nobreak >nul
start "" "http://localhost:!PORT!/"

:: ── Launch ────────────────────────────────────────────────────────────────────
echo [4/4] Starting backend...
python -m uvicorn Backend.app:app --host 0.0.0.0 --port !PORT! --reload

echo.
echo [INFO] Server stopped.
pause
