// A plain GET form: it works without JavaScript and keeps the search in the address bar.
export function ConversationSearch({
  projectId,
  q,
  unhelpful,
}: {
  projectId: string;
  q: string;
  unhelpful: boolean;
}) {
  const exportParams = new URLSearchParams();
  if (q) exportParams.set("q", q);
  if (unhelpful) exportParams.set("filter", "unhelpful");
  const exportHref = `/api/projects/${projectId}/conversations/export${exportParams.size ? `?${exportParams}` : ""}`;
  return (
    <form method="get" action="/dashboard/conversations" role="search" className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="project" value={projectId} />
      <label htmlFor="conversation-search" className="sr-only">
        Search conversations
      </label>
      <input
        id="conversation-search"
        name="q"
        type="search"
        defaultValue={q}
        maxLength={100}
        placeholder="Search what visitors asked"
        className="h-10 min-w-0 flex-1 rounded-full border border-border bg-glass-strong px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-foreground sm:max-w-xs"
      />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="filter" value="unhelpful" defaultChecked={unhelpful} className="h-4 w-4 accent-foreground" />
        <span>Not helpful only</span>
      </label>
      <button type="submit" className="inline-flex h-10 items-center rounded-full bg-foreground px-4 text-sm font-medium text-background hover:opacity-90">
        Search
      </button>
      {(q || unhelpful) && (
        <a href={`/dashboard/conversations?project=${projectId}`} className="text-sm text-muted underline hover:text-foreground">
          Clear
        </a>
      )}
      <a
        href={exportHref}
        download
        className="glass ml-auto inline-flex h-10 items-center rounded-full px-4 text-sm font-medium transition-colors hover:bg-glass-strong"
      >
        Download CSV
      </a>
    </form>
  );
}
