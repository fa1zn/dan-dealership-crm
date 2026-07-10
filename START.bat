@echo off
REM Double-click launcher for Dan (Windows). Keep this window open while you use the app.
cd /d "%~dp0"
cls
echo Starting Dan...
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   Node.js isn't installed yet. It's a one-time setup:
  echo.
  echo     1^) Go to  https://nodejs.org
  echo     2^) Click the big green LTS download button and install it
  echo     3^) Double-click START again
  echo.
  pause
  exit /b
)

if not exist node_modules (
  echo First-time setup - installing ^(about 1-2 minutes, needs internet^)...
  call npm install --no-audit --no-fund
  if errorlevel 1 ( echo. & echo Setup failed. Make sure you're online, then try again. & pause & exit /b )
)

if not exist .next (
  echo Preparing the app ^(first run only, about 30 seconds^)...
  call npm run build
  if errorlevel 1 ( echo. & echo Build failed. & pause & exit /b )
)

echo.
echo Dan is starting. Your browser will open at http://localhost:3000
echo Leave this window open while you use Dan. Close it to quit.
echo.
start "" http://localhost:3000
call npm run start
