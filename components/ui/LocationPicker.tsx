"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import { MapPin, Search, LocateFixed, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export type PickedLocation = { address: string; lat: number; lng: number; mapsUrl: string };

/** A pin as an inline SVG (avoids Leaflet's broken default-marker image paths under bundlers). */
const PIN_SVG = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 24 32"><path fill="#4f46e5" stroke="#fff" stroke-width="1.5" d="M12 1C6.5 1 2 5.3 2 10.6 2 18 12 31 12 31s10-13 10-20.4C22 5.3 17.5 1 12 1z"/><circle cx="12" cy="10.6" r="3.6" fill="#fff"/></svg>`
);

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=en`
    );
    const j = await r.json();
    return j?.display_name ?? "";
  } catch {
    return "";
  }
}

export function LocationPicker({
  open,
  initial,
  onClose,
  onPick,
}: {
  open: boolean;
  initial?: { lat: number; lng: number } | null;
  onClose: () => void;
  onPick: (loc: PickedLocation) => void;
}) {
  const toast = useToast();
  const mapEl = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  const [pos, setPos] = useState<{ lat: number; lng: number }>(
    initial ?? { lat: 20.5937, lng: 78.9629 } // India
  );
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Build the map once the modal is open.
  useEffect(() => {
    if (!open || !mapEl.current) return;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !mapEl.current || mapRef.current) return;

      const start = initial ?? { lat: 20.5937, lng: 78.9629 };
      const map = L.map(mapEl.current).setView([start.lat, start.lng], initial ? 15 : 5);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap",
      }).addTo(map);

      const icon = L.icon({
        iconUrl: `data:image/svg+xml,${PIN_SVG}`,
        iconSize: [32, 42],
        iconAnchor: [16, 42],
      });
      const marker = L.marker([start.lat, start.lng], { draggable: true, icon }).addTo(map);

      marker.on("dragend", () => {
        const { lat, lng } = marker.getLatLng();
        setPos({ lat, lng });
      });
      map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
        marker.setLatLng(e.latlng);
        setPos({ lat: e.latlng.lat, lng: e.latlng.lng });
      });

      mapRef.current = map;
      markerRef.current = marker;
      // Leaflet needs a size recalc once the modal has painted.
      setTimeout(() => map.invalidateSize(), 200);
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, [open, initial]);

  function moveTo(lat: number, lng: number, zoom = 16) {
    setPos({ lat, lng });
    if (mapRef.current && markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
      mapRef.current.setView([lat, lng], zoom);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      toast.error("Location is not available on this device");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => moveTo(p.coords.latitude, p.coords.longitude),
      () => toast.error("Could not get your location — allow location access"),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=in&limit=1&accept-language=en&q=${encodeURIComponent(
          query
        )}`
      );
      const j = await r.json();
      if (j?.[0]) moveTo(parseFloat(j[0].lat), parseFloat(j[0].lon));
      else toast.info("No match — try a different search");
    } catch {
      toast.error("Search failed — check your internet");
    } finally {
      setSearching(false);
    }
  }

  async function confirm() {
    setConfirming(true);
    const address = await reverseGeocode(pos.lat, pos.lng);
    setConfirming(false);
    onPick({
      address,
      lat: pos.lat,
      lng: pos.lng,
      mapsUrl: `https://www.google.com/maps?q=${pos.lat},${pos.lng}`,
    });
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4">
      <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
          <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <MapPin className="h-4 w-4 text-brand-600" /> Pick your shop location
          </h3>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex items-center gap-2 px-5 pt-4">
          <form onSubmit={search} className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search area, landmark or pincode"
              className="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-brand-500" />
            )}
          </form>
          <Button type="button" variant="tonal" onClick={useMyLocation} className="shrink-0">
            <LocateFixed className="h-4 w-4" /> My location
          </Button>
        </div>

        <div className="p-5">
          <div ref={mapEl} className="h-72 w-full overflow-hidden rounded-xl border border-gray-200" />
          <p className="mt-2 text-xs text-gray-400">
            Tap the map or drag the pin to set the exact spot.
          </p>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-100 px-5 py-3">
          <Button type="button" variant="outlined" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={confirm} loading={confirming}>
            {confirming ? "Fetching address…" : "Use this location"}
          </Button>
        </div>
      </div>
    </div>
  );
}
