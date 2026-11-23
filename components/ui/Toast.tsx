"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { CheckCircle2, Info, AlertTriangle, XCircle, X } from "lucide-react";

/**
 * Material-style snackbar toasts. Mount <ToastProvider> once (root layout),
 * then call const toast = useToast(); toast.success("Saved").
 */
type Severity = "success" | "error" | "info" | "warning";
type Toast = { id: number; message: string; severity: Severity };

type ToastApi = {
  show: (message: string, severity?: Severity) => void;
  success: (m: string) => void;
  error: (m: string) => void;
  info: (m: string) => void;
  warning: (m: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

let seq = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const show = useCallback(
    (message: string, severity: Severity = "info") => {
      const id = ++seq;
      setToasts((t) => [...t, { id, message, severity }]);
      setTimeout(() => remove(id), 4000);
    },
    [remove]
  );

  const api: ToastApi = {
    show,
    success: (m) => show(m, "success"),
    error: (m) => show(m, "error"),
    info: (m) => show(m, "info"),
    warning: (m) => show(m, "warning"),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6">
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onClose={() => remove(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const STYLES: Record<Severity, { bar: string; icon: React.ReactNode }> = {
  success: { bar: "bg-emerald-600", icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" /> },
  error: { bar: "bg-red-600", icon: <XCircle className="h-5 w-5 text-red-600" /> },
  info: { bar: "bg-brand-600", icon: <Info className="h-5 w-5 text-brand-600" /> },
  warning: { bar: "bg-amber-500", icon: <AlertTriangle className="h-5 w-5 text-amber-500" /> },
};

function ToastCard({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(r);
  }, []);
  const s = STYLES[toast.severity];

  return (
    <div
      role="alert"
      className={`pointer-events-auto flex w-full max-w-sm items-stretch overflow-hidden rounded-xl bg-white shadow-soft ring-1 ring-black/5 transition-all duration-300 ${
        shown ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
      }`}
    >
      <div className={`w-1.5 shrink-0 ${s.bar}`} />
      <div className="flex flex-1 items-center gap-3 py-3 pl-3 pr-2">
        {s.icon}
        <p className="flex-1 text-sm font-medium text-gray-800">{toast.message}</p>
        <button
          onClick={onClose}
          className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
