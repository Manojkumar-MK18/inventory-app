"use client";

import { useEffect, useRef, useState } from "react";

type Status = { kind: "idle" | "ok" | "notfound" | "error"; text: string };

export default function ScannerPage() {
  const [pair, setPair] = useState("");
  const [scanning, setScanning] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle", text: "" });
  const [camError, setCamError] = useState("");
  const [manual, setManual] = useState("");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastSent = useRef<{ code: string; at: number }>({ code: "", at: 0 });

  // Read the pairing code from the URL (?pair=XY12AB) on load.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("pair");
    if (p) setPair(p.toUpperCase());
  }, []);

  async function sendScan(code: string) {
    const barcode = code.trim();
    if (!barcode || !pair.trim()) {
      if (!pair.trim()) setStatus({ kind: "error", text: "Enter the pair code shown on the billing screen." });
      return;
    }
    // Ignore the same barcode fired repeatedly within 1.8s.
    const now = Date.now();
    if (lastSent.current.code === barcode && now - lastSent.current.at < 1800) return;
    lastSent.current = { code: barcode, at: now };

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode, pair: pair.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (data.ok) {
        if (navigator.vibrate) navigator.vibrate(80);
        setStatus({ kind: "ok", text: `Added: ${data.name}${data.variantLabel ? ` (${data.variantLabel})` : ""}` });
      } else {
        if (navigator.vibrate) navigator.vibrate([40, 40, 40]);
        setStatus({ kind: data.error?.includes("Not connected") ? "error" : "notfound", text: data.error || "Not found" });
      }
    } catch {
      setStatus({ kind: "error", text: "Network error — are you on the shop Wi-Fi?" });
    }
  }

  async function startCamera() {
    setCamError("");
    const BD = (window as any).BarcodeDetector;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);

      if (!BD) {
        setCamError("Live scanning needs Chrome on Android. You can still type the barcode below.");
        return;
      }
      const detector = new BD({ formats: ["ean_13", "ean_8", "code_128", "code_39", "upc_a", "upc_e", "qr_code"] });
      const tick = async () => {
        if (!streamRef.current || !videoRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes?.length) await sendScan(codes[0].rawValue);
        } catch { /* transient frame error */ }
        if (streamRef.current) setTimeout(tick, 350);
      };
      tick();
    } catch (e: any) {
      const insecure = window.location.protocol !== "https:" && window.location.hostname !== "localhost";
      setCamError(
        insecure
          ? "Camera is blocked because this page is not HTTPS. Open it over https:// (see the setup note), or type barcodes below."
          : "Could not open the camera. Allow camera permission, or type barcodes below."
      );
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }

  useEffect(() => () => stopCamera(), []);

  const toneBg =
    status.kind === "ok" ? "bg-emerald-600" : status.kind === "notfound" ? "bg-amber-500" : status.kind === "error" ? "bg-red-600" : "bg-gray-800";

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-4 bg-gray-950 p-4 text-white">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">2K Scanner</h1>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${pair ? "bg-emerald-600" : "bg-gray-700"}`}>
          {pair ? `Paired ${pair}` : "Not paired"}
        </span>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-gray-400">Pair code (shown on the billing screen)</span>
        <input value={pair} onChange={(e) => setPair(e.target.value.toUpperCase())} placeholder="e.g. XY12AB"
          className="rounded-xl border border-gray-700 bg-gray-900 px-3 py-3 text-lg tracking-widest" />
      </label>

      <div className="relative overflow-hidden rounded-2xl border border-gray-800 bg-black" style={{ aspectRatio: "3 / 4" }}>
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        {scanning && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-40 w-11/12 rounded-xl border-2 border-emerald-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>
        )}
        {!scanning && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-400">
            <p className="text-sm">Point the camera at a barcode</p>
          </div>
        )}
      </div>

      {!scanning ? (
        <button onClick={startCamera} className="rounded-xl bg-emerald-600 py-3.5 text-base font-semibold">Start camera</button>
      ) : (
        <button onClick={stopCamera} className="rounded-xl bg-gray-700 py-3.5 text-base font-semibold">Stop camera</button>
      )}

      {camError && <p className="rounded-lg bg-amber-500/15 px-3 py-2 text-sm text-amber-300">{camError}</p>}

      {status.text && (
        <div className={`rounded-xl px-4 py-3 text-center text-base font-semibold ${toneBg}`}>{status.text}</div>
      )}

      {/* Manual fallback — always works, even over plain http */}
      <form onSubmit={(e) => { e.preventDefault(); sendScan(manual); setManual(""); }} className="mt-auto flex gap-2">
        <input value={manual} onChange={(e) => setManual(e.target.value)} inputMode="numeric" placeholder="Type / paste barcode"
          className="flex-1 rounded-xl border border-gray-700 bg-gray-900 px-3 py-3 text-base" />
        <button className="rounded-xl bg-indigo-600 px-5 text-base font-semibold">Send</button>
      </form>

      <p className="pb-2 text-center text-xs text-gray-500">Scanned items appear on the billing screen automatically.</p>
    </div>
  );
}
