-- ============================================================
-- PreScan — base documentaire du chat RAG (pgvector)
-- Embeddings : modèle gte-small de Supabase (384 dimensions).
-- ============================================================
create extension if not exists vector with schema extensions;

create table public.rag_documents (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  source      text,                      -- URL ou référence bibliographique affichée au médecin
  content     text not null,
  is_active   boolean not null default true,
  created_by  uuid default auth.uid() references public.profiles(id),
  created_at  timestamptz not null default now()
);

create table public.rag_chunks (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references public.rag_documents(id) on delete cascade,
  chunk_index  int not null,
  content      text not null,
  embedding    extensions.vector(384) not null,
  unique (document_id, chunk_index)
);

create index rag_chunks_embedding_idx
  on public.rag_chunks using hnsw (embedding extensions.vector_cosine_ops);

alter table public.rag_documents enable row level security;
alter table public.rag_chunks    enable row level security;

create policy "rag_documents_select_approved" on public.rag_documents
  for select to authenticated using (public.is_approved_user());
create policy "rag_documents_admin_write" on public.rag_documents
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "rag_chunks_select_approved" on public.rag_chunks
  for select to authenticated using (public.is_approved_user());
create policy "rag_chunks_admin_write" on public.rag_chunks
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Recherche sémantique (security invoker : la RLS de l'appelant s'applique).
create function public.match_rag_chunks(
  query_embedding extensions.vector(384),
  match_count     int   default 5,
  min_similarity  float default 0.3
)
returns table (
  chunk_id     uuid,
  document_id  uuid,
  title        text,
  source       text,
  content      text,
  similarity   float
)
language sql stable security invoker
set search_path = public, extensions
as $$
  select c.id, d.id, d.title, d.source, c.content,
         1 - (c.embedding <=> query_embedding) as similarity
  from public.rag_chunks c
  join public.rag_documents d on d.id = c.document_id
  where d.is_active
    and 1 - (c.embedding <=> query_embedding) >= min_similarity
  order by c.embedding <=> query_embedding
  limit least(match_count, 10);
$$;
