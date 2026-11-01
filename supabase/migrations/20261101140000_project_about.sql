-- A short description of the business, written by the owner. The chat assistant
-- uses it to tell whether a visitor's question is about this business.
-- Additive: existing rows get an empty description and keep working.
alter table public.projects
  add column about text not null default '' check (char_length(about) <= 600);

-- Owners already may rename their own projects (RLS policy projects_update_own
-- limits the rows to theirs). Allow the same for this one column, nothing else.
grant update (about) on public.projects to authenticated;
