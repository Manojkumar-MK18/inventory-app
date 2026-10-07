@echo off
REM ============================================================================
REM Run this AFTER you've copied the new build files over C:\pos.
REM It restarts the POS app service so the new build takes effect.
REM Right-click -> "Run as administrator" (restarting a service needs admin).
REM ============================================================================
cd /d "%~dp0"

echo Restarting the POS service...
nssm restart POS
if %ERRORLEVEL% neq 0 (
  echo.
  echo Could not restart the service.
  echo  - Make sure you ran this as administrator (right-click - Run as administrator).
  echo  - Make sure the service exists: nssm status POS
  pause
  exit /b 1
)

echo.
echo Done. The POS is now running the updated build.
echo Open http://localhost:3000 to check.
timeout /t 5 /nobreak >nul
