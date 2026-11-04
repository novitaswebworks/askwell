"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type Kind = "ok" | "error";
interface Toast {
  id: number;
  text: string;
  kind: Kind;
}

const ToastContext = createContext<(text: string, kind?: Kind) => void>(() => {});
const SHOW_MS = 5000;

// A short confirmation that fades by itself. One live region announces it to screen readers.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toast = useCallback((text: string, kind: Kind = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((all) => [...all.slice(-2), { id, text, kind }]);
    setTimeout(() => setToasts((all) => all.filter((t) => t.id !== id)), SHOW_MS);
  }, []);
  const value = useMemo(() => toast, [toast]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div role="status" aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <p
            key={t.id}
            className={`glass pointer-events-auto rounded-xl px-4 py-3 text-sm shadow-lg ${t.kind === "error" ? "text-red-700" : ""}`}
          >
            {t.text}
          </p>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
