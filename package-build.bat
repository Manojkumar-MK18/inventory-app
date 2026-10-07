@echo off
REM ============================================================================
REM Builds the app and assembles a shippable "dist" folder containing ONLY the
REM build (no source code), then zips it to pos-build.zip for the shop PC.
REM Run this on a WINDOWS machine (same OS as the shop PC) for a safe build.
REM ============================================================================
cd /d "%~dp0"

echo Building...
call npm run build || (echo BUILD FAILED & pause & exit /b 1)

echo Assembling dist...
if exist dist rmdir /s /q dist
mkdir dist

REM 1) the self-contained server + its node_modules
xcopy /e /i /y ".next\standalone\*" "dist\" >nul
REM 2) the static assets (CSS/JS chunks) and public files the server serves
xcopy /e /i /y ".next\static" "dist\.next\static" >nul
if exist public xcopy /e /i /y "public" "dist\public" >nul

REM 3) helper scripts + env template + guide (don't ship real .env / secrets)
copy /y open-pos.bat dist\ >nul
copy /y update-pos.bat dist\ >nul
copy /y backup-pos.bat dist\ >nul
copy /y backup-pos.ps1 dist\ >nul
copy /y restore-pos.bat dist\ >nul
copy /y verify-backup.bat dist\ >nul
copy /y .env.production.example dist\ >nul
if exist DEPLOY-WINDOWS.md copy /y DEPLOY-WINDOWS.md dist\ >nul

REM 4) the start script for the standalone build (runs node server.js, localhost only)
(
echo @echo off
echo cd /d "%%~dp0"
echo set NODE_ENV=production
echo set HOSTNAME=127.0.0.1
echo set PORT=3000
echo node server.js
) > dist\start-pos.bat

echo Creating pos-build.zip...
if exist pos-build.zip del /q pos-build.zip
powershell -NoProfile -Command "Compress-Archive -Path 'dist\*' -DestinationPath 'pos-build.zip'" || (echo ZIP FAILED & pause & exit /b 1)

echo.
echo DONE. Send pos-build.zip to the shop PC and unzip it to C:\pos.
pause
