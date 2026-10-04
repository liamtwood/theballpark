# Weekly source backup.
# Zips every work-file (tracked + untracked), automatically excluding anything
# gitignored (node_modules, .angular, dist, .claude, bp_old, *.zip).
# Output: ballpark-source-YYYY-MM-DD.zip at the repo root — copy it to cloud storage.
# Run:  powershell -File scripts\backup-source.ps1
$ErrorActionPreference = 'Stop'
Set-Location "$PSScriptRoot\.."
$out = "ballpark-source-$(Get-Date -Format 'yyyy-MM-dd').zip"
git ls-files --cached --others --exclude-standard | tar -a -cf $out -T -
"{0}  ({1:N0} MB)" -f $out, ((Get-Item $out).Length / 1MB)
