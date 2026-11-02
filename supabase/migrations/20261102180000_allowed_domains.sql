-- Allowed domains per project: the sites that may show this project's widget.
-- An empty list (the default) means any site, so existing projects keep working.
-- Additive: the owner edits it through the existing column grants, like `about`.

alter table public.projects
  add column allowed_domains text[] not null default '{}'
    check (cardinality(allowed_domains) <= 10);

grant update (allowed_domains) on public.projects to authenticated;
