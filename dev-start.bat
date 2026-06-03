@echo off
echo.
echo ========================================
echo   Ballpark Dev Environment Starting...
echo ========================================
echo.

echo Starting backend (port 3001)...
start "Ballpark Backend" cmd /k "cd /d %~dp0server && npm run dev"

timeout /t 2 /nobreak >nul

echo Starting frontend (port 4200)...
start "Ballpark Frontend" cmd /k "cd /d %~dp0client-angular && npm start"

echo.
echo ----------------------------------------
echo   Backend:   http://localhost:3001
echo   Frontend:  http://localhost:4200
echo ----------------------------------------
echo.
echo Both services starting in separate windows.
echo This window can be closed.
echo.
