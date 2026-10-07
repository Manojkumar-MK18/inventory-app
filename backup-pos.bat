@echo off
REM Runs the daily backup. Schedule this with Task Scheduler (see DEPLOY-WINDOWS.md),
REM or double-click to back up right now.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0backup-pos.ps1"
if %ERRORLEVEL% neq 0 (
  echo.
  echo BACKUP FAILED - see the message above.
  pause
)
