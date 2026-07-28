@echo off
setlocal

cd /d "%~dp0"

if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
)

call venv\Scripts\activate.bat

echo Installing backend dependencies...
pip install -q -r requirements.txt

echo Installing frontend dependencies...
cd frontend-next
call npm install --silent
echo Building frontend...
call npm run build
cd ..

echo Starting backend...
start "Mercury Backend" cmd /c "call venv\Scripts\activate.bat && uvicorn Backend.main:app --host 127.0.0.1 --port 8000"

echo Waiting for backend to become ready...
:waitloop
curl -s -o nul -w "%%{http_code}" http://127.0.0.1:8000/api/health > "%TEMP%\mercury_health.txt" 2>nul
set /p HEALTH=<"%TEMP%\mercury_health.txt"
if not "%HEALTH%"=="200" (
    timeout /t 1 /nobreak > nul
    goto waitloop
)

echo Backend ready. Opening browser...
start "" http://127.0.0.1:8000

endlocal
