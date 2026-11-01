-- Private bucket for uploaded knowledge files (project.md section 3).
-- The bucket enforces the same size and types as the server checks.
-- No storage.objects policies on purpose: anon and authenticated get nothing,
-- and the server reaches the bucket only with the service key (signed upload
-- URLs for the browser, downloads for processing).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'knowledge',
  'knowledge',
  false,
  10485760,
  array['application/pdf', 'text/markdown', 'text/plain']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
