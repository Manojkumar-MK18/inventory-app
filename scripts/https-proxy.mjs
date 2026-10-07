// Minimal zero-dependency HTTPS front for the POS, so the phone camera works.
//
// Phone browsers only allow the camera on https:// . This script serves HTTPS
// on PORT (default 3443) using a local certificate and forwards every request
// (including the scanner SSE stream) to the normal Next.js app on TARGET.
//
//   node scripts/https-proxy.mjs
//
// Env vars:
//   HTTPS_PORT   port to serve HTTPS on            (default 3443)
//   TARGET_PORT  the Next app's http port          (default 3000)
//   CERT_DIR     folder holding cert.pem + key.pem (default ./certs)
//
// Generate the certificate first (see docs/WIRELESS-SCANNER.md), e.g. with mkcert:
//   mkcert -cert-file certs/cert.pem -key-file certs/key.pem <your-lan-ip> localhost 127.0.0.1

import https from "node:https";
import http from "node:http";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const HTTPS_PORT = Number(process.env.HTTPS_PORT || 3443);
const TARGET_PORT = Number(process.env.TARGET_PORT || 3000);
const CERT_DIR = process.env.CERT_DIR || "certs";

let key, cert;
try {
  key = readFileSync(join(CERT_DIR, "key.pem"));
  cert = readFileSync(join(CERT_DIR, "cert.pem"));
} catch {
  console.error(
    `\n[https-proxy] Could not read ${CERT_DIR}/key.pem and ${CERT_DIR}/cert.pem.\n` +
      `Create them first (see docs/WIRELESS-SCANNER.md). Quick option with mkcert:\n` +
      `  mkcert -install\n` +
      `  mkcert -cert-file ${CERT_DIR}/cert.pem -key-file ${CERT_DIR}/key.pem <your-lan-ip> localhost 127.0.0.1\n`
  );
  process.exit(1);
}

const server = https.createServer({ key, cert }, (req, res) => {
  const upstream = http.request(
    { host: "127.0.0.1", port: TARGET_PORT, method: req.method, path: req.url, headers: req.headers },
    (up) => {
      res.writeHead(up.statusCode || 502, up.headers);
      up.pipe(res); // streams responses (incl. SSE) straight through
    }
  );
  upstream.on("error", () => {
    res.writeHead(502);
    res.end("App not reachable on port " + TARGET_PORT);
  });
  req.pipe(upstream);
});

server.listen(HTTPS_PORT, "0.0.0.0", () => {
  console.log(`[https-proxy] HTTPS on https://0.0.0.0:${HTTPS_PORT}  ->  http://127.0.0.1:${TARGET_PORT}`);
  console.log(`[https-proxy] On the phone open:  https://<your-lan-ip>:${HTTPS_PORT}/scanner`);
});
