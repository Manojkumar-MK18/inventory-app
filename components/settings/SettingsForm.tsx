"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateBusiness, type BusinessDTO } from "@/actions/settings";
import { InfoTip } from "@/components/InfoTip";

const inputCls = "rounded-lg border border-gray-300 px-3 py-2 text-sm w-full";

export function SettingsForm({ business }: { business: BusinessDTO }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMsg("");
    setSaving(true);
    const f = new FormData(e.currentTarget);
    const res = await updateBusiness({
      name: f.get("name"),
      gstType: f.get("gstType"),
      gstin: f.get("gstin") || "",
      stateCode: f.get("stateCode") || "",
      address: f.get("address") || "",
      phone: f.get("phone") || "",
      instagram: f.get("instagram") || "",
      mapsUrl: f.get("mapsUrl") || "",
      pricesIncludeTax: f.get("pricesIncludeTax") === "on",
      allowNegativeStock: f.get("allowNegativeStock") === "on",
      weeklyOff: f.get("weeklyOff"),
    });
    setSaving(false);
    if (!res.ok) return setError(res.error);
    setMsg("Settings saved.");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-2xl grid-cols-2 gap-4 rounded-xl border border-gray-200 bg-white p-6">
      <label className="col-span-2 flex flex-col gap-1 text-sm">
        <span className="flex items-center gap-1.5 font-medium text-gray-700">Shop name <InfoTip text="Printed at the top of every bill and shown across the app." /></span>
        <input name="name" required defaultValue={business.name} className={inputCls} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="flex items-center gap-1.5 font-medium text-gray-700">GST type <InfoTip text="Regular prints a Tax Invoice with GST. Composition prints a Bill of Supply. Unregistered charges no GST." /></span>
        <select name="gstType" defaultValue={business.gstType} className={inputCls}>
          <option value="UNREGISTERED">Unregistered (no GST)</option>
          <option value="COMPOSITION">Composition (Bill of Supply)</option>
          <option value="REGULAR">Regular (Tax Invoice)</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="flex items-center gap-1.5 font-medium text-gray-700">GSTIN <InfoTip text="Your 15-character GST number. The first 2 digits set your state automatically." /></span>
        <input name="gstin" maxLength={15} defaultValue={business.gstin} placeholder="15 characters" className={inputCls} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="flex items-center gap-1.5 font-medium text-gray-700">State code <InfoTip text="Your 2-digit state code (e.g. 27 for Maharashtra). Used to decide CGST+SGST vs IGST. Auto-filled from GSTIN." /></span>
        <input name="stateCode" maxLength={2} defaultValue={business.stateCode} placeholder="e.g. 27" className={inputCls} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="flex items-center gap-1.5 font-medium text-gray-700">Phone <InfoTip text="Shop contact number, printed on bills." /></span>
        <input name="phone" defaultValue={business.phone} className={inputCls} />
      </label>
      <label className="col-span-2 flex flex-col gap-1 text-sm">
        <span className="flex items-center gap-1.5 font-medium text-gray-700">Address <InfoTip text="Shop address, printed on bills and sent on WhatsApp." /></span>
        <textarea name="address" rows={2} defaultValue={business.address} className={inputCls} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="flex items-center gap-1.5 font-medium text-gray-700">Instagram link <InfoTip text="Your full Instagram profile URL, e.g. https://www.instagram.com/your_shop. Added to the WhatsApp bill so customers can follow you." /></span>
        <input name="instagram" defaultValue={business.instagram} placeholder="https://www.instagram.com/…" className={inputCls} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="flex items-center gap-1.5 font-medium text-gray-700">Google Maps link <InfoTip text="Your shop's Google Maps share link, so customers can find you. Added to the WhatsApp bill." /></span>
        <input name="mapsUrl" defaultValue={business.mapsUrl} placeholder="https://maps.app.goo.gl/…" className={inputCls} />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="pricesIncludeTax" defaultChecked={business.pricesIncludeTax} />
        Prices include tax
        <InfoTip text="ON: the price you enter already includes GST (common in retail). OFF: GST is added on top at billing." />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="allowNegativeStock" defaultChecked={business.allowNegativeStock} />
        Allow negative stock
        <InfoTip text="ON: lets you bill items even when stock shows 0. OFF: blocks selling more than you have." />
      </label>

      <label className="col-span-2 flex flex-col gap-1 text-sm">
        <span className="flex items-center gap-1.5 font-medium text-gray-700">Weekly off <InfoTip text="The day your shop is closed. On attendance, this day is shown as 'Off' instead of 'Leave'." /></span>
        <select name="weeklyOff" defaultValue={String(business.weeklyOff)} className={inputCls}>
          <option value="-1">No weekly off</option>
          <option value="0">Sunday</option>
          <option value="1">Monday</option>
          <option value="2">Tuesday</option>
          <option value="3">Wednesday</option>
          <option value="4">Thursday</option>
          <option value="5">Friday</option>
          <option value="6">Saturday</option>
        </select>
      </label>

      {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
      {msg && <p className="col-span-2 text-sm text-green-700">{msg}</p>}
      <div className="col-span-2">
        <button disabled={saving} className="rounded-xl bg-gray-900 px-5 py-2 text-sm text-white disabled:opacity-50">
          {saving ? "Saving…" : "Save settings"}
        </button>
      </div>
    </form>
  );
}
