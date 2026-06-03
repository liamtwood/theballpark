# Ballpark — Dev Startup Script
# Run from repo root: .\dev-start.ps1

Write-Host ""
Write-Host "========================================" -ForegroundColor DarkYellow
Write-Host "  Ballpark Dev Environment Starting..." -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor DarkYellow
Write-Host ""

# Check Node is available
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: Node.js not found. Is it installed?" -ForegroundColor Red
    exit 1
}

# Start backend in a new terminal window
Write-Host "Starting backend (port 3001)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\server'; npm run dev" -WindowStyle Normal

# Brief pause so backend gets a head start
Start-Sleep -Seconds 2

# Start frontend in a new terminal window
Write-Host "Starting frontend (port 4200)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\client-angular'; npm start" -WindowStyle Normal

Write-Host ""
Write-Host "----------------------------------------" -ForegroundColor DarkGray
Write-Host "  Backend:   http://localhost:3001" -ForegroundColor Green
Write-Host "  Frontend:  http://localhost:4200" -ForegroundColor Green
Write-Host "----------------------------------------" -ForegroundColor DarkGray
Write-Host ""
Write-Host "Both services starting in separate windows." -ForegroundColor Gray
Write-Host "This window can be closed." -ForegroundColor Gray
Write-Host ""
