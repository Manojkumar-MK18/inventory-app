"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Maximize, Minimize, ShoppingCart, Smartphone, X, Copy, Check } from "lucide-react";
import type { ProductDTO } from "@/actions/products";
import { createSale, type SavedSale } from "@/actions/sales";
import { computeBill, type GstType } from "@/lib/tax";
import { formatINR, toPaise, toRupees } from "@/lib/money";
import { Receipt } from "@/components/invoice/Receipt";
import { normalisePhone, billMessage, whatsappUrl } from "@/lib/whatsapp";

type DiscUnit = "₹" | "%";

/** Short, unambiguous pairing code for the phone scanner. */
function makePairCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
  const a = new Uint8Array(6);
  crypto.getRandomValues(a);
  return Array.from(a, (n) => chars[n % chars.length]).join("");
}

interface CartLine {
  product: ProductDTO;
  variantLabel?: string; // which size, for variant products
  qty: number;
  priceRupees: number; // editable sale price
  discountValue: number; // in the chosen unit
  discountUnit: DiscUnit;
}

/** A selectable search result — a simple product, or one size of a variant product. */
interface Entry {
  product: ProductDTO;
  variantLabel?: string;
  price: number; // paise
  stock: number;
}
const keyOf = (productId: string, variantLabel?: string) => `${productId}::${variantLabel ?? ""}`;

interface Props {
  products: ProductDTO[];
  businessName: string;
  gstin: string | null;
  gstType: GstType;
  pricesIncludeTax: boolean;
  shopAddress?: string;
  shopPhone?: string;
  shopInstagram?: string;
  shopMapsUrl?: string;
}

