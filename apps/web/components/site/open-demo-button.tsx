"use client";

// Opens the real chat widget that the landing page already loads (window.Askwell, see the widget loader).
export function OpenDemoButton() {
  return (
    <button
      type="button"
      onClick={() => (window as unknown as { Askwell?: { open: () => void } }).Askwell?.open()}
      className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand px-7 text-base font-medium text-brand-foreground transition-opacity hover:opacity-90"
    >
      Open the demo chat
    </button>
  );
}
