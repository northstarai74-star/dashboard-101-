# Daily backup of the local Business OS database to a folder OUTSIDE OneDrive, so business data is not synced to the cloud.
# Keeps the 14 most recent backups. Run by the "BOS database backup" scheduled task.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$backupDir = "C:\Users\DELL\bos-backups"
$pgDump = "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe"
$keep = 14

New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

# Read DATABASE_URL from the local .env (never printed).
$line = Get-Content (Join-Path $root ".env") | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
$url = ($line -replace '^DATABASE_URL="?', '') -replace '"?\s*$', ''
if ($url -notmatch '^postgresql://([^:]+):([^@]+)@([^:/]+):(\d+)/([^?]+)') { throw "DATABASE_URL is not in the expected format" }
$user, $pass, $dbHost, $port, $name = $matches[1], [uri]::UnescapeDataString($matches[2]), $matches[3], $matches[4], $matches[5]

$stamp = Get-Date -Format "yyyy-MM-dd_HHmm"
$file = Join-Path $backupDir "bos_$stamp.dump"
$env:PGPASSWORD = $pass
try {
  & $pgDump -h $dbHost -p $port -U $user -d $name -F c -f $file
  if ($LASTEXITCODE -ne 0) { throw "pg_dump exited with code $LASTEXITCODE" }
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}

Get-ChildItem $backupDir -Filter "bos_*.dump" | Sort-Object LastWriteTime -Descending | Select-Object -Skip $keep | Remove-Item -Force
"[$(Get-Date -Format s)] backup written: $file" | Add-Content (Join-Path $backupDir "backup.log")
