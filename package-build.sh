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

# start script for the standalone build (localhost only)
cat > dist/start-pos.bat <<'BAT'
@echo off
cd /d "%~dp0"
set NODE_ENV=production
set HOSTNAME=127.0.0.1
set PORT=3000
node server.js
BAT

echo "Creating pos-build.zip..."
rm -f pos-build.zip
(
  cd dist
  zip -r -q ../pos-build.zip .
)

echo ""
echo "DONE. Send pos-build.zip to the shop PC and unzip it to C:\\pos."
