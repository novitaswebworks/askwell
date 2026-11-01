-- Core schema: tables, RLS, grants, and the Postgres functions that enforce limits.
-- Tenant isolation is RLS + grants (project.md section 7 and 9).

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------- tables

create table public.accounts (
  clerk_user_id text primary key,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id text not null references public.accounts (clerk_user_id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  public_key text not null unique,
  messages_used integer not null default 0 check (messages_used >= 0),
  period_start date not null default (date_trunc('month', now() at time zone 'utc'))::date,
  created_at timestamptz not null default now()
);
create index projects_owner_id_idx on public.projects (owner_id);

create table public.widget_configs (
  project_id uuid primary key references public.projects (id) on delete cascade,
  button_color text not null default '#000000' check (button_color ~ '^#[0-9a-fA-F]{6}$'),
  position text not null default 'bottom-right'
    check (position in ('bottom-right', 'bottom-left', 'top-right', 'top-left')),
  label text not null default 'Chat with us' check (char_length(label) <= 40),
  animation text not null default 'fade' check (animation in ('fade', 'slide', 'scale')),
  header_text text not null default 'How can we help?' check (char_length(header_text) <= 60),
  show_badge boolean not null default true
);

create table public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  type text not null check (type in ('text', 'pdf', 'md', 'txt')),
  storage_key text,
  status text not null default 'processing'
    check (status in ('uploading', 'processing', 'ready', 'failed')),
  created_at timestamptz not null default now()
);
create index knowledge_sources_project_id_idx on public.knowledge_sources (project_id);

create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  source_id uuid not null references public.knowledge_sources (id) on delete cascade,
  content text not null,
  embedding extensions.vector(1536) not null
);
create index knowledge_chunks_project_id_idx on public.knowledge_chunks (project_id);
create index knowledge_chunks_source_id_idx on public.knowledge_chunks (source_id);
create index knowledge_chunks_embedding_idx
  on public.knowledge_chunks using hnsw (embedding extensions.vector_cosine_ops);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  visitor_id text not null,
  created_at timestamptz not null default now()
);
create index conversations_project_id_created_idx
  on public.conversations (project_id, created_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role text not null check (role in ('visitor', 'bot')),
  body text not null,
  created_at timestamptz not null default now()
);
create index messages_conversation_id_created_idx
  on public.messages (conversation_id, created_at);

-- --------------------------------------------------------- RLS helpers
-- SECURITY DEFINER so a policy on one table can read projects without
-- recursing into that table's own policy. Pinned search_path, owner-scoped.

create function public.owned_project_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.projects
  where owner_id = (select auth.jwt() ->> 'sub');
$$;

create function public.owned_conversation_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.id from public.conversations c
  where c.project_id in (select public.owned_project_ids());
$$;

-- ------------------------------------------------------------------ RLS

alter table public.accounts enable row level security;
alter table public.projects enable row level security;
alter table public.widget_configs enable row level security;
alter table public.knowledge_sources enable row level security;
alter table public.knowledge_chunks enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Owners read their own rows. Writes go through the service client after the
-- route checks ownership and plan, except rename and delete of a project.
create policy projects_select_own on public.projects
  for select to authenticated
  using (owner_id = (select auth.jwt() ->> 'sub'));

create policy projects_update_own on public.projects
  for update to authenticated
  using (owner_id = (select auth.jwt() ->> 'sub'))
  with check (owner_id = (select auth.jwt() ->> 'sub'));

create policy projects_delete_own on public.projects
  for delete to authenticated
  using (owner_id = (select auth.jwt() ->> 'sub'));

create policy widget_configs_select_own on public.widget_configs
  for select to authenticated
  using (project_id in (select public.owned_project_ids()));

create policy knowledge_sources_select_own on public.knowledge_sources
  for select to authenticated
  using (project_id in (select public.owned_project_ids()));

create policy conversations_select_own on public.conversations
  for select to authenticated
  using (project_id in (select public.owned_project_ids()));

create policy messages_select_own on public.messages
  for select to authenticated
  using (conversation_id in (select public.owned_conversation_ids()));

-- accounts and knowledge_chunks: RLS on, no policy for owners. Only
-- service_role (which bypasses RLS) can touch them.

-- --------------------------------------------------------------- grants
-- Supabase grants broad default privileges to anon and authenticated.
-- Remove them, then grant back only what section 7 allows.

revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
revoke truncate on all tables in schema public from service_role;

grant select on public.projects to authenticated;
grant update (name) on public.projects to authenticated;
grant delete on public.projects to authenticated;
grant select on public.widget_configs to authenticated;
grant select on public.knowledge_sources to authenticated;
grant select on public.conversations to authenticated;
grant select on public.messages to authenticated;

grant all on all tables in schema public to service_role;
revoke truncate on all tables in schema public from service_role;

grant execute on function public.owned_project_ids() to authenticated;
grant execute on function public.owned_conversation_ids() to authenticated;

-- --------------------------------------------------- limit functions
-- SECURITY INVOKER, executable by service_role only. Plan limits are passed
-- in from PLAN_LIMITS (packages/shared) by the server.

create function public.create_project(
  p_owner_id text,
  p_name text,
  p_public_key text,
  p_max_projects integer
)
returns public.projects
language plpgsql
set search_path = ''
as $$
declare
  v_project public.projects;
