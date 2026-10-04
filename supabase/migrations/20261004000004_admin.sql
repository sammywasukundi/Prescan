-- ============================================================
-- PreScan — support de la page d'administration
-- ============================================================

-- ── E-mail dans profiles ────────────────────────────────────
-- Visible uniquement par le propriétaire du profil et les administrateurs (RLS existante).
alter table public.profiles add column email text;
update public.profiles p set email = u.email from auth.users u where u.id = p.id;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, hospital, specialty)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'hospital',
    new.raw_user_meta_data ->> 'specialty'
  );
  return new;
end;
$$;

-- ── Garde-fou sur les profils ───────────────────────────────
-- Depuis l'application (JWT présent) : le rôle, l'e-mail et l'identifiant sont immuables,
-- et personne ne peut modifier sa propre approbation (pas d'auto-verrouillage ni d'auto-validation).
-- Depuis le SQL Editor / service role (pas de JWT) : tout reste possible, ce qui permet de
-- promouvoir un administrateur en SQL.
create function public.profiles_guard()
returns trigger language plpgsql as $$
begin
  if auth.uid() is null then
    return new;
  end if;

  if new.id is distinct from old.id or new.email is distinct from old.email then
    raise exception 'Identifiant et e-mail ne sont pas modifiables.' using errcode = '42501';
  end if;
  if new.role is distinct from old.role then
    raise exception 'Le rôle ne peut pas être modifié depuis l''application.' using errcode = '42501';
  end if;
  if new.id = auth.uid() and new.approved is distinct from old.approved then
    raise exception 'Vous ne pouvez pas modifier votre propre approbation.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_trg
  before update on public.profiles
  for each row execute function public.profiles_guard();

-- ── Audit des comptes, modèles et documents ─────────────────
create function public.audit_account_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.approved is distinct from old.approved then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id)
    values (auth.uid(), case when new.approved then 'account.approve' else 'account.revoke' end, 'profiles', new.id);
  end if;
  return new;
end;
$$;

create trigger audit_account_status_trg
  after update on public.profiles
  for each row execute function public.audit_account_status();

create trigger audit_model_created after insert on public.model_versions
  for each row execute function public.audit_insert('model.create');

create function public.audit_rag_document_deleted()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'rag.delete', 'rag_documents', old.id, jsonb_build_object('title', old.title));
  return old;
end;
$$;

create trigger audit_rag_document_deleted_trg
  after delete on public.rag_documents
  for each row execute function public.audit_rag_document_deleted();

-- ── Activation d'un modèle (un seul actif à la fois) ────────
create function public.activate_model(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.model_versions where id = p_id) then
    raise exception 'Modèle introuvable.' using errcode = 'P0002';
  end if;

  update public.model_versions set is_active = false where is_active;
  update public.model_versions set is_active = true where id = p_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id)
  values (auth.uid(), 'model.activate', 'model_versions', p_id);
end;
$$;

revoke execute on function public.activate_model(uuid) from public, anon;
grant execute on function public.activate_model(uuid) to authenticated;
