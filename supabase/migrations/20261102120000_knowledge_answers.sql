-- The question-and-answer pairs an owner wrote in the guided builder, kept so they
-- can reopen and edit them. Only the builder's own source has it; every other
-- source stays null. Additive: existing rows get null.
alter table public.knowledge_sources
  add column answers jsonb check (answers is null or pg_column_size(answers) <= 100000);
-- Owners already have SELECT on knowledge_sources (the whole table), which covers
-- the new column. Only the server writes it (service_role).
