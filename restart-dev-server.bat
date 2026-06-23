@echo off
REM ============================================================
REM  Ballpark - restart the API dev server (port 3001) cleanly.
REM
REM  Run AS ADMINISTRATOR: right-click this file -> "Run as administrator".
REM  (A stuck server instance can be owned by an elevated context that a
REM   normal shell can't kill.)
REM
REM  It ONLY touches port 3001 (the API). Your Angular dev server on
REM  4201 is left alone.
REM ============================================================
setlocal enabledelayedexpansion
set PORT=3001

echo == Ballpark API restart ==
echo Looking for processes listening on port %PORT%...

set FOUND=
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT% " ^| findstr "LISTENING"') do (
  echo Killing PID %%a ...
  taskkill /F /PID %%a
  set FOUND=1
)
if not defined FOUND echo   Nothing was listening on %PORT%.

timeout /t 2 /nobreak >nul

REM Confirm the port is free before starting a new server.
netstat -ano | findstr ":%PORT% " | findstr "LISTENING" >nul
if not errorlevel 1 (
  echo Port %PORT% is STILL in use - resolve the above ^(run as admin^) and re-run.
  pause
  exit /b 1
)
echo Port %PORT% is free.

echo Starting the API server ^(npm run dev^)...
cd /d "%~dp0server"
call npm run dev
