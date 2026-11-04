// Small helpers for dashboard navigation. Pure, so they are unit tested.

// Keeps the chosen project when moving between pages. The Projects home does not use it.
export function withProject(href: string, projectId: string | null): string {
  if (!projectId || href === "/dashboard") return href;
  return `${href}?project=${encodeURIComponent(projectId)}`;
}

export interface Command {
  id: string;
  label: string;
  hint: string;
  href: string;
}

// Every word typed must appear somewhere in the label or hint, in any order.
export function filterCommands(commands: Command[], query: string): Command[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return commands;
  return commands.filter((c) => {
    const text = `${c.label} ${c.hint}`.toLowerCase();
    return words.every((w) => text.includes(w));
  });
}

export function buildCommands(
  links: readonly { href: string; label: string }[],
  projects: { id: string; name: string }[],
  currentProject: string | null,
): Command[] {
  return [
    ...links.map((l) => ({ id: l.href, label: l.label, hint: "Go to page", href: withProject(l.href, currentProject) })),
    ...projects.map((p) => ({ id: `project-${p.id}`, label: p.name, hint: "Switch project", href: `/dashboard/knowledge?project=${encodeURIComponent(p.id)}` })),
  ];
}
