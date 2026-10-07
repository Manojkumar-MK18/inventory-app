# Running the POS on a Windows shop PC (24/7, auto-start)

Goal: when the shop PC is switched on, MongoDB and the app start automatically and the
billing screen opens by itself — no commands to type each day.

There are two things that must always run:
1. **MongoDB** — the database (install as a Windows service → auto-starts).
2. **The POS app** — the Next.js server on port 3000 (we make it a service too).
Then a **startup shortcut** opens the browser to the app.

---

## How the app is delivered: ship the BUILD, not the source

You build the app **once** (on your dev machine) and send only the finished build — the
shop PC never sees the source code and never runs `npm install`.

**On your (developer) machine:**
```
package-build.bat      (on Windows)      —or—      ./package-build.sh   (on Mac/Linux)
```
This creates a **`dist`** folder and **`pos-build.zip`** (the contents of `dist`).
Send **`pos-build.zip`** to the shop PC.

> Best practice: build on **Windows** (same OS as the shop PC). A Mac/Linux build usually
> runs on Windows too (this app is pure-JS), but if you ever see a "module not found" at
> runtime, rebuild on Windows.

**On the shop PC:** unzip it to `C:\pos`. That's the whole app — no source, no `npm`.

---

## One-time setup (on the shop PC)

### 1. Install Node.js
- Download **Node.js LTS** from https://nodejs.org → install (accept defaults).
- Verify: open **Command Prompt** and run `node -v` (should print a version).
- *(Node is only needed to **run** the build — we do not install app dependencies here.)*

