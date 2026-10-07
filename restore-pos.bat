@echo off
REM Restore the database from a backup archive.
REM USAGE:  restore-pos.bat "C:\pos\backups\pos-YYYYMMDD-HHMMSS.archive.gz"
REM WARNING: this REPLACES the current data in the "pos" database.

cd /d "%~dp0"

if "%~1"=="" (
  echo Drag a backup file onto this script, or run:
  echo    restore-pos.bat "C:\pos\backups\pos-YYYYMMDD-HHMMSS.archive.gz"
  echo.
  echo Available backups:
  dir /b "%~dp0backups\pos-*.archive.gz"
  pause
  exit /b 1
)

echo This will REPLACE all current data with the backup:
echo    %~1
set /p CONFIRM="Type YES to continue: "
if /i not "%CONFIRM%"=="YES" (
  echo Cancelled.
  exit /b 1
)

REM If mongorestore isn't on PATH, set the full path here (MongoDB Database Tools bin).
set MONGORESTORE=mongorestore

%MONGORESTORE% --uri="mongodb://localhost:27017/pos?replicaSet=rs0" --gzip --archive="%~1" --drop
if %ERRORLEVEL% neq 0 (
  echo.
  echo RESTORE FAILED - see the message above.
) else (
  echo.
  echo Restore complete. Restart the POS service:  nssm restart POS
)
pause
