"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type DragEvent, type FormEvent } from "react";
import { MAX_KNOWLEDGE_FILE_BYTES, type KnowledgeSource, type Plan } from "@askwell/shared";
import { EmptyState } from "@/components/empty-state";
import { KnowledgeUrlForm } from "@/components/knowledge-url-form";
import { Document, Plus, Trash, Upload } from "@/components/site/icons";

const inputStyles =
  "h-11 min-w-0 w-full rounded-xl border border-border bg-glass-strong px-4 text-sm outline-none transition-all focus-visible:ring-2 focus-visible:ring-foreground placeholder:text-muted/60";
const buttonStyles =
  "inline-flex h-10 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium transition-all disabled:opacity-50";

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

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function errorMessage(res: Response) {
  const body = await res.json().catch(() => null);
  return body?.error?.message ?? "Something went wrong. Try again.";
}

export function KnowledgeManager({
  projectId,
  sources,
  maxSources,
  plan = "free",
}: {
  projectId: string;
  sources: KnowledgeSource[];
  maxSources: number;
  plan?: Plan;
}) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"upload" | "text" | "url">("upload");
  const [textTitle, setTextTitle] = useState("");
  const [text, setText] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [fileTitle, setFileTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const atLimit = sources.length >= maxSources;
  const isPro = plan === "pro";
  const base = `/api/projects/${projectId}/knowledge`;
  const capacityPercent = Math.min(100, Math.round((sources.length / Math.max(1, maxSources)) * 100));

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
    if (!textTitle.trim() || !text.trim()) return;
    const ok = await run("Adding and indexing text...", async () => {
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: textTitle.trim(), text: text.trim() }),
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

  async function addWebsite(e: FormEvent) {
    e.preventDefault();
    if (!siteUrl.trim()) return;
    const ok = await run("Reading the website. This can take a minute...", async () => {
      const res = await fetch(`${base}/url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: siteUrl.trim() }),
      });
      if (!res.ok) {
        setError(await errorMessage(res));
        return false;
      }
      return true;
    });
    if (ok) setSiteUrl("");
  }

  function handleFileSelect(selected: File | null) {
    if (!selected) return;
    const kind = detectFileType(selected.name);
    if (!kind) {
      setError("Choose a PDF (.pdf), Markdown (.md), or plain text (.txt) file.");
      return;
    }
    if (selected.size === 0 || selected.size > MAX_KNOWLEDGE_FILE_BYTES) {
      setError("The file must be between 1 byte and 10 MB.");
      return;
    }
    setError(null);
    setFile(selected);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files?.[0] ?? null;
    handleFileSelect(dropped);
  }

  async function uploadFile(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    const kind = detectFileType(file.name);
    if (!kind) return setError("Choose a PDF, Markdown (.md) or text (.txt) file.");
    if (file.size === 0 || file.size > MAX_KNOWLEDGE_FILE_BYTES) {
      return setError("The file must be between 1 byte and 10 MB.");
    }

    const ok = await run("Uploading and processing file...", async () => {
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
    }
  }

  async function remove(source: KnowledgeSource) {
    if (!window.confirm(`Delete "${source.title}"? The assistant will immediately stop answering from it.`)) return;
    await run("Deleting source...", async () => {
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
    <div className="flex flex-col gap-6">
      {/* Add Knowledge Section with Tabs */}
      <section aria-label="Add knowledge sources" className="glass flex flex-col gap-5 rounded-2xl p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Add Knowledge Source</h2>
            <p className="text-xs text-muted mt-0.5">
              Upload documents or paste documentation to expand your bot&apos;s answers.
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex rounded-full border border-border bg-glass p-1 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveTab("upload")}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-medium transition-all ${
                activeTab === "upload"
                  ? "bg-foreground text-background shadow-xs"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Upload document</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("text")}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-medium transition-all ${
                activeTab === "text"
                  ? "bg-foreground text-background shadow-xs"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <Document className="h-3.5 w-3.5" />
              <span>Paste text</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("url")}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-medium transition-all ${
                activeTab === "url" ? "bg-foreground text-background shadow-xs" : "text-muted hover:text-foreground"
              }`}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Website</span>
            </button>
          </div>
        </div>

        {atLimit && !isPro && (
          <div className="rounded-xl border border-brand/20 bg-brand/10 p-3 text-xs text-brand">
            You have used all {maxSources} knowledge sources on the Free plan.{" "}
            <Link href="/dashboard/billing" className="font-semibold underline hover:opacity-80">
              Upgrade to Pro for up to 25 sources &rarr;
            </Link>
          </div>
        )}

        {/* Tab 1: Upload File */}
        {activeTab === "upload" && (
          <form onSubmit={uploadFile} className="flex flex-col gap-4">
            {/* Drag & Drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
                isDragging
                  ? "border-foreground bg-glass-strong"
                  : "border-border bg-glass-strong/40 hover:border-foreground/30"
              }`}
            >
              <input
                id="file-drop"
                type="file"
                accept=".pdf,.md,.markdown,.txt,application/pdf,text/markdown,text/plain"
                onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
                disabled={disabled}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
              />

              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <span className="rounded-full bg-foreground/10 px-3 py-1 font-mono text-xs font-medium uppercase tracking-wider text-foreground">
                    {detectFileType(file.name)?.type.toUpperCase()}
                  </span>
                  <p className="font-medium text-sm text-foreground">{file.name}</p>
                  <p className="text-xs text-muted">{formatBytes(file.size)}</p>
                  <span className="mt-2 text-xs font-medium text-brand underline">
                    Click or drop another file to replace
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="rounded-full border border-border bg-glass p-3">
                    <Upload className="h-5 w-5 text-muted" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Click to choose a file or drag and drop here
                    </p>
                    <p className="text-xs text-muted mt-0.5">
                      Supports PDF, Markdown (.md), and Text (.txt) up to 10 MB
                    </p>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="rounded-md border border-border bg-glass px-2 py-0.5 text-[10px] font-semibold text-muted">
                      PDF
                    </span>
                    <span className="rounded-md border border-border bg-glass px-2 py-0.5 text-[10px] font-semibold text-muted">
                      MD
                    </span>
                    <span className="rounded-md border border-border bg-glass px-2 py-0.5 text-[10px] font-semibold text-muted">
                      TXT
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Optional Title input */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="file-title" className="text-xs font-medium text-muted">
                Display title (optional)
              </label>
              <input
                id="file-title"
                value={fileTitle}
                onChange={(e) => setFileTitle(e.target.value)}
                maxLength={200}
                placeholder="Defaults to the uploaded file name"
                disabled={disabled}
                className={inputStyles}
              />
            </div>

            <button
              type="submit"
              disabled={disabled || !file}
              className={`${buttonStyles} self-start bg-foreground text-background hover:opacity-90 disabled:cursor-not-allowed`}
            >
              <Upload className="h-4 w-4" />
              <span>{busy ? busy : "Upload and index document"}</span>
            </button>
          </form>
        )}

        {/* Tab 2: Paste Text */}
        {activeTab === "text" && (
          <form onSubmit={addText} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="text-title" className="text-xs font-medium text-muted">
                Document title
              </label>
              <input
                id="text-title"
                value={textTitle}
                onChange={(e) => setTextTitle(e.target.value)}
                maxLength={200}
                placeholder="e.g. Return Policy, Pricing FAQ, Onboarding Guide"
                disabled={disabled}
                className={inputStyles}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="text-body" className="text-xs font-medium text-muted">
                  Knowledge content
                </label>
                <span className="font-mono text-xs text-muted">
                  {text.length.toLocaleString()} characters
                </span>
              </div>
              <textarea
                id="text-body"
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={200_000}
                rows={6}
                placeholder="Paste the documentation, answers, or policies the bot should cite..."
                disabled={disabled}
                className="min-h-36 w-full rounded-xl border border-border bg-glass-strong p-3.5 text-sm outline-none transition-all focus-visible:ring-2 focus-visible:ring-foreground placeholder:text-muted/60"
              />
            </div>

            <button
              type="submit"
              disabled={disabled || textTitle.trim() === "" || text.trim() === ""}
              className={`${buttonStyles} self-start bg-foreground text-background hover:opacity-90 disabled:cursor-not-allowed`}
            >
              <Plus className="h-4 w-4" />
              <span>{busy ? busy : "Add text source"}</span>
            </button>
          </form>
        )}

        {activeTab === "url" && (
          <KnowledgeUrlForm
            url={siteUrl}
            onUrl={setSiteUrl}
            onSubmit={addWebsite}
            disabled={disabled}
            busy={busy}
            maxPages={isPro ? 40 : 10}
          />
        )}

        {busy && (
          <p role="status" className="text-xs text-muted flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-brand animate-ping" />
            <span>{busy}</span>
          </p>
        )}

        {error && (
          <p role="alert" className="text-sm font-medium text-red-700">
            {error}
          </p>
        )}
      </section>

      {/* Sources Library List */}
      <section aria-label="Knowledge Sources Library" className="flex flex-col gap-4">
        {/* Header with capacity gauge */}
        <div className="glass flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-tight">
              Sources Library ({sources.length} of {maxSources})
            </h2>
            <p className="text-xs text-muted mt-0.5">
              {isPro ? "Pro plan (up to 25 sources)" : "Free tier (up to 3 sources)"}
            </p>
          </div>

          <div className="flex flex-col gap-1.5 sm:w-48">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>Capacity</span>
              <span>{capacityPercent}%</span>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-border"
              role="progressbar"
              aria-label="Knowledge capacity used"
              aria-valuenow={sources.length}
              aria-valuemin={0}
              aria-valuemax={maxSources}
            >
              <div
                className={`h-full rounded-full transition-all ${
                  capacityPercent >= 100
                    ? "bg-red-600"
                    : capacityPercent >= 80
                      ? "bg-amber-600"
                      : "bg-foreground"
                }`}
                style={{ width: `${capacityPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Sources List / Empty State */}
        {sources.length === 0 ? (
          <EmptyState
            title="No knowledge sources added yet"
            description="Upload a document or paste text above so your AI assistant can start answering questions accurately."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {sources.map((source) => (
              <div
                key={source.id}
                className="glass flex items-center justify-between gap-4 rounded-xl p-4 transition-all hover:border-foreground/20"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-glass">
                    {source.type === "pdf" ? (
                      <span className="text-xs font-bold text-red-600">PDF</span>
                    ) : source.type === "md" ? (
                      <span className="text-xs font-bold text-blue-600">MD</span>
                    ) : (
                      <Document className="h-5 w-5 text-muted" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold tracking-tight text-foreground">
                      {source.title}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted mt-0.5">
                      <span className="uppercase font-medium text-[11px]">
                        {source.type === "text" ? "Pasted text" : source.type}
                      </span>
                      <span>·</span>
                      <span>
                        Added{" "}
                        {new Date(source.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Status Indicator */}
                  {source.status === "ready" && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Ready
                    </span>
                  )}
                  {(source.status === "uploading" || source.status === "processing") && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                      Indexing...
                    </span>
                  )}
                  {source.status === "failed" && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-600">
                      Failed
                    </span>
                  )}

                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={() => remove(source)}
                    disabled={busy !== null}
                    title="Delete knowledge source"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-red-500/10 hover:text-red-700 disabled:opacity-40"
                  >
                    <Trash className="h-4 w-4" />
                    <span className="sr-only">Delete {source.title}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
