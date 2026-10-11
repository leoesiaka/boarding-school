@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>&1
if errorlevel 1 (
  where python >nul 2>&1
  if errorlevel 1 (
    echo Python was not found. Install Python 3 or open index.html in a browser with internet access.
    pause
    exit /b 1
  )
  start "" cmd /c "timeout /t 2 ^>nul ^& start http://127.0.0.1:8000"
  python -m http.server 8000
) else (
  start "" cmd /c "timeout /t 2 ^>nul ^& start http://127.0.0.1:8000"
  py -m http.server 8000
)
pause
