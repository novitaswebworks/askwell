-- PR 2: Lead capture for Pro projects
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete set null,
  email text not null check (char_length(email) <= 255),
  name text check (name is null or char_length(name) <= 100),
  phone text check (phone is null or char_length(phone) <= 30),
  created_at timestamptz not null default now()
);

create index leads_project_id_created_idx
  on public.leads (project_id, created_at desc);

create index leads_conversation_id_idx
  on public.leads (conversation_id);

-- RLS: owners can read leads belonging to their projects
alter table public.leads enable row level security;

create policy leads_select_own on public.leads
  for select to authenticated
  using (project_id in (select public.owned_project_ids()));

-- Grants: authenticated can read; service_role has full access for writes
revoke all on table public.leads from anon, authenticated;
grant select on public.leads to authenticated;
grant all on table public.leads to service_role;
revoke truncate on table public.leads from service_role;
