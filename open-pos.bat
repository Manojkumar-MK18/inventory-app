@echo off
REM Opens the POS in a clean full-window Chrome (no address bar). Put a shortcut to
REM this file in the Startup folder so the UI opens automatically when Windows starts.
REM Waits a few seconds first so the server is ready after boot.
timeout /t 8 /nobreak >nul
start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" --app=http://localhost:3000 --start-maximized
REM If Chrome is elsewhere, or you use Edge, replace the line above, e.g.:
REM start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app=http://localhost:3000
