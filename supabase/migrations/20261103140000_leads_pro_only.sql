-- Lead capture is a Pro feature. The dashboard and the export route check the plan on the
-- server, but the owner could still read their `leads` rows straight through Supabase because
-- the select policy only checked ownership. Make the database enforce it too.
--
-- Only the read policy changes. Leads captured while on Free are kept; they become visible
-- again if the owner upgrades. Writes are service role only, as before.

-- SECURITY DEFINER so the policy can read the owner's own account row without needing a
-- select policy on accounts (owners have none).
create function public.owner_is_pro()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.accounts a
    where a.clerk_user_id = (select auth.jwt() ->> 'sub')
      and a.plan = 'pro'
  );
$$;

revoke all on function public.owner_is_pro() from public, anon;
grant execute on function public.owner_is_pro() to authenticated;

drop policy leads_select_own on public.leads;

create policy leads_select_own on public.leads
  for select to authenticated
  using (
    project_id in (select public.owned_project_ids())
    and (select public.owner_is_pro())
  );
