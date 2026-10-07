// One command to run the POS on the shop Wi-Fi WITH https (so the phone camera
// works). Starts the app, waits for it, auto-creates a certificate if missing,
// then starts the https front — and prints the exact phone URL.
//
//   node scripts/serve-lan.mjs dev     (development)
//   node scripts/serve-lan.mjs start   (built app; run `next build` first)
//
// Env: PORT (app, default 3000), HTTPS_PORT (default 3443).

import { spawn, execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import net from "node:net";
import os from "node:os";

const mode = process.argv[2] === "dev" ? "dev" : "start";
const APP_PORT = Number(process.env.PORT || 3000);
const HTTPS_PORT = Number(process.env.HTTPS_PORT || 3443);

/** Is a TCP port already in use on this machine? */
function portInUse(port) {
  return new Promise((resolve) => {
    const s = net.connect({ port, host: "127.0.0.1" });
    s.on("connect", () => { s.destroy(); resolve(true); });
    s.on("error", () => { s.destroy(); resolve(false); });
  });
}

// Fail fast with a clear message if a previous run is still using the ports.
for (const port of [APP_PORT, HTTPS_PORT]) {
  if (await portInUse(port)) {
    console.error(
      `\n[serve-lan] Port ${port} is already in use — another POS is probably still running.\n` +
        `Close that window, or free the port and try again:\n` +
        (process.platform === "win32"
          ? `  Windows:  for /f "tokens=5" %a in ('netstat -ano ^| findstr :${port}') do taskkill /F /PID %a\n`
          : `  Mac/Linux:  lsof -tiTCP:${port} -sTCP:LISTEN | xargs kill -9\n`)
    );
    process.exit(1);
  }
}

function lanIp() {
  const ifaces = os.networkInterfaces();
  let fallback = "";
  for (const list of Object.values(ifaces)) {
    for (const ni of list ?? []) {
      if (ni.family === "IPv4" && !ni.internal) {
        if (ni.address.startsWith("192.168.") || ni.address.startsWith("10.")) return ni.address;
        fallback ||= ni.address;
      }
    }
  }
  return fallback;
}

function waitForPort(port, timeoutMs = 60000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const s = net.connect(port, "127.0.0.1");
      s.on("connect", () => { s.destroy(); resolve(); });
      s.on("error", () => {
        s.destroy();
        if (Date.now() - start > timeoutMs) reject(new Error("app did not start"));
        else setTimeout(tryOnce, 500);
      });
    };
    tryOnce();
  });
}

function ensureCert(ip) {
  if (existsSync("certs/cert.pem") && existsSync("certs/key.pem")) return true;
  mkdirSync("certs", { recursive: true });
  const san = `subjectAltName=IP:${ip || "127.0.0.1"},DNS:localhost,IP:127.0.0.1`;
  try {
    execSync(
      `openssl req -x509 -newkey rsa:2048 -nodes -keyout certs/key.pem -out certs/cert.pem -days 825 ` +
        `-subj "/CN=${ip || "localhost"}" -addext "${san}"`,
      { stdio: "ignore" }
    );
    console.log("[serve-lan] Created a self-signed certificate in certs/ (phone shows one 'Proceed' tap).");
    return true;
  } catch {
    console.error("[serve-lan] Could not auto-create a certificate (openssl missing). See docs/WIRELESS-SCANNER.md §11.");
    return false;
  }
}

const ip = lanIp();
console.log(`[serve-lan] Starting app (${mode}) on port ${APP_PORT}…`);
const app = spawn("npx", ["next", mode, "-H", "0.0.0.0", "-p", String(APP_PORT)], { stdio: "inherit", shell: true });

let proxy;
waitForPort(APP_PORT)
  .then(() => {
    if (!ensureCert(ip)) return;
    proxy = spawn("node", ["scripts/https-proxy.mjs"], {
      stdio: "inherit",
      shell: true,
      env: { ...process.env, TARGET_PORT: String(APP_PORT), HTTPS_PORT: String(HTTPS_PORT) },
    });
    console.log("\n==================================================");
    console.log(`  POS (this PC):   http://localhost:${APP_PORT}`);
    console.log(`  Phone scanner:   https://${ip || "<this-pc-ip>"}:${HTTPS_PORT}/scanner`);
    console.log("  (phone must be on the SAME Wi-Fi; allow the port in the firewall)");
    console.log("==================================================\n");
  })
  .catch((e) => console.error("[serve-lan]", e.message));

function shutdown() {
  app?.kill();
  proxy?.kill();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
