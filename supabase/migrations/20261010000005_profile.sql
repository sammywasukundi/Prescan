-- ============================================================
-- PreScan — profil personnel : coordonnées et photo
-- ============================================================

alter table public.profiles
  add column phone       text check (phone is null or char_length(phone) <= 40),
  add column bio         text check (bio is null or char_length(bio) <= 500),
  add column avatar_path text check (avatar_path is null or char_length(avatar_path) <= 200);

-- Le chemin de la photo doit rester dans le dossier de son propriétaire (<user_id>/…).
create or replace function public.profiles_guard()
returns trigger language plpgsql as $$
begin
  if new.avatar_path is not null and new.avatar_path not like new.id::text || '/%' then
    raise exception 'Chemin de photo invalide.' using errcode = '23514';
  end if;

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

-- Audit des modifications de profil (sans valeurs : seulement le fait qu'il a changé).
create function public.audit_profile_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and (
       new.full_name is distinct from old.full_name or new.hospital is distinct from old.hospital
    or new.specialty is distinct from old.specialty or new.phone is distinct from old.phone
    or new.bio is distinct from old.bio or new.avatar_path is distinct from old.avatar_path
  ) then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id)
    values (auth.uid(), 'profile.update', 'profiles', new.id);
  end if;
  return new;
end;
$$;

create trigger audit_profile_update_trg
  after update on public.profiles
  for each row execute function public.audit_profile_update();

-- ── Bucket privé des photos de profil ───────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/png', 'image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Convention de chemin : <user_id>/<horodatage>.<ext>. Chaque utilisateur ne touche qu'à son dossier.
create policy "avatars_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