begin
  -- Lock the account row so concurrent creates are serialized.
  perform 1 from public.accounts where clerk_user_id = p_owner_id for update;
  if not found then
    raise exception 'account_not_found' using errcode = 'P0002';
  end if;

  if (select count(*) from public.projects where owner_id = p_owner_id) >= p_max_projects then
    raise exception 'project_limit_reached' using errcode = 'P0001';
  end if;

  insert into public.projects (owner_id, name, public_key)
  values (p_owner_id, p_name, p_public_key)
  returning * into v_project;

  insert into public.widget_configs (project_id) values (v_project.id);

  return v_project;
end;
$$;

create function public.reserve_knowledge_source(
  p_project_id uuid,
  p_title text,
  p_type text,
  p_storage_key text,
  p_status text,
  p_max_sources integer
)
returns public.knowledge_sources
language plpgsql
set search_path = ''
as $$
declare
  v_source public.knowledge_sources;
begin
  -- Lock the project row so concurrent reservations are serialized.
  perform 1 from public.projects where id = p_project_id for update;
  if not found then
    raise exception 'project_not_found' using errcode = 'P0002';
  end if;

  -- Reclaim reservations that were never finalized within 2 hours.
  delete from public.knowledge_sources
  where project_id = p_project_id
    and status = 'uploading'
    and created_at < now() - interval '2 hours';

  if (select count(*) from public.knowledge_sources where project_id = p_project_id) >= p_max_sources then
    raise exception 'source_limit_reached' using errcode = 'P0001';
  end if;

  insert into public.knowledge_sources (project_id, title, type, storage_key, status)
  values (p_project_id, p_title, p_type, p_storage_key, p_status)
  returning * into v_source;

  return v_source;
end;
$$;

-- Counts one message in a single statement. Returns false at the limit.
-- A new month resets the counter.
create function public.consume_message(
  p_project_id uuid,
  p_monthly_limit integer
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_month date := (date_trunc('month', now() at time zone 'utc'))::date;
begin
  update public.projects
  set messages_used = case when period_start < v_month then 1 else messages_used + 1 end,
      period_start = v_month
  where id = p_project_id
    and (period_start < v_month or messages_used < p_monthly_limit);

  return found;
end;
$$;

create function public.save_chat_turn(
  p_project_id uuid,
  p_visitor_id text,
  p_conversation_id uuid,
  p_visitor_message text,
  p_bot_reply text
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_conversation_id uuid := p_conversation_id;
begin
  if v_conversation_id is null then
    insert into public.conversations (project_id, visitor_id)
    values (p_project_id, p_visitor_id)
    returning id into v_conversation_id;
  else
    perform 1 from public.conversations
    where id = v_conversation_id and project_id = p_project_id;
    if not found then
      raise exception 'conversation_not_found' using errcode = 'P0002';
    end if;
  end if;

  insert into public.messages (conversation_id, role, body, created_at)
  values (v_conversation_id, 'visitor', p_visitor_message, clock_timestamp());
  insert into public.messages (conversation_id, role, body, created_at)
  values (v_conversation_id, 'bot', p_bot_reply, clock_timestamp());

  return v_conversation_id;
end;
$$;

create function public.match_chunks(
  p_project_id uuid,
  p_query_embedding extensions.vector(1536),
  p_match_count integer default 5
)
returns table (id uuid, source_id uuid, content text, similarity double precision)
language sql
stable
set search_path = ''
as $$
  select c.id, c.source_id, c.content,
         1 - (c.embedding operator(extensions.<=>) p_query_embedding) as similarity
  from public.knowledge_chunks c
  join public.knowledge_sources s on s.id = c.source_id
  where c.project_id = p_project_id
    and s.project_id = p_project_id
    and s.status = 'ready'
  order by c.embedding operator(extensions.<=>) p_query_embedding
  limit p_match_count;
$$;

-- Dashboard numbers. SECURITY INVOKER: RLS scopes it to the caller's projects.
create function public.owner_activity()
returns table (
  project_id uuid,
  messages_used integer,
  period_start date,
  conversation_count bigint,
  source_count bigint
)
language sql
stable
set search_path = ''
as $$
  select p.id, p.messages_used, p.period_start,
         (select count(*) from public.conversations c where c.project_id = p.id),
         (select count(*) from public.knowledge_sources s where s.project_id = p.id)
  from public.projects p;
$$;

-- New functions get EXECUTE for PUBLIC (and, on Supabase, anon/authenticated)
-- by default. Revoke it explicitly, then grant back what each role needs.
revoke all on function public.create_project(text, text, text, integer) from public, anon, authenticated;
revoke all on function public.reserve_knowledge_source(uuid, text, text, text, text, integer) from public, anon, authenticated;
revoke all on function public.consume_message(uuid, integer) from public, anon, authenticated;
revoke all on function public.save_chat_turn(uuid, text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.match_chunks(uuid, extensions.vector, integer) from public, anon, authenticated;
revoke all on function public.owner_activity() from public, anon, authenticated;

grant execute on function public.create_project(text, text, text, integer) to service_role;
grant execute on function public.reserve_knowledge_source(uuid, text, text, text, text, integer) to service_role;
grant execute on function public.consume_message(uuid, integer) to service_role;
grant execute on function public.save_chat_turn(uuid, text, uuid, text, text) to service_role;
grant execute on function public.match_chunks(uuid, extensions.vector, integer) to service_role;
grant execute on function public.owner_activity() to authenticated;
