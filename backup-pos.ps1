# Daily POS backup: dumps the MongoDB database to a timestamped, compressed archive,
# keeps the last N days, and (optionally) copies to a second location (pen drive / Drive).

$ErrorActionPreference = "Stop"

# --- Settings you can change ---
$Uri        = "mongodb://localhost:27017/pos?replicaSet=rs0"
$KeepDays   = 14                 # delete local backups older than this
$CopyTo     = ""                 # optional 2nd copy, e.g. "D:\pos-backups" or "G:\My Drive\pos-backups" (leave "" to skip)
# Path to mongodump. If MongoDB Database Tools are on your PATH, "mongodump" is enough.
# Otherwise set the full path, e.g. "C:\Program Files\MongoDB\Tools\100\bin\mongodump.exe"
$MongoDump  = "mongodump"
# -------------------------------

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$backupDir = Join-Path $here "backups"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$archive = Join-Path $backupDir "pos-$stamp.archive.gz"

Write-Host "Backing up to $archive ..."
& $MongoDump --uri="$Uri" --gzip --archive="$archive"
if ($LASTEXITCODE -ne 0) { throw "mongodump failed (exit $LASTEXITCODE)" }
Write-Host "Backup OK."

# Rotate: remove local backups older than KeepDays
$cutoff = (Get-Date).AddDays(-$KeepDays)
Get-ChildItem -Path $backupDir -Filter "pos-*.archive.gz" |
  Where-Object { $_.LastWriteTime -lt $cutoff } |
  ForEach-Object { Remove-Item $_.FullName -Force; Write-Host "Removed old backup $($_.Name)" }

# Optional second copy
if ($CopyTo -ne "") {
  New-Item -ItemType Directory -Force -Path $CopyTo | Out-Null
  Copy-Item $archive -Destination $CopyTo -Force
  Write-Host "Copied to $CopyTo"
}

Write-Host "Done."
