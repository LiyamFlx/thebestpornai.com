@echo off
REM StreamHub Platform - Windows launcher
REM Double-click to start. Serves the folder locally and opens the persona selector.
cd /d "%~dp0"
set PORT=8000
echo Starting StreamHub on http://localhost:%PORT% ...
echo Leave this window open while using the apps. Close it to stop.
start "" cmd /c "timeout /t 2 >nul & start http://localhost:%PORT%/index.html"
python -m http.server %PORT% 2>nul || py -3 -m http.server %PORT%
if errorlevel 1 (
  echo.
  echo Could not find Python. Install Python 3 from https://www.python.org/downloads/ then run again.
  pause
)
