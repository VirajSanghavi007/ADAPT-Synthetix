@echo off
setlocal

cd /d "%~dp0"

echo Starting ADAPT-Synthetix...
echo.

set "FFMPEG_BIN=%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-7.1-essentials_build\bin"
if exist "%FFMPEG_BIN%\ffmpeg.exe" (
    set "PATH=%PATH%;%FFMPEG_BIN%"
)

set "VENV_DIR=vir_env"
if exist ".venv\Scripts\activate.bat" set "VENV_DIR=.venv"
if exist "venv\Scripts\activate.bat" set "VENV_DIR=venv"
if exist "vir_env\Scripts\activate.bat" set "VENV_DIR=vir_env"

if not exist "%VENV_DIR%\Scripts\activate.bat" (
    echo [INFO] Virtual environment not found. Creating %VENV_DIR%...
    call :find_python
    if errorlevel 1 goto :python_missing
    "%PYTHON_EXE%" -m venv "%VENV_DIR%"
    if errorlevel 1 goto :venv_failed
)

echo [1/3] Activating environment...
call "%VENV_DIR%\Scripts\activate.bat"
if errorlevel 1 goto :activate_failed

echo [2/3] Installing/updating dependencies...
python -m pip install -r requirements.txt
if errorlevel 1 goto :deps_failed

echo [3/3] Launching backend...
echo.
echo Application will be available at: http://localhost:5000
echo.

start "" http://localhost:5000
uvicorn Backend.app:app --host 0.0.0.0 --port 5000 --reload

pause
exit /b 0

:find_python
set "PYTHON_EXE="
where python >nul 2>nul
if not errorlevel 1 (
    set "PYTHON_EXE=python"
    exit /b 0
)
where py >nul 2>nul
if not errorlevel 1 (
    set "PYTHON_EXE=py"
    exit /b 0
)
exit /b 1

:python_missing
echo [ERROR] Python was not found on PATH.
echo Install Python 3.10+ or open this project from a terminal where python is available.
pause
exit /b 1

:venv_failed
echo [ERROR] Failed to create virtual environment '%VENV_DIR%'.
pause
exit /b 1

:activate_failed
echo [ERROR] Failed to activate virtual environment '%VENV_DIR%'.
pause
exit /b 1

:deps_failed
echo [ERROR] Failed to install dependencies from requirements.txt.
pause
exit /b 1
