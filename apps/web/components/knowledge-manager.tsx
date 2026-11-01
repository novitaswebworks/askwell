"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { MAX_KNOWLEDGE_FILE_BYTES, type KnowledgeSource } from "@askwell/shared";
import { EmptyState } from "@/components/empty-state";

const inputStyles =
  "h-11 min-w-0 flex-1 rounded-full border border-border bg-glass-strong px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent";
const buttonStyles =
  "inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-medium transition-opacity disabled:opacity-50";

type FileType = "pdf" | "md" | "txt";

const FILE_TYPES: { type: FileType; extensions: string[]; mime: string }[] = [
  { type: "pdf", extensions: [".pdf"], mime: "application/pdf" },
  { type: "md", extensions: [".md", ".markdown"], mime: "text/markdown" },
  { type: "txt", extensions: [".txt"], mime: "text/plain" },
];

function detectFileType(name: string) {
  const lower = name.toLowerCase();
  return FILE_TYPES.find((t) => t.extensions.some((ext) => lower.endsWith(ext)));
}

async function errorMessage(res: Response) {
  const body = await res.json().catch(() => null);
  return body?.error?.message ?? "Something went wrong. Try again.";
}

// "uploading" is shown as processing (project.md section 6.4).
function statusLabel(status: KnowledgeSource["status"]) {
  return status === "uploading" || status === "processing" ? "Processing" : status === "ready" ? "Ready" : "Failed";
}

export function KnowledgeManager({
  projectId,
  sources,
  maxSources,
}: {
  projectId: string;
  sources: KnowledgeSource[];
  maxSources: number;
}) {
  const router = useRouter();
  const [textTitle, setTextTitle] = useState("");
  const [text, setText] = useState("");
  const [fileTitle, setFileTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const atLimit = sources.length >= maxSources;
  const base = `/api/projects/${projectId}/knowledge`;

  async function run(label: string, task: () => Promise<boolean>) {
    setBusy(label);
    setError(null);
    try {
      return await task();
    } catch {
      setError("Network error. Check your connection and try again.");
      return false;
    } finally {
      setBusy(null);
      router.refresh();
    }
  }

  async function addText(e: FormEvent) {
    e.preventDefault();
    const ok = await run("Adding text. This can take a minute.", async () => {
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: textTitle, text }),
      });
      if (!res.ok) {
        setError(await errorMessage(res));
        return false;
      }
      return true;
    });
    if (ok) {
      setTextTitle("");
      setText("");
    }
  }

  async function uploadFile(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    const kind = detectFileType(file.name);
    if (!kind) return setError("Choose a PDF, Markdown (.md) or text (.txt) file.");
    if (file.size === 0 || file.size > MAX_KNOWLEDGE_FILE_BYTES) {
      return setError("The file must be between 1 byte and 10 MB.");
    }

    const ok = await run("Uploading and processing. This can take a minute.", async () => {
      // 1. Reserve the source and get a one-time signed URL.
      const reserve = await fetch(`${base}/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: fileTitle.trim() || file.name,
          filename: file.name,
          size: file.size,
          type: kind.type,
        }),
      });
      if (!reserve.ok) {
        setError(await errorMessage(reserve));
        return false;
      }
      const { sourceId, uploadUrl } = (await reserve.json()) as { sourceId: string; uploadUrl: string };

      // 2. Upload straight to Storage (same request shape as supabase-js uploadToSignedUrl).
      const form = new FormData();
      form.append("cacheControl", "3600");
      form.append("", new Blob([file], { type: kind.mime }));
      const upload = await fetch(uploadUrl, { method: "PUT", body: form, headers: { "x-upsert": "false" } });
      if (!upload.ok) {
        setError("The upload failed. Delete the entry below and try again.");
        return false;
      }

      // 3. Ask the server to check and process the file.
      const finalize = await fetch(`${base}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId }),
      });
      if (!finalize.ok) {
        setError(await errorMessage(finalize));
        return false;
      }
      return true;
    });
    if (ok) {
      setFile(null);
      setFileTitle("");
      (e.target as HTMLFormElement).reset();
    }
  }

  async function remove(source: KnowledgeSource) {
    if (!window.confirm(`Delete "${source.title}"? The bot will stop answering from it.`)) return;
    await run("Deleting.", async () => {
      const res = await fetch(`/api/knowledge/${source.id}`, { method: "DELETE" });
      if (!res.ok) {
        setError(await errorMessage(res));
        return false;
      }
      return true;
    });
  }

  const disabled = atLimit || busy !== null;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        {sources.length} of {maxSources} sources used.
        {atLimit && maxSources === 3 && " Upgrade to Pro for up to 25."}
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={addText} className="glass flex flex-col gap-3 p-4">
          <h2 className="font-medium">Paste text</h2>
          <label htmlFor="text-title" className="sr-only">
            Title
          </label>
          <input
            id="text-title"
            value={textTitle}
            onChange={(e) => setTextTitle(e.target.value)}
            maxLength={200}
            placeholder="Title, for example Refund policy"
            disabled={disabled}
            className={inputStyles}
          />
          <label htmlFor="text-body" className="sr-only">
            Text
          </label>
          <textarea
            id="text-body"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={200_000}
            rows={6}
            placeholder="Paste the text the bot should answer from"
            disabled={disabled}
            className="min-h-32 rounded-2xl border border-border bg-glass-strong p-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          <button
            type="submit"
            disabled={disabled || textTitle.trim() === "" || text.trim() === ""}
            className={`${buttonStyles} self-start bg-accent text-accent-foreground hover:opacity-90`}
          >
            Add text
          </button>
        </form>

        <form onSubmit={uploadFile} className="glass flex flex-col gap-3 p-4">
          <h2 className="font-medium">Upload a file</h2>
          <p className="text-sm text-muted">PDF, Markdown or text, up to 10 MB.</p>
          <label htmlFor="file-title" className="sr-only">
            Title (optional)
          </label>
          <input
            id="file-title"
            value={fileTitle}
            onChange={(e) => setFileTitle(e.target.value)}
            maxLength={200}
            placeholder="Title (optional, defaults to the file name)"
            disabled={disabled}
            className={inputStyles}
          />
          <label htmlFor="file-input" className="sr-only">
            File
          </label>
          <input
            id="file-input"
            type="file"
            accept=".pdf,.md,.markdown,.txt,application/pdf,text/markdown,text/plain"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={disabled}
            className="text-sm file:mr-3 file:rounded-full file:border-0 file:bg-glass-strong file:px-4 file:py-2 file:text-sm"
          />
          <button
            type="submit"
            disabled={disabled || !file}
            className={`${buttonStyles} self-start bg-accent text-accent-foreground hover:opacity-90`}
          >
            Upload
          </button>
        </form>
      </div>

      {busy && (
        <p role="status" className="text-sm text-muted">
          {busy}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      {sources.length === 0 ? (
        <EmptyState
          title="No knowledge yet"
          description="Add text or upload a PDF so the bot can answer from it."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {sources.map((source) => (
            <li key={source.id} className="glass flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{source.title}</p>
                <p className="text-xs text-muted">
                  {source.type === "text" ? "Pasted text" : source.type.toUpperCase()} ·{" "}
                  {statusLabel(source.status)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(source)}
                disabled={busy !== null}
                className={`${buttonStyles} glass`}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
