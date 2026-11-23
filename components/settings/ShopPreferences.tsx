"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Receipt, SlidersHorizontal, ShieldCheck, Save } from "lucide-react";
import { updateBusiness, type BusinessDTO } from "@/actions/settings";
import { SettingsCard } from "./SettingsCard";
import { TextField } from "@/components/ui/TextField";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

export function ShopPreferences({ business }: { business: BusinessDTO }) {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  const [f, setF] = useState({
    pricesIncludeTax: business.pricesIncludeTax,
    allowNegativeStock: business.allowNegativeStock,
    lowStockAlertEnabled: business.lowStockAlertEnabled,
    weeklyOff: business.weeklyOff,
    currency: business.currency,
    fyStartMonth: business.fyStartMonth,
    returnWindowDays: business.returnWindowDays,
    discountApprovalLimit: business.discountApprovalLimit,
    invoicePrefix: business.invoicePrefix,
    invoiceTerms: business.invoiceTerms,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const set = (k: keyof typeof f, v: any) => setF((s) => ({ ...s, [k]: v }));

  async function save() {
    setSaving(true);
    const res = await updateBusiness(f);
    setSaving(false);
    if (!res.ok) return toast.error(res.error);
    toast.success("Preferences saved");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
      {/* TAX & INVOICE */}
      <SettingsCard
        title="Tax & invoice"
        description="How bills are numbered, taxed and worded."
        icon={<Receipt className="h-5 w-5" />}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Invoice prefix" value={f.invoicePrefix}
            onChange={(e) => set("invoicePrefix", e.target.value)} hint="e.g. CS/26-27/" />
          <Select label="Currency" value={f.currency} onChange={(e) => set("currency", e.target.value)}>
            <option value="INR">₹ INR — Indian Rupee</option>
          </Select>
          <Select label="Financial year starts" value={f.fyStartMonth}
            onChange={(e) => set("fyStartMonth", Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </Select>
          <TextField label="Return window (days)" inputMode="numeric" value={String(f.returnWindowDays)}
            onChange={(e) => set("returnWindowDays", Number(e.target.value.replace(/\D/g, "")) || 0)}
            hint="How many days a customer can return" />
          <div className="sm:col-span-2">
            <TextField label="Invoice footer / terms" value={f.invoiceTerms}
              onChange={(e) => set("invoiceTerms", e.target.value)} hint="Printed at the bottom of every bill" />
          </div>
        </div>
        <div className="mt-4">
          <Switch
            label="Prices include tax"
            hint="ON: entered price already includes GST (typical retail). OFF: GST added on top."
            checked={f.pricesIncludeTax}
            onChange={(v) => set("pricesIncludeTax", v)}
          />
        </div>
      </SettingsCard>

      <div className="flex flex-col gap-6">
      {/* OPERATIONS */}
      <SettingsCard
        title="Operations"
        description="Stock, discounts and working-day rules."
        icon={<SlidersHorizontal className="h-5 w-5" />}
      >
        <div className="flex flex-col gap-3">
          <Switch label="Low-stock alerts"
            hint="Warn when a size/variant falls to its reorder level."
            checked={f.lowStockAlertEnabled} onChange={(v) => set("lowStockAlertEnabled", v)} />
          <Switch label="Allow negative stock"
            hint="ON: bill items even when stock shows 0. OFF: block over-selling."
            checked={f.allowNegativeStock} onChange={(v) => set("allowNegativeStock", v)} />

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Discount approval above (%)" inputMode="numeric"
              value={String(f.discountApprovalLimit)}
              onChange={(e) => set("discountApprovalLimit", Number(e.target.value.replace(/\D/g, "")) || 0)}
              hint="Discounts above this need manager approval (0 = off)" />
            <Select label="Weekly off" value={f.weeklyOff}
              onChange={(e) => set("weeklyOff", Number(e.target.value))}>
              <option value={-1}>No weekly off</option>
              {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </Select>
          </div>
        </div>
      </SettingsCard>

      {/* SECURITY (coming soon) */}
      <SettingsCard
        title="Security & backup"
        description="Session, 2FA and backups."
        icon={<ShieldCheck className="h-5 w-5" />}
      >
        <div className="flex flex-col gap-3 opacity-70">
          <Switch label="Two-factor authentication (OTP)" hint="Coming soon" checked={false} onChange={() => {}} disabled />
          <Switch label="Auto logout on inactivity" hint="Coming soon" checked={false} onChange={() => {}} disabled />
          <Switch label="Daily backup" hint="Coming soon" checked={false} onChange={() => {}} disabled />
        </div>
      </SettingsCard>
      </div>
      </div>

      <div className="sticky bottom-4 flex justify-end">
        <Button onClick={save} loading={saving} className="shadow-soft">
          <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save preferences"}
        </Button>
      </div>
    </div>
  );
}
