-- Thumbs up / down on the bot's answers (widget upgrade).
-- `rating` is 1 (helpful), -1 (not helpful) or null (not rated). A visitor rates the
-- latest answer in their conversation; owners read the ratings through the existing
-- select policy on messages. Additive: existing rows stay null.

alter table public.messages
  add column rating smallint check (rating in (-1, 1));

-- service_role only (called from the public rate route after it has checked the key).
-- p_rating 0 clears a rating. Returns false when the conversation has no answer yet.
create function public.rate_last_reply(
  p_project_id uuid,
  p_conversation_id uuid,
  p_rating smallint
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_message_id uuid;
begin
  if p_rating not in (-1, 0, 1) then
    raise exception 'invalid_rating' using errcode = '22023';
  end if;

  select m.id into v_message_id
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  where c.id = p_conversation_id
    and c.project_id = p_project_id
    and m.role = 'bot'
  order by m.created_at desc
  limit 1;

  if v_message_id is null then
    return false;
  end if;

  update public.messages set rating = nullif(p_rating, 0) where id = v_message_id;
  return true;
end;
$$;

revoke all on function public.rate_last_reply(uuid, uuid, smallint) from public, anon, authenticated;
grant execute on function public.rate_last_reply(uuid, uuid, smallint) to service_role;
