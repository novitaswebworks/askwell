-- Hybrid retrieval: meaning (vector) plus keywords (full text), fused by rank.
-- Vector search alone ranked a chunk named "Cape Town" 16th for "Tell me about
-- Cape Town", because the embedding model separates topics poorly. A keyword hit
-- puts it back on top.
--
-- A new function, so the deployed route keeps using match_chunks until the new
-- code is live (migrations stay additive).

create index knowledge_chunks_fts_idx
  on public.knowledge_chunks using gin (to_tsvector('simple', content));

create function public.match_chunks_hybrid(
  p_project_id uuid,
  p_query_embedding extensions.vector(1536),
  p_query_text text,
  p_match_count integer default 8
)
returns table (id uuid, source_id uuid, content text, similarity double precision)
language sql
stable
set search_path = ''
as $$
  with ready as (
    select c.id, c.source_id, c.content, c.embedding
    from public.knowledge_chunks c
    join public.knowledge_sources s on s.id = c.source_id
    where c.project_id = p_project_id
      and s.project_id = p_project_id
      and s.status = 'ready'
  ),
  by_meaning as (
    select r.id,
           row_number() over (order by r.embedding operator(extensions.<=>) p_query_embedding) as rnk
    from ready r
    order by r.embedding operator(extensions.<=>) p_query_embedding
    limit 30
  ),
  by_keywords as (
    select r.id,
           row_number() over (
             order by ts_rank_cd(to_tsvector('simple', r.content), websearch_to_tsquery('simple', p_query_text)) desc
           ) as rnk
    from ready r
    where coalesce(p_query_text, '') <> ''
      and to_tsvector('simple', r.content) @@ websearch_to_tsquery('simple', p_query_text)
    order by ts_rank_cd(to_tsvector('simple', r.content), websearch_to_tsquery('simple', p_query_text)) desc
    limit 30
  ),
  fused as (
    select coalesce(m.id, k.id) as id,
           coalesce(1.0 / (60 + m.rnk), 0) + coalesce(1.0 / (60 + k.rnk), 0) as score
    from by_meaning m
    full join by_keywords k on k.id = m.id
  )
  select r.id, r.source_id, r.content,
         1 - (r.embedding operator(extensions.<=>) p_query_embedding) as similarity
  from fused f
  join ready r on r.id = f.id
  order by f.score desc, r.id
  limit p_match_count;
$$;

revoke all on function public.match_chunks_hybrid(uuid, extensions.vector, text, integer) from public, anon, authenticated;
grant execute on function public.match_chunks_hybrid(uuid, extensions.vector, text, integer) to service_role;
