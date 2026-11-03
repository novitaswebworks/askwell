-- "You've used 80% / all of your messages" emails: remember, per project and month, which
-- warning has already gone out so the owner gets each one once.
-- Additive: no existing column changes, and nothing here is visible to owners or visitors.

alter table public.projects
  add column quota_warned_period date,
  add column quota_warned_level smallint not null default 0
    check (quota_warned_level in (0, 80, 100));

-- service_role only. Returns true for the one caller that gets to send this level's email:
-- the first time the level is reached in the project's current month (a higher level
-- also counts as new, so 100% still goes out after 80%).
create function public.claim_quota_warning(p_project_id uuid, p_level smallint)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_level not in (80, 100) then
    raise exception 'invalid_level' using errcode = '22023';
  end if;

  update public.projects
  set quota_warned_period = period_start,
      quota_warned_level = p_level
  where id = p_project_id
    and (quota_warned_period is distinct from period_start or quota_warned_level < p_level);

  return found;
end;
$$;

revoke all on function public.claim_quota_warning(uuid, smallint) from public, anon, authenticated;
grant execute on function public.claim_quota_warning(uuid, smallint) to service_role;
