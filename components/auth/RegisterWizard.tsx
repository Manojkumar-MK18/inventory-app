"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  User as UserIcon,
  Phone,
  Mail,
  Lock,
  Store,
  MapPin,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { registerOwnerAndShop } from "@/actions/auth";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { Stepper } from "@/components/ui/Stepper";
import { useToast } from "@/components/ui/Toast";
import { LocationPicker, type PickedLocation } from "@/components/ui/LocationPicker";
import { digitsOnly, isValidMobile, verifyOtp } from "@/lib/otp";
import { isValidEmail, isValidGstin } from "@/lib/validate";

const STEPS = ["Account", "Shop", "Done"];

export function RegisterWizard() {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  // Step 1 — owner account
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [terms, setTerms] = useState(false);

  // OTP (dummy)
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [mobileVerified, setMobileVerified] = useState(false);

  // Step 2 — shop
  const [shopName, setShopName] = useState("");
  const [gstType, setGstType] = useState("UNREGISTERED");
  const [gstin, setGstin] = useState("");
  const [shopPhone, setShopPhone] = useState("");
  const [address, setAddress] = useState("");
  const [geo, setGeo] = useState<{ lat: number; lng: number; mapsUrl: string } | null>(null);
  const [mapOpen, setMapOpen] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});

  function sendOtp() {
    if (!isValidMobile(mobile)) {
      setErrors((e) => ({ ...e, mobile: "Enter a valid 10-digit mobile" }));
      return;
    }
    setErrors((e) => ({ ...e, mobile: "" }));
    setOtpSent(true);
    toast.info(`Demo OTP = first 6 digits (${digitsOnly(mobile).slice(0, 6)})`);
  }

  function checkOtp() {
    if (verifyOtp(mobile, otp)) {
      setMobileVerified(true);
      setErrors((e) => ({ ...e, otp: "" }));
      toast.success("Mobile verified");
    } else {
      setErrors((e) => ({ ...e, otp: "Wrong OTP — use the first 6 digits of the mobile" }));
    }
  }

  function validateStep1() {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = "Enter your name";
    if (!isValidMobile(mobile)) e.mobile = "Enter a valid 10-digit mobile";
    else if (!mobileVerified) e.mobile = "Verify your mobile with the OTP";
    if (!isValidEmail(email)) e.email = "Enter a valid email";
    if (password.length < 8) e.password = "At least 8 characters";
    if (!terms) e.terms = "Please accept the terms";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    if (step === 0 && !validateStep1()) return;
    setStep((s) => s + 1);
  }

  async function finish() {
    const e: Record<string, string> = {};
    if (shopName.trim().length < 2) e.shopName = "Enter your shop name";
    if (gstType !== "UNREGISTERED" && !isValidGstin(gstin)) e.gstin = "Enter a valid 15-character GSTIN";
    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    setErrors({});
    setLoading(true);

    // Create the owner AND the shop in one server action (before sign-in), so no
    // server action runs on /register after login (middleware would redirect it).
    const res = await registerOwnerAndShop({
      owner: {
        name,
        email,
        password,
        mobile: digitsOnly(mobile),
        mobileVerified: true,
        termsAccepted: true,
      },
      shop: {
        name: shopName,
        gstType,
        gstin: gstin || "",
        stateCode: "",
        phone: shopPhone || "",
        address: address || "",
        pricesIncludeTax: true,
        mapsUrl: geo?.mapsUrl || "",
        lat: geo?.lat ?? null,
        lng: geo?.lng ?? null,
      },
    });
    if (!res.ok) {
      setLoading(false);
      toast.error(res.error);
      return;
    }

    // Everything is created; now sign in and go straight to the dashboard.
    const signRes = await signIn("credentials", {
      loginId: res.email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (signRes?.error) {
      toast.error("Shop created — please sign in.");
      router.push("/login?created=1");
      return;
    }

    setStep(2);
    toast.success("Your shop is ready 🎉");
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 1200);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Create your shop</h1>
        <p className="mt-1 text-sm text-gray-500">Takes less than a minute.</p>
      </div>

      <Stepper steps={STEPS} current={step} />

      {/* STEP 1 — OWNER ACCOUNT */}
      {step === 0 && (
        <div className="flex flex-col gap-4">
          <TextField
            label="Your full name"
            startIcon={<UserIcon className="h-4 w-4" />}
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
            autoFocus
          />

          <div className="flex items-start gap-2">
            <div className="flex-1">
              <TextField
                label="Mobile number"
                inputMode="numeric"
                maxLength={10}
                startIcon={<Phone className="h-4 w-4" />}
                value={mobile}
                onChange={(e) => {
                  setMobile(digitsOnly(e.target.value));
                  setMobileVerified(false);
                  setOtpSent(false);
                }}
                error={errors.mobile}
                disabled={mobileVerified}
                endAdornment={
                  mobileVerified ? (
                    <span className="flex items-center gap-1 pr-1 text-xs font-semibold text-emerald-600">
                      <CheckCircle2 className="h-4 w-4" /> Verified
                    </span>
                  ) : undefined
                }
              />
            </div>
            {!mobileVerified && (
              <Button
                type="button"
                variant="tonal"
                onClick={sendOtp}
                className="mt-0.5 shrink-0 py-3"
              >
                {otpSent ? "Resend" : "Send OTP"}
              </Button>
            )}
          </div>

          {otpSent && !mobileVerified && (
            <div className="flex items-start gap-2 rounded-xl bg-brand-50 p-3">
              <div className="flex-1">
                <TextField
                  label="Enter 6-digit OTP"
                  inputMode="numeric"
                  maxLength={6}
                  startIcon={<ShieldCheck className="h-4 w-4" />}
                  value={otp}
                  onChange={(e) => setOtp(digitsOnly(e.target.value))}
                  error={errors.otp}
                  hint="Demo: the first 6 digits of your mobile number"
                />
              </div>
              <Button type="button" onClick={checkOtp} className="mt-0.5 shrink-0 py-3">
                Verify
              </Button>
            </div>
          )}

          <TextField
            label="Email"
            type="email"
            startIcon={<Mail className="h-4 w-4" />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
          />

          <TextField
            label="Password"
            type={showPw ? "text" : "password"}
            startIcon={<Lock className="h-4 w-4" />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            hint="Minimum 8 characters"
            endAdornment={
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            }
          />

          <label className="flex items-start gap-2.5 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <span>
              I accept the <span className="font-medium text-brand-700">Terms</span> &{" "}
              <span className="font-medium text-brand-700">Privacy Policy</span>.
            </span>
          </label>
          {errors.terms && <p className="-mt-2 pl-1 text-xs text-red-500">{errors.terms}</p>}

          <Button type="button" onClick={next} fullWidth className="mt-1">
            Continue <ArrowRight className="h-4 w-4" />
          </Button>

          <Link href="/login" className="text-center text-sm text-gray-500 hover:underline">
            Already have an account? <span className="font-semibold text-gray-700">Sign in</span>
          </Link>
        </div>
      )}

      {/* STEP 2 — SHOP DETAILS */}
      {step === 1 && (
        <div className="flex flex-col gap-4">
          <TextField
            label="Shop name (printed on bills)"
            startIcon={<Store className="h-4 w-4" />}
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            error={errors.shopName}
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
              error={errors.gstin}
            />
          )}

          <TextField
            label="Shop phone"
            inputMode="numeric"
            startIcon={<Phone className="h-4 w-4" />}
            value={shopPhone}
            onChange={(e) => setShopPhone(e.target.value)}
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

          <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
            You can change any of this later in <span className="font-medium">Settings</span>.
          </p>

          <div className="mt-1 flex gap-3">
            <Button type="button" variant="outlined" onClick={() => setStep(0)}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button type="button" onClick={finish} loading={loading} fullWidth>
              {loading ? "Creating…" : "Create shop"}
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3 — DONE */}
      {step === 2 && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle2 className="h-9 w-9 text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Shop created!</h2>
          <p className="text-sm text-gray-500">Taking you to your dashboard…</p>
        </div>
      )}

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
    </div>
  );
}
