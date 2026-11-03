"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Removes the whole conversation for good, after the owner confirms.
export function DeleteConversationButton({ conversationId, projectId }: { conversationId: string; projectId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!window.confirm("Delete this conversation? Its messages are removed for good. Leads captured in it are kept.")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/conversations/${conversationId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error?.message ?? "Something went wrong. Try again.");
        setBusy(false);
        return;
      }
      router.push(`/dashboard/conversations?project=${projectId}`);
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="inline-flex h-9 items-center rounded-full border border-red-700/30 px-4 text-xs font-medium text-red-700 transition-colors hover:bg-red-700/10 disabled:opacity-50"
      >
        {busy ? "Deleting..." : "Delete conversation"}
      </button>
      {error && (
        <p role="alert" className="text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
