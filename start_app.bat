@echo off
echo Starting ADAPT-Synthetix...
echo.

$env:PATH += ";C:\Users\viraj.DEEPA-S-LAPTOP\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-7.1-essentials_build\bin"

:: Check if virtual environment exists
if not exist "vir_env\Scripts\activate.bat" (
    echo [ERROR] Virtual environment 'vir_env' not found.
    pause
    exit /b
)

:: Activate environment and run backend
echo [1/2] Activating environment...
call vir_env\Scripts\activate

echo [2/2] Launching Backend ^& Frontend...
echo.
echo Application will be available at: http://localhost:5000
echo.

:: Automatically open the browser
start http://localhost:5000

:: Run the FastAPI server
uvicorn Backend.app:app --host 0.0.0.0 --port 5000 --reload

pause
