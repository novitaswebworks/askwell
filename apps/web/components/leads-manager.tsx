"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Lead, Project } from "@askwell/shared";
import { LocalTime } from "./local-time";

export function LeadsManager({
  projects,
  selectedProjectId,
  initialLeads,
}: {
  projects: Project[];
  selectedProjectId: string;
  initialLeads: Lead[];
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return initialLeads;
    return initialLeads.filter(
      (lead) =>
        lead.email.toLowerCase().includes(q) ||
        (lead.name && lead.name.toLowerCase().includes(q)) ||
        (lead.phone && lead.phone.toLowerCase().includes(q)),
    );
  }, [initialLeads, search]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? projects[0];

  return (
    <div className="flex flex-col gap-6">
      {/* Project selector */}
      {projects.length > 1 && (
        <nav aria-label="Project" className="flex flex-wrap gap-2">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/dashboard/leads?project=${p.id}`}
              aria-current={p.id === selectedProjectId ? "page" : undefined}
              className={`rounded-full px-4 py-2 text-sm ${
                p.id === selectedProjectId ? "bg-accent text-accent-foreground" : "glass"
              }`}
            >
              {p.name}
            </Link>
          ))}
        </nav>
      )}

      {/* Header controls: Search & Export CSV */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads by email, name, phone..."
            aria-label="Search leads"
            className="h-10 w-full rounded-xl border border-border bg-glass-strong px-3.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>

        {selectedProject && (
          <a
            href={`/api/projects/${selectedProject.id}/leads?format=csv`}
            download
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-glass px-4 text-sm font-medium hover:bg-glass-strong hover:text-foreground transition"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Export CSV</span>
          </a>
        )}
      </div>

      {/* Table / Empty State */}
      {filtered.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center">
          <p className="font-medium text-foreground">
            {search.trim() ? "No matching leads found" : "No leads captured yet"}
          </p>
          <p className="mt-1 text-sm text-muted">
            {search.trim()
              ? "Try searching for a different name, email or phone number."
              : "When website visitors leave their contact details or ask to speak to a person, their information will appear here."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-glass">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-glass-strong text-xs text-muted uppercase">
              <tr>
                <th scope="col" className="px-4 py-3">Date</th>
                <th scope="col" className="px-4 py-3">Email</th>
                <th scope="col" className="px-4 py-3">Name</th>
                <th scope="col" className="px-4 py-3">Phone</th>
                <th scope="col" className="px-4 py-3 text-right">Conversation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((lead) => (
                <tr key={lead.id} className="hover:bg-glass-strong transition-colors">
                  <td className="whitespace-nowrap px-4 py-3 text-muted">
                    <LocalTime iso={lead.createdAt} />
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    <a href={`mailto:${lead.email}`} className="hover:underline">
                      {lead.email}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-foreground/80">{lead.name || "—"}</td>
                  <td className="px-4 py-3 text-foreground/80">{lead.phone || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    {lead.conversationId ? (
                      <Link
                        href={`/dashboard/conversations/${lead.conversationId}`}
                        className="text-xs font-medium text-accent hover:underline"
                      >
                        View Chat →
                      </Link>
                    ) : (
                      <span className="text-muted text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
