-- Configurable welcome message and starter questions per project (PR 1).
-- Free projects get defaults; Pro owners can customize them in the dashboard.
-- Additive: existing rows get the default welcome message and questions.

alter table public.widget_configs
  add column welcome_message text not null default 'Ask a question and we''ll reply right here.'
    check (char_length(welcome_message) <= 200),
  add column starter_questions jsonb not null default '["What services do you offer?", "How do I get started?", "How can I contact you?"]'::jsonb
    check (jsonb_typeof(starter_questions) = 'array' and jsonb_array_length(starter_questions) <= 4);
