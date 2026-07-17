@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

title Mercury
echo.
echo  =========================================
echo   Mercury  ^|  Startup
echo  =========================================
echo.

:: ── Python ────────────────────────────────────────────────────
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

:: ── venv ──────────────────────────────────────────────────────
set "VENV_DIR="
for %%V in (venv .venv vir_env) do (
    if exist "%%V\Scripts\activate.bat" if not defined VENV_DIR set "VENV_DIR=%%V"
)
if not defined VENV_DIR (
    echo [INFO] Creating venv...
    %PYTHON_EXE% -m venv venv || ( echo [ERROR] venv creation failed. & pause & exit /b 1 )
    set "VENV_DIR=venv"
)
call "%VENV_DIR%\Scripts\activate.bat" || ( echo [ERROR] Activate failed. & pause & exit /b 1 )
echo [OK] venv: %VENV_DIR%

:: ── Python deps ───────────────────────────────────────────────
echo [1/4] Checking Python dependencies...
python -m pip install --quiet -r requirements.txt
if errorlevel 1 python -m pip install -r requirements.txt
echo [OK] Python deps ready.

:: ── Node.js ───────────────────────────────────────────────────
set "NODE_EXE="
where npm >nul 2>nul && set "NODE_EXE=npm"
if not defined NODE_EXE (
    for %%N in ("C:\Program Files\nodejs" "C:\Program Files (x86)\nodejs" "%LOCALAPPDATA%\Programs\nodejs") do (
        if exist "%%~N\npm.cmd" if not defined NODE_EXE (
            set "PATH=%%~N;!PATH!"
            set "NODE_EXE=npm"
        )
    )
)

:: ── React build ───────────────────────────────────────────────
if defined NODE_EXE (
    if not exist "frontend-react\build\index.html" (
        echo [2/4] Building React frontend...
        pushd frontend-react
        call npm install --silent
        call npm run build
        popd
        echo [OK] React build complete.
    ) else (
        echo [2/4] React build up to date.
    )
) else (
    echo [2/4] Node.js not found - using existing build.
)

:: ── ffmpeg ────────────────────────────────────────────────────
set "FFMPEG_OK=0"
where ffmpeg >nul 2>nul && set "FFMPEG_OK=1"
if "!FFMPEG_OK!"=="0" (
    for %%F in (
        "%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg*\ffmpeg-*\bin"
        "%ProgramFiles%\ffmpeg\bin"
        "C:\ffmpeg\bin"
    ) do if exist "%%~F\ffmpeg.exe" ( set "PATH=%%~F;!PATH!" & set "FFMPEG_OK=1" )
)
if "!FFMPEG_OK!"=="1" ( echo [OK] ffmpeg found.
) else ( echo [WARN] ffmpeg not found - winget install Gyan.FFmpeg )

:: ── PYTHONPATH ────────────────────────────────────────────────
set "PYTHONPATH=%CD%;%CD%\Backend"
if not defined PORT set "PORT=5000"

echo.
echo [3/4] Starting backend on http://localhost:!PORT! ...
echo.

:: Start backend in background
start "ADAPT-Backend" /min python -m uvicorn Backend.app:app --host 0.0.0.0 --port !PORT! --reload

:: ── Wait for backend to be ready before opening browser ───────
echo [4/4] Waiting for backend to be ready...
set "READY=0"
set "ATTEMPTS=0"
:wait_loop
set /a "ATTEMPTS+=1"
if !ATTEMPTS! GTR 30 (
    echo [WARN] Backend taking longer than expected. Opening browser anyway...
    goto open_browser
)
timeout /t 1 /nobreak >nul
python -c "import urllib.request; urllib.request.urlopen('http://localhost:!PORT!/health', timeout=1)" >nul 2>nul
if not errorlevel 1 (
    set "READY=1"
    goto open_browser
)
goto wait_loop

:open_browser
echo [OK] Backend ready. Opening browser...
start "" "http://localhost:!PORT!/"

echo.
echo  UI : http://localhost:!PORT!/
echo  Press Ctrl+C in the backend window to stop.
echo.
pause
