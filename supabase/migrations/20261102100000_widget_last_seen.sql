-- When the widget last loaded on a customer's website, and on which site. The
-- Install page uses it to say "Connected" so a non-technical owner can tell the
-- code was pasted in the right place. Additive: existing rows get null.
alter table public.widget_configs
  add column last_seen_at timestamptz,
  add column last_seen_host text check (last_seen_host is null or char_length(last_seen_host) <= 253);
-- Owners already have SELECT on widget_configs (the whole table), which covers
-- the new columns. Only the server writes them (service_role), nobody else.
