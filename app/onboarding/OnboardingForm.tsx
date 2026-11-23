"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Store, Phone, MapPin, CheckCircle2 } from "lucide-react";
import { createBusiness } from "@/actions/auth";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { LocationPicker, type PickedLocation } from "@/components/ui/LocationPicker";
import { isValidGstin } from "@/lib/validate";

/** Modern shop-setup form for a logged-in user who has no shop yet. */
export function OnboardingForm() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  const [shopName, setShopName] = useState("");
  const [gstType, setGstType] = useState("UNREGISTERED");
  const [gstin, setGstin] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [geo, setGeo] = useState<{ lat: number; lng: number; mapsUrl: string } | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [error, setError] = useState("");
  const [gstinError, setGstinError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setGstinError("");
    if (shopName.trim().length < 2) {
      setError("Enter your shop name");
      return;
    }
    if (gstType !== "UNREGISTERED" && !isValidGstin(gstin)) {
      setGstinError("Enter a valid 15-character GSTIN");
      return;
    }
    setLoading(true);
    const res = await createBusiness({
      name: shopName,
      gstType,
      gstin: gstin || "",
      stateCode: "",
      phone: phone || "",
      address: address || "",
      pricesIncludeTax: true,
      mapsUrl: geo?.mapsUrl || "",
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
    });
    setLoading(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Your shop is ready 🎉");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <TextField
        label="Shop name (printed on bills)"
        startIcon={<Store className="h-4 w-4" />}
        value={shopName}
        onChange={(e) => setShopName(e.target.value)}
        error={error}
        autoFocus
      />

      <div>
        <label className="mb-1.5 block pl-1 text-xs font-medium text-gray-500">
          GST registration
        </label>
        <select
          value={gstType}
          onChange={(e) => setGstType(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-sm text-gray-800 outline-none transition hover:border-gray-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
        >
          <option value="UNREGISTERED">Unregistered (no GST)</option>
          <option value="COMPOSITION">Composition (Bill of Supply)</option>
          <option value="REGULAR">Regular (Tax Invoice with GST)</option>
        </select>
      </div>

      {gstType !== "UNREGISTERED" && (
        <TextField
          label="GSTIN (15 characters)"
          maxLength={15}
          value={gstin}
          onChange={(e) => setGstin(e.target.value.toUpperCase())}
          error={gstinError}
        />
      )}

      <TextField
        label="Shop phone"
        inputMode="numeric"
        startIcon={<Phone className="h-4 w-4" />}
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />

      <div>
        <TextField
          label="Address"
          startIcon={<MapPin className="h-4 w-4" />}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <Button type="button" variant="text" onClick={() => setMapOpen(true)} className="px-2">
            <MapPin className="h-4 w-4" /> Pick on map
          </Button>
          {geo && (
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" /> Location set
            </span>
          )}
        </div>
      </div>

      <Button type="submit" loading={loading} fullWidth className="mt-1">
        {loading ? "Creating…" : "Create shop & continue"}
      </Button>

      <LocationPicker
        open={mapOpen}
        initial={geo}
        onClose={() => setMapOpen(false)}
        onPick={(loc: PickedLocation) => {
          if (loc.address) setAddress(loc.address);
          setGeo({ lat: loc.lat, lng: loc.lng, mapsUrl: loc.mapsUrl });
          toast.success("Location added");
        }}
      />
    </form>
  );
}
