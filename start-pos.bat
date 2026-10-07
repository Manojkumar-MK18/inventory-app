@echo off
REM Starts the POS production server. Run `npm run build` once before using this.
cd /d "%~dp0"
set NODE_ENV=production
REM Bound to this PC only (127.0.0.1) — other devices on the network cannot reach it.
call npx next start -H 127.0.0.1 -p 3000