### 2. Install MongoDB and turn on the replica set (required for billing)
- Download **MongoDB Community Server (MSI)** from https://www.mongodb.com/try/download/community.
- Install → choose **"Complete"** and **"Install MongoDB as a Service"** (default). Also install **MongoDB Shell (mongosh)** (installer offers it, or download separately).
- Enable the replica set (our bills use transactions, which need it):
  1. Open `C:\Program Files\MongoDB\Server\<version>\bin\mongod.cfg` in Notepad **as Administrator**.
  2. Add these two lines at the end (watch the indentation — 2 spaces):
     ```
     replication:
       replSetName: rs0
     ```
  3. Save. Restart the service: press `Win+R` → `services.msc` → find **MongoDB Server** → right-click → **Restart**.
  4. Initialise it once: open Command Prompt and run:
     ```
     mongosh --eval "rs.initiate()"
     ```
     (You should see `"ok" : 1`. If it says "already initialized", that's fine.)

### 3. Put the build on the PC
- Unzip **`pos-build.zip`** into `C:\pos` (so `C:\pos\server.js` exists).
  That's the entire app — nothing to install.

### 4. Make the settings file (`.env.production`)

This one small text file tells the app where the database is and holds one secret key.
You do **not** change the database line — only paste one generated value. Do it exactly like this:

**4.1 — Make the file**
- Open the `C:\pos` folder.
- Find **`.env.production.example`**. Copy it (Ctrl+C, Ctrl+V) → you get a copy.
- Rename the copy to exactly **`.env.production`** (remove the `.example` part).

**4.2 — Generate the secret key**®
- Open **Command Prompt**, run:
  ```
  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  ```
- It prints one long line like `k3Jd...==`. **Select it and copy it.**

**4.3 — Put it in the file**
- Open **`.env.production`** in Notepad.
- Find the line `AUTH_SECRET="..."` and replace the inside-the-quotes part with the line you copied.
- **Leave every other line exactly as it is** — especially `MONGODB_URI` (it already points to
  the local database correctly). Save the file.

**Your finished `.env.production` should look like this** (only `AUTH_SECRET` is yours; the rest unchanged):
```
MONGODB_URI="mongodb://localhost:27017/pos?replicaSet=rs0"
AUTH_SECRET="k3JdQ9x...the-long-line-you-generated...=="
AUTH_URL="http://localhost:3000"

SMTP_HOST="smtp.gmail.com"
SMTP_PORT="465"
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM=""
```

Notes:
- `MONGODB_URI` — **use what's already there**, don't touch it. It means "the database on
  this same PC". It only changes if you move the database to another server.
- `AUTH_SECRET` — generate it **once** and never change it later (changing it logs everyone out).
- The `SMTP_*` lines can stay empty — they're only for "forgot password" emails. Empty just
  means a reset link is printed in the server window instead of emailed.

### 5. First run & create your shop
```
start-pos.bat
```
Open a browser to **http://localhost:3000**, register, create the shop, and add a few products.
The database indexes are created automatically on first use. Press `Ctrl+C` in the window to
stop it once you've confirmed it works.

---

## Make it run 24/7 and auto-start on boot

### A. Run the app as a Windows service (recommended — survives crashes & reboots)
Use **NSSM** (free, tiny):
1. Download NSSM from https://nssm.cc/download → unzip → copy `nssm.exe` (the 64-bit one) to `C:\pos`.
2. In an **Administrator** Command Prompt in `C:\pos`:
   ```
   nssm install POS
   ```
   In the window that opens:
   - **Path:** `C:\pos\start-pos.bat`
   - **Startup directory:** `C:\pos`
   - (Tab **Details** → Startup type: **Automatic**)
   - Click **Install service**.
3. Start it now:
   ```
   nssm start POS
   ```
It now starts automatically every boot and restarts if it ever crashes. (MongoDB already auto-starts from step 2.)

> To see logs / stop / restart later: `nssm status POS`, `nssm restart POS`, or use `services.msc`.

### B. Auto-open the billing screen when the shop user logs in
1. Press `Win+R` → type `shell:startup` → Enter (opens the Startup folder).
2. Right-click `open-pos.bat` (in `C:\pos`) → **Create shortcut** → move the shortcut into that Startup folder.
Now, a few seconds after login, the POS opens in a clean full-window browser.

> `open-pos.bat` assumes Chrome. If you use Edge, edit the file (there's a commented Edge line).

---

## Single-device setup (this configuration)
The server is bound to **this PC only** (`127.0.0.1`), so no other device on the Wi-Fi
can reach it — simplest and safest for one counter. Always use **http://localhost:3000**
on this machine.

> Want to add a second counter or a phone later? Change `-H 127.0.0.1` back to `-H 0.0.0.0`
> in `start-pos.bat`, `nssm restart POS`, and open `http://<pc-ip>:3000` from the other device
> (allow Node.js through Windows Firewall when prompted).

---

## Automatic daily backups

Your data lives only on this PC, so a daily backup is essential. The project includes
`backup-pos.bat` (+ `backup-pos.ps1`) which dumps the database to a compressed, timestamped
file in `C:\pos\backups`, keeps the **last 14 days**, and can optionally copy each backup to
a second place (pen drive / a synced Google Drive folder).

### 1. Install the MongoDB Database Tools (gives you `mongodump`/`mongorestore`)
Newer MongoDB doesn't bundle these. Download **"MongoDB Database Tools"** from
https://www.mongodb.com/try/download/database-tools → run the MSI (installs to
`C:\Program Files\MongoDB\Tools\...`). During install it's added to PATH; if not, edit the
`$MongoDump` line in `backup-pos.ps1` to the full path of `mongodump.exe`.

### 2. (Optional) send a copy off the PC
Open `backup-pos.ps1` and set `$CopyTo`, e.g.:
```
$CopyTo = "G:\My Drive\pos-backups"     # a Google Drive / OneDrive synced folder
```
Then each backup is also copied there automatically (off-site safety).

### 3. Test it once
Double-click `backup-pos.bat`. A file like `pos-20261004-020000.archive.gz` should appear in
`C:\pos\backups`.

### 4. Schedule it daily (Task Scheduler)
1. `Win+R` → `taskschd.msc` → **Create Task…** (not "Basic Task").
2. **General:** name `POS Daily Backup`; tick **"Run whether user is logged on or not"** and **"Run with highest privileges."**
3. **Triggers → New:** Daily, time **2:00 AM** (or any time the shop is closed). Also tick **"Repeat"**/add a second trigger **At startup** if you want a catch-up when the PC was off at 2 AM.
4. **Actions → New:** Program/script = `C:\pos\backup-pos.bat`; **Start in** = `C:\pos`.
5. **Settings:** tick **"Run task as soon as possible after a scheduled start is missed."**
6. Save (it may ask for the Windows password).

### Restoring from a backup
If you ever need to roll back:
```
restore-pos.bat "C:\pos\backups\pos-YYYYMMDD-HHMMSS.archive.gz"
```
It asks for confirmation (it **replaces** current data), then run `nssm restart POS`.

### Safely verify a backup (without touching live data) — do this once now
```
verify-backup.bat "C:\pos\backups\pos-YYYYMMDD-HHMMSS.archive.gz"
```
This restores the backup into a **temporary** database (`pos_restore_test`), prints a
collection-by-collection count comparison against your live `pos` data, and then drops the
temp database. Your real data is never touched. You want to see **"BACKUP OK - all
collections match."** This proves your backups are actually restorable before you ever rely
on one.

## Daily reality & safety
- **Updating the app later:** on your dev machine run `package-build` again, send the new
  `pos-build.zip`, unzip it over `C:\pos` (keep your `.env.production`), then right-click
  **`update-pos.bat` → Run as administrator** (it restarts the service so the new build
  loads). Your data in MongoDB is untouched by an app update.
- **Power:** a cheap UPS is worth it so a power cut doesn't corrupt the database mid-write.
- Keep `AUTH_SECRET` the same forever (changing it logs everyone out).
