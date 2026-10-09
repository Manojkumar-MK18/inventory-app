#!/usr/bin/env bash
# ============================================================================
# Builds the app and assembles a shippable "dist" folder containing ONLY the
# build (no source code), then zips it to pos-build.zip for the shop PC.
#
# NOTE: for a Windows shop PC, it's safest to build on Windows (package-build.bat).
# A build made on macOS/Linux usually runs on Windows too (this app uses pure-JS
# deps), but if you hit any "module not found" at runtime, rebuild on Windows.
# ============================================================================
set -e
cd "$(dirname "$0")"

echo "Building..."
npm run build

echo "Assembling dist..."
rm -rf dist
mkdir -p dist
cp -r .next/standalone/. dist/
cp -r .next/static dist/.next/static
[ -d public ] && cp -r public dist/public

for f in open-pos.bat update-pos.bat backup-pos.bat backup-pos.ps1 restore-pos.bat verify-backup.bat .env.production.example DEPLOY-WINDOWS.md; do
  [ -f "$f" ] && cp "$f" dist/
done

# HTTPS helper for the phone barcode scanner (so the phone camera is allowed).
mkdir -p dist/scripts
[ -f scripts/https-proxy.mjs ] && cp scripts/https-proxy.mjs dist/scripts/
cp docs/WIRELESS-SCANNER.md dist/ 2>/dev/null || true

# start script — localhost only (single device on this PC)
cat > dist/start-pos.bat <<'BAT'
@echo off
cd /d "%~dp0"
set NODE_ENV=production
set HOSTNAME=127.0.0.1
set PORT=3000
node server.js
BAT

# start script — on the shop Wi-Fi (needed for the phone scanner). Binds 0.0.0.0.
cat > dist/start-pos-lan.bat <<'BAT'
@echo off
cd /d "%~dp0"
set NODE_ENV=production
set HOSTNAME=0.0.0.0
set PORT=3000
echo Starting POS on the network (phone can reach it on the same Wi-Fi)...
node server.js
BAT

# start the HTTPS helper (run in a 2nd window, after start-pos-lan.bat).
cat > dist/start-https.bat <<'BAT'
@echo off
cd /d "%~dp0"
set TARGET_PORT=3000
set HTTPS_PORT=3443
echo Starting HTTPS helper on port 3443 (for the phone camera)...
echo Make a certificate first (see WIRELESS-SCANNER.md) into a "certs" folder here.
node scripts\https-proxy.mjs
BAT

echo "Creating pos-build.zip..."
rm -f pos-build.zip
(
  cd dist
  zip -r -q ../pos-build.zip .
)

echo ""
echo "DONE. Send pos-build.zip to the shop PC and unzip it to C:\\pos."
