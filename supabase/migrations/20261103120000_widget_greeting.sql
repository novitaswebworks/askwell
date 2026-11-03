-- Optional greeting bubble: a short line that pops up beside the chat button once per visitor
-- (widget upgrade). Off by default. Pro owners can turn it on and edit the text; Free projects
-- always get the defaults (greeting off), applied on the server like the other settings.
-- Additive: existing rows get greeting off and the default text.

alter table public.widget_configs
  add column greeting_enabled boolean not null default false,
  add column greeting_text text not null default 'Hi! Need a hand? Ask me anything.'
    check (char_length(greeting_text) between 1 and 120);
