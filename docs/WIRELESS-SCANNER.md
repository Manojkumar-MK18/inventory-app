# Wireless Barcode Scanner — Feasibility & Free Implementation Plan

**Question:** Can we use a mobile phone as a wireless barcode scanner for the POS, easily and for free?

**Short answer:** **Yes — 100% free and doable.** But the proposed design uses a separate **FastAPI (Python)** backend. Our app is already **Next.js + MongoDB** on a single shop PC. Adding FastAPI means *two servers, two languages, two things to keep running* on one Windows machine — more work, not less. We can get the **exact same phone-scanner experience inside the existing Next.js app**, with no Python, no paid service, and fewer moving parts.

This document assesses the approach and gives the cheapest, simplest path.

---

## 1. Verdict on the proposed design

| Proposed | Our recommendation | Why |
|---|---|---|
| **FastAPI** backend | **Reuse the existing Next.js server** (API routes) | One stack, one process, already deployed. No Python runtime to install/run on the shop PC. |
| **WebSocket** (two-way) | **Server-Sent Events (SSE)** — one-way server→phone→POS | The POS only needs to *receive* scans. SSE works in a plain Next.js route handler; a WebSocket server needs a custom server wrapper around Next's standalone build. SSE = less code, same result. |
| Phone → WS → backend | Phone → **HTTP POST** → backend | Sending one barcode is a tiny POST. No persistent socket needed *from* the phone. |
| Separate `frontend/` + `backend/` tree | **Add a `/scanner` page + 2 API routes** to this repo | Nothing new to deploy. |

Everything else in the design (barcode → lookup → add to bill → stock updates only on payment) is correct and we keep it.

**Cost: ₹0 in software.** (Optional hardware alternative in §7.)

---

## 2. Recommended architecture (free, on our stack)

```text
   📱 PHONE (same Wi-Fi)                 💻 LAPTOP / SHOP PC
   https://<pc-ip>:3000/scanner          https://<pc-ip>:3000/pos
        │                                        │
        │ camera scans barcode                   │ opens SSE stream
        │ (zxing / BarcodeDetector)              │  GET /api/scan/stream?pair=XY12
        ▼                                        ▲
   POST /api/scan  { barcode, pair:"XY12" } ─────┤  (event pushed back)
        │                                        │
        └──────────────► Next.js API route ──────┘
                               │
                               │ product lookup (existing code)
                               ▼
                           MongoDB  (products / variants / stock)
```

- **Pairing code (`pair`)**: the POS screen shows a short code **or a QR**. The phone enters/scans it once to pair to *that* billing screen. This stops scans from going to the wrong counter and needs no login on the phone.
- **In-memory hub**: because we run **one** Node process on the shop PC, the server can hold the list of connected POS screens in memory (a `Map<pairCode, client>`). No Redis, no extra service.

---

## 3. Real-time transport — why SSE (and the free alternatives)

| Option | Free? | Effort on our stack | Notes |
|---|---|---|---|
| **SSE (recommended)** | ✅ | Low | One Next.js route returns a `text/event-stream`. Perfect for "push scan to POS". |
| WebSocket | ✅ | Medium–High | Needs a custom Node server wrapping Next standalone, or a second `ws` process. Overkill for one-way. |
| Short polling | ✅ | Lowest | POS asks `/api/scan/latest?pair=XY12` every ~400 ms; store last scan in Mongo or memory. Dead simple, ~0.4 s lag. Good fallback. |

SSE gives instant feel with the least code. Polling is the *absolute simplest* if SSE ever misbehaves.

---

## 4. ⚠️ The ONE real gotcha: camera needs HTTPS

This is the only thing that makes it "not 5 minutes", and it's free to solve.

Phone browsers **only allow camera access (`getUserMedia`) on a secure context** = `https://…` **or** `http://localhost`. When the phone opens `http://<pc-ip>:3000/scanner` over Wi-Fi, that is **plain http on an IP → camera is blocked**.

**Free fixes (pick one):**

1. **mkcert** (free, open-source) — *recommended.*
   - On the shop PC: `mkcert -install` then `mkcert <pc-ip> localhost` → gives a locally-trusted certificate.
   - Run Next with that cert (HTTPS) and install the mkcert **root CA on the phone** once.
   - Result: `https://<pc-ip>:3000/scanner` with the camera working and **no browser warning**.
2. **Self-signed cert** — same idea but the phone shows a one-time "not secure" warning you tap through. Zero setup, slightly ugly.
3. **Android Chrome flag** `chrome://flags/#unsafely-treat-insecure-origin-as-secure` — works but not shopkeeper-friendly.

> Because the shop PC + phone are on the **same local Wi-Fi**, no internet, cloud, or paid tunnel is needed. Everything stays on the LAN.

Also: today `start-pos.bat` binds to `127.0.0.1` (this PC only). To let the phone reach it, bind `0.0.0.0` (already documented as an option in `DEPLOY-WINDOWS.md`) and allow the port through Windows Firewall.

---

## 5. Free barcode-reading in the browser (no paid SDK)

