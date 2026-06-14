# Ballpark — restart the API dev server (port 3001) cleanly.
#
# Why: if a second server instance ever collides with a running one, the
# surviving process can end up owned by an elevated/other context that a
# normal shell can't kill ("access denied"). Run THIS as Administrator to
# free port 3001 and start a single fresh server.
#
# How to run:
#   Right-click this file -> "Run with PowerShell"  (choose "Yes" at the UAC prompt)
#   or, in an elevated PowerShell:  ./restart-dev-server.ps1
#
# It ONLY touches port 3001 (the API). Your Angular dev server on 4201 is
# left alone.

$ErrorActionPreference = 'Stop'
$port = 3001

Write-Host "== Ballpark API restart ==" -ForegroundColor Cyan
Write-Host "Looking for processes listening on port $port..."

$conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
$processIds = @($conns.OwningProcess | Select-Object -Unique)

if ($processIds.Count -eq 0) {
  Write-Host "Nothing is listening on $port." -ForegroundColor Yellow
}
else {
  foreach ($processId in $processIds) {
    $p = Get-Process -Id $processId -ErrorAction SilentlyContinue
    $name = if ($p) { $p.ProcessName } else { 'unknown' }
    Write-Host ("Killing PID {0} ({1})..." -f $processId, $name)
    try {
      Stop-Process -Id $processId -Force
      Write-Host ("  killed PID {0}" -f $processId) -ForegroundColor Green
    }
    catch {
      Write-Host ("  FAILED to kill PID {0}: {1}" -f $processId, $_.Exception.Message) -ForegroundColor Red
      Write-Host "  -> Make sure you ran this script AS ADMINISTRATOR." -ForegroundColor Red
    }
  }
  Start-Sleep -Seconds 2
}

# Confirm the port is free before starting a new one.
$still = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($still) {
  Write-Host "Port $port is STILL in use — not starting a new server. Resolve the above and re-run." -ForegroundColor Red
  exit 1
}
Write-Host "Port $port is free." -ForegroundColor Green

# Start one fresh server. This window stays attached to it (Ctrl+C to stop).
$serverDir = Join-Path $PSScriptRoot 'server'
Write-Host "Starting the API server (npm run dev) in $serverDir ..." -ForegroundColor Cyan
Set-Location $serverDir
npm run dev