export function PosScreen({ products, businessName, gstin, gstType, pricesIncludeTax, shopAddress, shopPhone, shopInstagram, shopMapsUrl }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<SavedSale | null>(null);
  const [phone, setPhone] = useState("");
  const [phoneErr, setPhoneErr] = useState("");
  const [payMethod, setPayMethod] = useState<"CASH" | "UPI" | "CARD">("CASH");
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custArea, setCustArea] = useState("");
  const [sendWhats, setSendWhats] = useState(true);
  const [received, setReceived] = useState(""); // cash given by customer (₹)
  const [fullscreen, setFullscreen] = useState(false);
  const [now, setNow] = useState<Date | null>(null); // client-only clock (avoids hydration mismatch)
  const [idemKey, setIdemKey] = useState(() => crypto.randomUUID());
  const [billDiscVal, setBillDiscVal] = useState(""); // overall discount on the whole bill
  const [billDiscUnit, setBillDiscUnit] = useState<DiscUnit>("₹");
  const [billedBy, setBilledBy] = useState(""); // who is making the bill (kept across bills)
  const [askBiller, setAskBiller] = useState(false); // show "who is billing?" prompt
  const [billerInput, setBillerInput] = useState("");
  // ---- Wireless phone scanner ----
  const [pairCode] = useState(makePairCode);
  const [showScan, setShowScan] = useState(false);
  const [scanConnected, setScanConnected] = useState(false);
  const [scanToast, setScanToast] = useState("");
  const [scanUrl, setScanUrl] = useState("");
  const [lanIps, setLanIps] = useState<string[]>([]);
  const [lanPick, setLanPick] = useState(0);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Build the scanner URL the PHONE can reach: use the PC's LAN IP (not localhost).
  useEffect(() => {
    fetch("/api/lan-ip")
      .then((r) => r.json())
      .then((d) => setLanIps(Array.isArray(d.ips) ? d.ips : []))
      .catch(() => setLanIps([]));
  }, []);

  useEffect(() => {
    const loc = window.location;
    const host = loc.hostname; // what the cashier actually opened
    const onLocalhost = host === "localhost" || host === "127.0.0.1";
    // The phone's camera only works on https. Give it an HTTPS link so the
    // camera opens straight away — no setup knowledge needed by the user.
    const ip = lanIps[lanPick] ?? (onLocalhost ? "" : host);
    const httpsPort = process.env.NEXT_PUBLIC_HTTPS_PORT || "3443";
    let base: string;
    if (loc.protocol === "https:") {
      // POS is already on https — reuse its host/port (camera already allowed).
      base = ip ? `https://${ip}${loc.port ? `:${loc.port}` : ""}` : loc.origin;
    } else if (ip) {
      // POS on http — point the phone at the HTTPS front (port 3443 by default).
      base = `https://${ip}:${httpsPort}`;
    } else {
      base = loc.origin; // last resort (localhost with no LAN IP)
    }
    setScanUrl(`${base}/scanner?pair=${pairCode}`);
  }, [pairCode, lanIps, lanPick]);

  // Render a QR of the scanner URL so the phone can just scan to open.
  useEffect(() => {
    if (!scanUrl) return setQrDataUrl("");
    import("qrcode").then((QR) =>
      QR.toDataURL(scanUrl, { margin: 1, width: 176 }).then(setQrDataUrl).catch(() => setQrDataUrl(""))
    );
  }, [scanUrl]);

  async function copyScanUrl() {
    try {
      await navigator.clipboard.writeText(scanUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked; user can select manually */ }
  }

  // Auto-hide the little scan toast.
  useEffect(() => {
    if (!scanToast) return;
    const t = setTimeout(() => setScanToast(""), 3500);
    return () => clearTimeout(t);
  }, [scanToast]);

  // Add a scanned product to the cart (built from the loaded product list).
  const addByScanRef = useRef<(productId: string, variantLabel: string | null, name: string) => void>(() => {});
  addByScanRef.current = (productId, variantLabel, name) => {
    const p = products.find((pp) => pp.id === productId);
    if (!p) return setScanToast(`Scanned "${name}" isn't loaded — refresh this page`);
    if (p.variants.length > 0) {
      if (!variantLabel) return setScanToast(`${name}: scan the size's own barcode`);
      const v = p.variants.find((x) => x.label === variantLabel);
      if (!v) return setScanToast(`${name}: size ${variantLabel} not found`);
      addEntry({ product: p, variantLabel, price: v.price ?? p.salePrice, stock: v.stock });
    } else {
      addEntry({ product: p, price: p.salePrice, stock: p.currentStock });
    }
    setScanToast(`Scanned: ${name}${variantLabel ? ` (${variantLabel})` : ""}`);
  };

  // Listen for scans pushed from the paired phone.
  useEffect(() => {
    const es = new EventSource(`/api/scan/stream?pair=${pairCode}`);
    es.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "CONNECTION_STATUS") setScanConnected(true);
        else if (msg.type === "PRODUCT_FOUND") addByScanRef.current(msg.productId, msg.variantLabel, msg.name);
        else if (msg.type === "PRODUCT_NOT_FOUND") setScanToast(`Not found: ${msg.barcode}`);
      } catch { /* ignore malformed */ }
    };
    es.onerror = () => setScanConnected(false);
    return () => es.close();
  }, [pairCode]);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      setFullscreen(false);
    } else {
      document.documentElement.requestFullscreen().then(() => setFullscreen(true)).catch(() => {});
    }
  }
  const searchRef = useRef<HTMLInputElement>(null);

  // Search results, expanded into one entry per size for variant products.
  const matches = useMemo<Entry[]>(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    const entries: Entry[] = [];
    for (const p of products) {
      const nameHit = p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
      if (p.variants.length > 0) {
        for (const v of p.variants) {
          const vHit = nameHit || (v.barcode ?? "").toLowerCase() === q;
          if (vHit) entries.push({ product: p, variantLabel: v.label, price: v.price ?? p.salePrice, stock: v.stock });
        }
      } else if (nameHit || (p.barcode ?? "").toLowerCase() === q) {
        entries.push({ product: p, price: p.salePrice, stock: p.currentStock });
      }
      if (entries.length >= 10) break;
    }
    return entries;
  }, [search, products]);

  function addEntry(e: Entry) {
    const k = keyOf(e.product.id, e.variantLabel);
    setCart((c) => {
      const i = c.findIndex((l) => keyOf(l.product.id, l.variantLabel) === k);
      if (i >= 0) {
        const next = [...c];
        next[i] = { ...next[i], qty: next[i].qty + 1 };
        return next;
      }
      const discVal = e.product.discountUnit === "₹" ? toRupees(e.product.discount) : e.product.discount;
      return [...c, { product: e.product, variantLabel: e.variantLabel, qty: 1, priceRupees: toRupees(e.price), discountValue: discVal, discountUnit: e.product.discountUnit }];
    });
    setSearch("");
    searchRef.current?.focus();
  }

  function updateLine(k: string, patch: Partial<CartLine>) {
    setCart((c) => c.map((l) => (keyOf(l.product.id, l.variantLabel) === k ? { ...l, ...patch } : l)));
  }
  function removeLine(k: string) {
    setCart((c) => c.filter((l) => keyOf(l.product.id, l.variantLabel) !== k));
  }

  // Per-unit discount in paise from the chosen unit (₹ flat or % of price).
  function discountPaise(l: CartLine): number {
    const pricePaise = toPaise(l.priceRupees || 0);
    if (l.discountUnit === "%") return Math.round((pricePaise * (l.discountValue || 0)) / 100);
    return toPaise(l.discountValue || 0);
  }

  // Available stock for a cart line (variant stock, or the product total).
  function lineStock(l: CartLine): number {
    if (l.variantLabel) {
      const v = l.product.variants.find((x) => x.label === l.variantLabel);
      return v?.stock ?? 0;
    }
    return l.product.currentStock;
  }
  // Low-stock alert level for a cart line (per size for variants).
  function lineMinStock(l: CartLine): number {
    if (l.variantLabel) {
      const v = l.product.variants.find((x) => x.label === l.variantLabel);
      return v?.minStock ?? 0;
    }
    return l.product.minStock;
  }
  const hasStockError = cart.some((l) => l.qty > lineStock(l));

  // Live preview — same computeBill the server uses. Each line keeps ONLY its own
  // per-item discount here, so product amounts never change from the bill discount.
  const bill = useMemo(
    () =>
      computeBill(
        cart.map((l) => ({
          price: toPaise(l.priceRupees || 0),
          qty: l.qty,
          discount: discountPaise(l),
          taxRate: l.product.taxRate,
        })),
        { gstType, pricesIncludeTax, interState: false }
      ),
    [cart, gstType, pricesIncludeTax]
  );

  // Whole-bill discount — a single amount taken off the FINAL total only.
  const billDiscountPaise = useMemo(() => {
    const val = Number(billDiscVal) || 0;
    const d = billDiscUnit === "%" ? Math.round((bill.grandTotal * val) / 100) : toPaise(val);
    return Math.max(0, Math.min(d, bill.grandTotal));
  }, [billDiscVal, billDiscUnit, bill.grandTotal]);
  const finalTotal = bill.grandTotal - billDiscountPaise;

  // Partial cash payment → the shortfall becomes a due, which needs a customer.
  const cashNow = payMethod === "CASH" ? toPaise(Number(received) || 0) : 0;
  const partialDue = payMethod === "CASH" && cashNow > 0 && cashNow < finalTotal ? finalTotal - cashNow : 0;

  // Step 1 — clicking "Generate bill". Block on empty cart / stock issues, then ask
  // who is billing (only the first time; the name is remembered for later bills).
  function onGenerateClick() {
    if (cart.length === 0) return;
    if (hasStockError) {
      setError("Some items don't have enough stock. Fix the quantity before billing.");
      return;
    }
    if (partialDue > 0 && !custPhone.trim()) {
      setError(`${formatINR(partialDue)} is still to collect. Enter the customer's phone so it is saved in their dues.`);
      return;
    }
    setError("");
    if (!billedBy.trim()) {
      setBillerInput("");
      setAskBiller(true);
      return;
    }
    doGenerate(billedBy);
  }

  async function doGenerate(biller: string) {
    if (cart.length === 0 || hasStockError) return;
    setSaving(true);
    setError("");
    const res = await createSale({
      items: cart.map((l) => ({
        productId: l.product.id,
        qty: l.qty,
        discount: discountPaise(l),
        priceOverride: toPaise(l.priceRupees || 0),
        variantLabel: l.variantLabel,
      })),
      idempotencyKey: idemKey,
      paymentMethod: payMethod,
      customer: { name: custName, phone: custPhone, area: custArea },
      billedBy: biller.trim(),
      billDiscount: billDiscountPaise,
      cashReceived: payMethod === "CASH" ? toPaise(Number(received) || 0) : 0,
    });
    setSaving(false);
    if (!res.ok) return setError(res.error);
    // Pre-fill the WhatsApp number from the customer's phone so it isn't retyped.
    if (sendWhats && custPhone.trim()) setPhone(custPhone.trim());
    setSaved(res.sale);
  }

  function confirmBiller() {
    const name = billerInput.trim();
    if (!name) return;
    setBilledBy(name); // remember for the rest of the session
    setAskBiller(false);
    doGenerate(name);
  }

  function sendWhatsapp() {
    const num = normalisePhone(phone);
    if (!num) return setPhoneErr("Enter a valid 10-digit mobile number");
    setPhoneErr("");
    const msg = billMessage(saved!, {
      name: businessName,
      address: shopAddress,
      phone: shopPhone,
      instagram: shopInstagram,
      mapsUrl: shopMapsUrl,
    });
    window.open(whatsappUrl(num, msg), "_blank");
  }

  function newBill() {
    setSaved(null);
    setCart([]);
    setPhone("");
    setPhoneErr("");
    setPayMethod("CASH");
    setCustName("");
    setCustPhone("");
    setCustArea("");
    setSendWhats(true);
    setReceived("");
    setBillDiscVal("");
    setBillDiscUnit("₹");
    // keep `billedBy` — same person usually bills the next customer too
    setIdemKey(crypto.randomUUID());
    setError("");
    router.refresh();
    searchRef.current?.focus();
  }

  // ---- Receipt view ----
  if (saved) {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="no-print w-full max-w-sm rounded-xl border border-gray-200 p-4">
          <p className="mb-2 text-sm font-medium">Send bill on WhatsApp</p>
          <div className="flex gap-2">
            <span className="flex items-center rounded-lg border bg-gray-50 px-2 text-sm text-gray-500">+91</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") sendWhatsapp(); }}
              inputMode="numeric" placeholder="Customer mobile number"
              className="flex-1 rounded-lg border px-3 py-2" />
            <button onClick={sendWhatsapp} className="rounded-lg bg-green-600 px-4 py-2 text-white">Send</button>
          </div>
          {phoneErr && <p className="mt-1 text-sm text-red-600">{phoneErr}</p>}
        </div>
        <div className="no-print flex gap-3">
          <button onClick={() => window.print()} className="rounded-xl bg-gray-900 px-4 py-2 text-white">Print receipt</button>
          <button onClick={newBill} className="rounded-lg border px-4 py-2">New bill</button>
        </div>
        <div className="rounded-xl border shadow">
          <Receipt sale={saved} businessName={businessName} gstin={gstin} />
        </div>
      </div>
    );
  }

  // ---- Billing view ----
  const itemCount = cart.reduce((a, l) => a + l.qty, 0);
  return (
    <div className="flex flex-col gap-4">
      {/* Shop header — like a till / POS counter */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-900 text-white"><ShoppingCart size={20} /></div>
          <div>
            <h1 className="text-lg font-bold leading-tight tracking-tight">{businessName}</h1>
            <p className="text-xs text-gray-400">New Bill{gstin ? ` · GSTIN ${gstin}` : ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {now && (
            <div className="text-right text-sm leading-tight">
              <p className="font-medium text-gray-700">{now.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", year: "numeric" })}</p>
              <p className="text-gray-400">{now.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit" })}</p>
            </div>
          )}
          <button type="button" onClick={() => setShowScan((s) => !s)} title="Use your phone as a barcode scanner"
            className="relative flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">
            <Smartphone size={15} /> Phone scan
            <span className={`ml-0.5 h-2 w-2 rounded-full ${scanConnected ? "bg-emerald-500" : "bg-gray-300"}`} />
          </button>
          <button type="button" onClick={toggleFullscreen} title="Full screen"
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">
            {fullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
            {fullscreen ? "Exit" : "Full screen"}
          </button>
        </div>
      </div>

      {/* Phone-scanner panel */}
      {showScan && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-card">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Smartphone size={18} className="text-brand-600" />
              <h2 className="font-semibold">Use your phone as a scanner</h2>
            </div>
            <button onClick={() => setShowScan(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
          </div>
          <div className="mt-3 flex flex-col gap-4 sm:flex-row">
            {/* QR to scan with the phone */}
            <div className="flex flex-col items-center gap-2">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt="Scan to open the scanner" className="h-44 w-44 rounded-xl border border-gray-200 bg-white p-1.5" />
              ) : (
                <div className="flex h-44 w-44 items-center justify-center rounded-xl border border-gray-200 text-xs text-gray-400">QR…</div>
              )}
              <p className="text-xs font-medium text-gray-500">Scan this with the phone camera</p>
            </div>

            {/* Steps + URL + copy */}
            <div className="min-w-0 flex-1">
              <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm text-gray-600">
                <li>On the phone (same Wi-Fi), <b>scan this QR</b> with the camera — or open the link below.</li>
                <li>If the phone shows a safety screen, tap <b>Advanced → Proceed</b> (one time only).</li>
                <li>Tap <b>Start camera</b> and scan a product barcode — items appear in the bill here instantly.</li>
              </ol>

              <div className="mt-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Scanner link (open on the phone)</p>
                <div className="flex items-stretch gap-2">
                  <input readOnly value={scanUrl} onFocus={(e) => e.currentTarget.select()}
                    className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm" />
                  <button type="button" onClick={copyScanUrl}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white ${copied ? "bg-emerald-600" : "bg-gray-900 hover:bg-gray-800"}`}>
                    {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? "Copied" : "Copy"}
                  </button>
                </div>

                {lanIps.length === 0 && (
                  <p className="mt-1.5 text-xs text-amber-600">Couldn&apos;t detect this PC&apos;s Wi-Fi IP. If the phone can&apos;t open the link, make sure the app runs on the network (0.0.0.0) and both devices are on the same Wi-Fi.</p>
                )}
                {lanIps.length > 1 && (
                  <label className="mt-1.5 flex items-center gap-2 text-xs text-gray-500">
                    This PC has more than one network — pick the Wi-Fi one:
                    <select value={lanPick} onChange={(e) => setLanPick(Number(e.target.value))} className="rounded-md border border-gray-300 px-2 py-1 text-xs">
                      {lanIps.map((ip, i) => <option key={ip} value={i}>{ip}</option>)}
                    </select>
                  </label>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="rounded-lg bg-gray-100 px-3 py-2 text-sm">Pair code: <b className="font-mono tracking-widest">{pairCode}</b></span>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${scanConnected ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                  <span className={`h-2 w-2 rounded-full ${scanConnected ? "bg-emerald-500" : "bg-gray-400"}`} /> {scanConnected ? "Ready for scans" : "Connecting…"}
                </span>
              </div>
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-400">
            The camera opens by itself. If it says &ldquo;camera blocked&rdquo;, the HTTPS helper isn&rsquo;t running on this PC — start it with <span className="font-mono">npm run https</span> (one-time setup in docs/WIRELESS-SCANNER.md). You can also just type the barcode on the phone.
          </p>
        </div>
      )}

      {scanToast && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700">{scanToast}</div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
      <div>
        <div className="relative">
          <input
            ref={searchRef}
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && matches[0]) { e.preventDefault(); addEntry(matches[0]); } }}
            placeholder="Scan barcode or search product by name / SKU…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5"
          />
          {matches.length > 0 && (
            <div className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-lg border bg-white shadow">
              {matches.map((e) => (
                <button key={keyOf(e.product.id, e.variantLabel)} onClick={() => addEntry(e)}
                  className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-gray-100">
                  <span>
                    {e.product.name}
                    {e.variantLabel && <span className="ml-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium">{e.variantLabel}</span>}
                    <span className="text-gray-400"> ({e.product.sku})</span>
                  </span>
                  <span className={e.stock <= 0 ? "text-red-500" : ""}>{formatINR(e.price)} · stock {e.stock}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-3 py-2.5">Item</th>
                <th className="px-3 py-2.5 w-20">Price ₹</th>
                <th className="px-3 py-2.5 w-20">Qty</th>
                <th className="px-3 py-2.5 w-28">Discount</th>
                <th className="px-3 py-2.5 text-right">Amount</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cart.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-10 text-center text-gray-400">No items yet. Search above to add products.</td></tr>
              )}
              {cart.map((l, idx) => {
                const line = bill.lines[idx];
                const lineTotal = line.taxable + line.cgst + line.sgst + line.igst;
                const k = keyOf(l.product.id, l.variantLabel);
                return (
                  <tr key={k}>
                    <td className="px-3 py-3 align-top">
                      <div className="flex h-9 items-center font-medium">
                        {l.product.name}
                        {l.variantLabel && <span className="ml-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-xs">{l.variantLabel}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <input type="number" min={0} step="0.01" value={l.priceRupees}
                        onChange={(e) => updateLine(k, { priceRupees: Math.max(0, Number(e.target.value)) })}
                        className="h-9 w-20 rounded border px-2" />
                    </td>
                    <td className="px-3 py-3 align-top">
                      {(() => {
                        const stock = lineStock(l);
                        const over = l.qty > stock;
                        const low = !over && stock <= lineMinStock(l); // low-stock warning (not blocking)
                        return (
                          <>
                            <input type="number" min={1} value={l.qty}
                              onChange={(e) => updateLine(k, { qty: Math.max(1, Number(e.target.value)) })}
                              className={`h-9 w-16 rounded border px-2 ${over ? "border-red-400 bg-red-50" : ""}`} />
                            <div className={`mt-1 text-[10px] font-medium ${over || low ? "text-red-500" : "text-gray-400"}`}>
                              {over
                                ? (stock <= 0 ? "Out of stock" : `Only ${stock} left`)
                                : low
                                  ? `Only ${stock} left`
                                  : `${stock} in stock`}
                            </div>
                          </>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="flex items-center gap-1">
                        <input type="number" min={0} step="0.01" value={l.discountValue}
                          onChange={(e) => updateLine(k, { discountValue: Math.max(0, Number(e.target.value)) })}
                          className={`h-9 w-16 rounded border px-2 ${discountPaise(l) > toPaise(l.priceRupees || 0) * l.qty ? "border-red-400" : ""}`} />
                        <select value={l.discountUnit}
                          onChange={(e) => updateLine(k, { discountUnit: e.target.value as DiscUnit })}
                          className="h-9 rounded border px-1.5">
                          <option value="₹">₹</option>
                          <option value="%">%</option>
                        </select>
                      </div>
                      {discountPaise(l) > toPaise(l.priceRupees || 0) * l.qty && (
                        <div className="mt-1 text-[10px] text-red-500">capped to price</div>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top text-right">
                      <div className="flex h-9 items-center justify-end font-semibold">{formatINR(lineTotal)}</div>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="flex h-9 items-center justify-center">
                        <button onClick={() => removeLine(k)} className="text-gray-400 hover:text-red-500" title="Remove">✕</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <aside className="h-fit rounded-xl border border-gray-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Bill summary</h2>
          <span className="text-xs text-gray-400">{cart.length} items · {itemCount} qty</span>
        </div>
        {(() => {
          const gross = bill.lines.reduce((a, l) => a + l.gross, 0);
          const itemDisc = bill.lines.reduce((a, l) => a + l.discount, 0);
          const hasGst = bill.cgst + bill.sgst + bill.igst > 0;
          return (
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-sm text-gray-600"><span>Items total</span><span>{formatINR(gross)}</span></div>
              {itemDisc > 0 && (
                <div className="flex justify-between text-sm font-medium text-green-700"><span>Item discount</span><span>− {formatINR(itemDisc)}</span></div>
              )}
              {/* Only show tax jargon when GST actually applies — keeps it simple for small shops. */}
              {hasGst && (
                <>
                  <div className="flex justify-between text-sm text-gray-600"><span>Taxable</span><span>{formatINR(bill.taxable)}</span></div>
                  {bill.igst > 0
                    ? <div className="flex justify-between text-sm text-gray-600"><span>IGST</span><span>{formatINR(bill.igst)}</span></div>
                    : <>
                        <div className="flex justify-between text-sm text-gray-600"><span>CGST</span><span>{formatINR(bill.cgst)}</span></div>
                        <div className="flex justify-between text-sm text-gray-600"><span>SGST</span><span>{formatINR(bill.sgst)}</span></div>
                      </>}
                </>
              )}
              {bill.roundOff !== 0 && <div className="flex justify-between text-sm text-gray-600"><span>Round off</span><span>{formatINR(bill.roundOff)}</span></div>}
              {billDiscountPaise > 0 && (
                <div className="flex justify-between text-sm font-medium text-green-700"><span>Bill discount</span><span>− {formatINR(billDiscountPaise)}</span></div>
              )}
            </div>
          );
        })()}

        {/* Whole-bill discount — a single amount off the final total */}
        {cart.length > 0 && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2">
            <span className="text-sm font-medium text-gray-600">Discount on total</span>
            <div className="flex items-center gap-1">
              <input value={billDiscVal} onChange={(e) => setBillDiscVal(e.target.value)} inputMode="decimal" placeholder="0"
                className="w-20 rounded-lg border px-2 py-1 text-right text-sm" />
              <select value={billDiscUnit} onChange={(e) => setBillDiscUnit(e.target.value as DiscUnit)}
                className="rounded-lg border px-2 py-1 text-sm">
                <option value="₹">₹</option>
                <option value="%">%</option>
              </select>
            </div>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between rounded-xl bg-gray-900 px-4 py-3 text-white">
          <span className="text-sm font-medium">Total payable</span>
          <span className="text-2xl font-bold">{formatINR(finalTotal)}</span>
        </div>
        <div className="mt-4 border-t pt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Payment</p>
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-gray-100 p-1">
            {(["CASH", "UPI", "CARD"] as const).map((m) => (
              <button key={m} type="button" onClick={() => setPayMethod(m)}
                className={`rounded-md py-1.5 text-xs font-medium ${payMethod === m ? "bg-white shadow" : "text-gray-500"}`}>
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Cash received → change to return */}
        {payMethod === "CASH" && cart.length > 0 && (() => {
          const recv = toPaise(Number(received) || 0);
          const change = recv - finalTotal;
          const roundUp = Math.ceil(finalTotal / 10000) * 10000; // next ₹100
          return (
            <div className="mt-3 rounded-lg bg-gray-50 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Cash received</span>
                <div className="flex gap-1">
                  <button type="button" onClick={() => setReceived(String(finalTotal / 100))} className="rounded border bg-white px-2 py-0.5 text-xs">Exact</button>
                  {roundUp !== finalTotal && <button type="button" onClick={() => setReceived(String(roundUp / 100))} className="rounded border bg-white px-2 py-0.5 text-xs">{formatINR(roundUp)}</button>}
                </div>
              </div>
              <div className="relative mt-1.5">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₹</span>
                <input value={received} onChange={(e) => setReceived(e.target.value)} inputMode="decimal" placeholder="0"
                  className="w-full rounded-lg border px-3 py-2 pl-7 text-right text-lg font-semibold" />
              </div>
              {received !== "" && (
                change >= 0 ? (
                  <div className="mt-2 flex items-center justify-between rounded-lg bg-green-50 px-3 py-2">
                    <span className="text-sm font-medium text-green-700">Return to customer</span>
                    <span className="text-xl font-bold text-green-700">{formatINR(change)}</span>
                  </div>
                ) : (
                  <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-amber-700">Remaining (to collect)</span>
                      <span className="text-xl font-bold text-amber-700">{formatINR(-change)}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-amber-700">
                      This {formatINR(-change)} will be saved in the customer&apos;s dues. Enter their phone number below.
                    </p>
                  </div>
                )
              )}
            </div>
          );
        })()}

        <div className="mt-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            Customer {partialDue > 0 ? <span className="text-red-500">(phone required for dues)</span> : "(optional)"}
          </p>
          <div className="flex flex-col gap-2">
            <input value={custName} onChange={(e) => setCustName(e.target.value)} placeholder="Name"
              className="rounded-lg border px-3 py-1.5 text-sm" />
            <div className="flex gap-2">
              <input value={custPhone} onChange={(e) => setCustPhone(e.target.value)} inputMode="numeric" placeholder="Phone"
                className="w-1/2 rounded-lg border px-3 py-1.5 text-sm" />
              <input value={custArea} onChange={(e) => setCustArea(e.target.value)} placeholder="Area"
                className="w-1/2 rounded-lg border px-3 py-1.5 text-sm" />
            </div>
            <p className="text-[11px] text-gray-400">Add the phone number to save this bill under the customer (for dues & history). Name alone just prints on this bill.</p>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={sendWhats} onChange={(e) => setSendWhats(e.target.checked)} />
              Send bill on WhatsApp to this number
            </label>
          </div>
        </div>

        {billedBy && (
          <p className="mt-3 text-xs text-gray-500">
            Billed by <span className="font-medium text-gray-700">{billedBy}</span>
            <button type="button" onClick={() => { setBillerInput(billedBy); setAskBiller(true); }} className="ml-2 text-indigo-600 underline">change</button>
          </p>
        )}
        {hasStockError && <p className="mt-3 text-sm text-red-600">Some items don&apos;t have enough stock — fix the quantity (red) before billing.</p>}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <button onClick={onGenerateClick} disabled={saving || cart.length === 0 || hasStockError}
          className="mt-4 w-full rounded-xl bg-gray-900 py-3 text-base font-medium text-white disabled:opacity-50">
          {saving ? "Saving…" : "Generate bill"}
        </button>
      </aside>
      </div>

      {/* Who is billing? — asked before the first bill, remembered after. */}
      {askBiller && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setAskBiller(false)}>
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">Who is billing?</h3>
            <p className="mt-1 text-sm text-gray-500">This name is printed on the bill.</p>
            <input value={billerInput} autoFocus
              onChange={(e) => setBillerInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") confirmBiller(); }}
              placeholder="e.g. Ramesh"
              className="mt-3 w-full rounded-lg border px-3 py-2" />
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setAskBiller(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
              <button type="button" onClick={confirmBiller} disabled={!billerInput.trim()}
                className="rounded-xl bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50">
                Confirm &amp; generate bill
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