| Library | License | Notes |
|---|---|---|
| **`BarcodeDetector`** (native) | Built into Android Chrome | Zero dependency, fastest. Not on iOS Safari yet. |
| **`@zxing/browser`** | MIT | Cross-platform (incl. iPhone), reliable, widely used. **Recommended default.** |
| **`html5-qrcode`** | Apache-2.0 | Easiest drop-in, supports many 1D/2D formats. |

All open-source and free. Plan: use `BarcodeDetector` when present, fall back to `@zxing/browser`.

---

## 6. Security (keep the design's §11)

The phone **never** touches stock. It only sends a barcode string. The Next.js backend owns the whole chain:

```text
barcode → product lookup → add to bill → payment → stock update
```

Stock is decremented **only when the bill is generated** — exactly how our `saleRepo` already works today. A lost/extra scan can at most add a line to the open cart, which the cashier can remove. No scanner can change stock directly.

Pairing codes also expire with the billing session, so a stale phone tab can't inject scans into a new bill.

---

## 7. Even cheaper / simpler alternative worth knowing

A **USB or Bluetooth barcode scanner** (₹400–₹900 one-time) behaves like a **keyboard**: it "types" the barcode then an Enter.

Our POS search box **already supports this today** — it reads a barcode and adds the item on Enter (`PosScreen` search → `addEntry`). So a keyboard-wedge scanner needs **zero code and zero HTTPS setup**. 

- **Phone scanner** = ₹0 hardware, but needs the HTTPS step and good phone-camera focus.
- **USB/BT scanner** = tiny one-time cost, but rock-solid, instant, and already works.

Recommendation: ship the phone-scanner for flexibility, but tell the shop a ₹500 USB scanner is the most reliable counter setup.

---

## 8. Concrete implementation plan (maps to this repo)

No FastAPI. All inside the current Next.js app:

```text
app/(app)/pos/page.tsx          → show a Pair code / QR on the billing screen
components/pos/PosScreen.tsx     → open SSE stream; on PRODUCT_FOUND call existing addEntry()
app/scanner/page.tsx             → NEW mobile page: camera scanner + pair-code entry
app/api/scan/route.ts            → NEW POST: { barcode, pair } → product lookup → push to POS via hub
app/api/scan/stream/route.ts     → NEW GET: SSE stream the POS subscribes to (by pair code)
lib/scanHub.ts                   → NEW in-memory Map<pair, Set<client>> (single Node process)
repositories/… (reuse)           → barcode→product lookup already exists (ProductModel by barcode/variant barcode)
```

Message types (kept simple, from the design's §9):

```text
BARCODE_SCANNED      (phone → server, as POST body)
PRODUCT_FOUND        (server → POS, via SSE)
PRODUCT_NOT_FOUND    (server → POS, via SSE)
CONNECTION_STATUS    (server → POS, via SSE)
```

Rough effort: **~1 day** for a working MVP (scanner page + 2 routes + hub + POS wiring), plus the one-time **mkcert HTTPS** setup for the camera.

Note on data model: the design mentions *color*. Our products use **size variants** (and a per-size barcode field already exists). Colour can be added later as another variant attribute if needed — not required for v1.

---

## 9. Bottom line

- **Feasible: yes. Free: yes.** No cloud, no paid SDK, no subscription — all on the shop's own Wi-Fi.
- **Skip FastAPI** — do it in the existing Next.js app with **SSE + one POST route**. Less to build, less to run, same experience.
- **Only real task** beyond coding is the **free HTTPS (mkcert)** step so the phone camera is allowed.
- If the shop wants the most reliable counter with the least fuss, a **₹500 USB/Bluetooth scanner works right now with no code**.

---

## 10. Status — MVP implemented on this branch ✅

A working first version is now in the codebase (no FastAPI, all Next.js):

| File | Role |
|---|---|
| `lib/scanHub.ts` | In-memory pub/sub (`pair` → businessId + SSE clients) |
| `app/api/scan/stream/route.ts` | SSE stream the POS subscribes to (auth'd; binds pair→businessId) |
| `app/api/scan/route.ts` | Phone POSTs `{barcode, pair}` → product lookup → push to POS |
| `app/scanner/page.tsx` | Mobile scanner page (camera via `BarcodeDetector` + manual entry) |
| `components/pos/PosScreen.tsx` | "Phone scan" panel: shows pair code + URL, opens SSE, adds scans to the cart |
| `middleware.ts` | Allows `/scanner` + `/api/scan` without login (guarded by the pair code) |

**How to use:** open the POS billing screen → click **Phone scan** → it shows a pair code and a URL. On a phone on the same Wi-Fi, open that URL → tap **Start camera** → scan. Items drop into the open bill instantly. Stock still updates only when the bill is generated.

**Before it can find products:** set a **barcode on each product / size** (Products → Edit). A size's own barcode scans straight to that size.

**For the live camera** you still need the one-time **HTTPS (mkcert)** step from §4 — until then, the scanner page's **type-a-barcode** box works over plain http.

Smoke-tested: routes build and respond (`/scanner` 200; unpaired scan → 409; missing barcode → 400). End-to-end camera flow needs a phone on the LAN + the HTTPS step.
