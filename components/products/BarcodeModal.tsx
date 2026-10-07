"use client";

import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { Download, Printer, X } from "lucide-react";
import { generateBarcodes, type BarcodeLabel } from "@/actions/products";
import { formatINR } from "@/lib/money";

/** Render one EAN-13 barcode into a canvas and return it. */
function drawBarcode(canvas: HTMLCanvasElement, value: string) {
  try {
    JsBarcode(canvas, value, {
      format: "EAN13",
      width: 2,
      height: 60,
      displayValue: true,
      fontSize: 14,
      margin: 8,
      background: "#ffffff",
    });
  } catch {
    // Fallback to CODE128 for any non-EAN value (e.g. manually typed codes).
    JsBarcode(canvas, value, { format: "CODE128", width: 2, height: 60, displayValue: true, fontSize: 14, margin: 8, background: "#ffffff" });
  }
}

function LabelCard({ shopName, item }: { shopName: string; item: BarcodeLabel }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => { if (ref.current) drawBarcode(ref.current, item.barcode); }, [item.barcode]);

  function download() {
    const c = ref.current;
    if (!c) return;
    const a = document.createElement("a");
    a.download = `barcode-${item.name}${item.label ? "-" + item.label : ""}-${item.barcode}.png`.replace(/\s+/g, "_");
    a.href = c.toDataURL("image/png");
    a.click();
  }

  return (
    <div className="barcode-card flex flex-col items-center gap-1 rounded-xl border border-gray-200 p-3 text-center">
      <p className="text-sm font-semibold text-gray-800">
        {shopName} · {item.name}{item.label ? ` (${item.label})` : ""}
      </p>
      {item.priceRupees > 0 && <p className="text-xs text-gray-500">{formatINR(Math.round(item.priceRupees * 100))}</p>}
      <canvas ref={ref} />
      <button onClick={download} className="no-print mt-1 flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium hover:bg-gray-100">
        <Download size={14} /> Download PNG
      </button>
    </div>
  );
}

export function BarcodeModal({ productId, shopName, onClose }: { productId: string; shopName: string; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [labels, setLabels] = useState<BarcodeLabel[]>([]);

  useEffect(() => {
    (async () => {
      const res = await generateBarcodes(productId);
      setLoading(false);
      if (!res.ok) return setError(res.error);
      setName(res.productName);
      setLabels(res.labels);
    })();
  }, [productId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()} id="barcode-print-area">
        <div className="no-print mb-1 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Barcodes{name ? ` — ${name}` : ""}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>
        <p className="no-print mb-4 text-sm text-gray-500">
          A barcode is auto-created for each size and saved to the product, so the phone/USB scanner finds it. Print these and stick on the items, or download each as an image.
        </p>

        {loading && <p className="py-10 text-center text-gray-400">Generating barcodes…</p>}
        {error && <p className="py-6 text-center text-red-600">{error}</p>}

        {!loading && !error && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {labels.map((item) => <LabelCard key={item.label + item.barcode} shopName={shopName} item={item} />)}
            </div>
            <div className="no-print mt-5 flex justify-end gap-2">
              <button onClick={onClose} className="rounded-xl border px-4 py-2 text-sm">Close</button>
              <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white">
                <Printer size={15} /> Print all
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
