"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Store, Pencil, Phone, Mail, MapPin, Instagram, FileText, Hash, ExternalLink, Check, X,
} from "lucide-react";
import { updateBusiness, type BusinessDTO } from "@/actions/settings";
import { SettingsCard } from "./SettingsCard";
import { TextField } from "@/components/ui/TextField";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { LocationPicker, type PickedLocation } from "@/components/ui/LocationPicker";
import { isValidGstin } from "@/lib/validate";

const GST_LABEL: Record<string, string> = {
  UNREGISTERED: "Unregistered (no GST)",
  COMPOSITION: "Composition (Bill of Supply)",
  REGULAR: "Regular (Tax Invoice)",
};

function embedUrl(lat: number, lng: number) {
  const d = 0.004;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d}%2C${lat - d}%2C${
    lng + d
  }%2C${lat + d}&layer=mapnik&marker=${lat}%2C${lng}`;
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="mt-0.5 text-gray-400">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-400">{label}</p>
        <p className="truncate text-sm font-medium text-gray-800">{value || "—"}</p>
      </div>
    </div>
  );
}

export function ShopProfileCard({ business }: { business: BusinessDTO }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);

  const [f, setF] = useState({
    name: business.name,
    legalName: business.legalName,
    gstType: business.gstType,
    gstin: business.gstin,
    phone: business.phone,
    email: business.email,
    address: business.address,
    instagram: business.instagram,
    mapsUrl: business.mapsUrl,
    lat: business.lat,
    lng: business.lng,
  });
  const [err, setErr] = useState<Record<string, string>>({});
  const set = (k: keyof typeof f, v: string | number | null) => setF((s) => ({ ...s, [k]: v }));

  async function save() {
    const e: Record<string, string> = {};
    if (f.name.trim().length < 2) e.name = "Enter the shop name";
    if (f.gstType !== "UNREGISTERED" && !isValidGstin(f.gstin)) e.gstin = "Enter a valid 15-char GSTIN";
    setErr(e);
    if (Object.keys(e).length) return;

    setSaving(true);
    const res = await updateBusiness({
      name: f.name,
      legalName: f.legalName,
      gstType: f.gstType,
      gstin: f.gstin,
      phone: f.phone,
      email: f.email,
      address: f.address,
      instagram: f.instagram,
      mapsUrl: f.mapsUrl,
      lat: f.lat,
      lng: f.lng,
    });
    setSaving(false);
    if (!res.ok) return toast.error(res.error);
    toast.success("Shop details saved");
    setEditing(false);
    router.refresh();
  }

  const hasMap = f.lat != null && f.lng != null;

  return (
    <SettingsCard
      title="Shop profile"
      description="Printed on bills and shown across the app."
      icon={<Store className="h-5 w-5" />}
      action={
        !editing && (
          <Button variant="tonal" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
        )
      }
    >
      {!editing ? (
        // ---------- VIEW ----------
        <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
          <div>
            <div className="flex items-center gap-3 pb-2">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-bold text-white shadow-soft">
                {business.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-bold text-gray-900">{business.name}</p>
                {business.legalName && (
                  <p className="truncate text-xs text-gray-500">{business.legalName}</p>
                )}
              </div>
            </div>
            <Row icon={<FileText className="h-4 w-4" />} label="GST" value={GST_LABEL[business.gstType]} />
            {business.gstin && <Row icon={<Hash className="h-4 w-4" />} label="GSTIN" value={business.gstin} />}
            <Row icon={<Phone className="h-4 w-4" />} label="Phone" value={business.phone} />
            <Row icon={<Mail className="h-4 w-4" />} label="Email" value={business.email} />
            <Row icon={<MapPin className="h-4 w-4" />} label="Address" value={business.address} />
            {business.instagram && (
              <a href={business.instagram} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 py-2 text-sm font-medium text-brand-700 hover:underline">
                <Instagram className="h-4 w-4" /> Instagram <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          <div>
            {hasMap ? (
              <div className="overflow-hidden rounded-2xl border border-gray-200">
                <iframe
                  title="Shop location"
                  src={embedUrl(business.lat!, business.lng!)}
                  className="h-56 w-full"
                  loading="lazy"
                />
                <a
                  href={business.mapsUrl || `https://www.google.com/maps?q=${business.lat},${business.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-1.5 bg-gray-50 py-2 text-xs font-semibold text-brand-700 hover:bg-gray-100"
                >
                  <MapPin className="h-3.5 w-3.5" /> Open in Google Maps <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            ) : (
              <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-300 bg-gray-50 text-center text-sm text-gray-400">
                <MapPin className="h-6 w-6" />
                No location set
                <button onClick={() => setEditing(true)} className="font-semibold text-brand-700 hover:underline">
                  Add it
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        // ---------- EDIT ----------
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Shop name (printed on bills)" value={f.name}
              onChange={(e) => set("name", e.target.value)} error={err.name} />
            <TextField label="Legal / business name" value={f.legalName}
              onChange={(e) => set("legalName", e.target.value)} />

            <Select label="GST registration" value={f.gstType} onChange={(e) => set("gstType", e.target.value)}>
              <option value="UNREGISTERED">Unregistered (no GST)</option>
              <option value="COMPOSITION">Composition (Bill of Supply)</option>
              <option value="REGULAR">Regular (Tax Invoice)</option>
            </Select>
            {f.gstType !== "UNREGISTERED" && (
              <TextField label="GSTIN (15 characters)" maxLength={15} value={f.gstin}
                onChange={(e) => set("gstin", e.target.value.toUpperCase())} error={err.gstin} />
            )}

            <TextField label="Phone" inputMode="numeric" value={f.phone}
              onChange={(e) => set("phone", e.target.value)} />
            <TextField label="Email" type="email" value={f.email}
              onChange={(e) => set("email", e.target.value)} />
            <TextField label="Instagram link" value={f.instagram}
              onChange={(e) => set("instagram", e.target.value)} className="sm:col-span-1" />
            <TextField label="Google Maps link" value={f.mapsUrl}
              onChange={(e) => set("mapsUrl", e.target.value)} />
          </div>

          <TextField label="Address" value={f.address} startIcon={<MapPin className="h-4 w-4" />}
            onChange={(e) => set("address", e.target.value)} />

          <div className="flex items-center justify-between gap-2">
            <Button type="button" variant="text" onClick={() => setMapOpen(true)} className="px-2">
              <MapPin className="h-4 w-4" /> Pick on map
            </Button>
            {hasMap && (
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                <Check className="h-3.5 w-3.5" /> Location set
              </span>
            )}
          </div>

          <div className="mt-1 flex gap-3">
            <Button variant="outlined" onClick={() => { setEditing(false); setErr({}); }} disabled={saving}>
              <X className="h-4 w-4" /> Cancel
            </Button>
            <Button onClick={save} loading={saving}>
              <Check className="h-4 w-4" /> Save changes
            </Button>
          </div>

          <LocationPicker
            open={mapOpen}
            initial={f.lat != null && f.lng != null ? { lat: f.lat, lng: f.lng } : null}
            onClose={() => setMapOpen(false)}
            onPick={(loc: PickedLocation) => {
              if (loc.address) set("address", loc.address);
              setF((s) => ({ ...s, lat: loc.lat, lng: loc.lng, mapsUrl: loc.mapsUrl }));
              toast.success("Location updated");
            }}
          />
        </div>
      )}
    </SettingsCard>
  );
}
