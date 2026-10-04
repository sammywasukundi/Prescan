-- ============================================================
-- PreScan — Row Level Security, stockage privé, audit
-- Principe : un médecin ne voit que SES patients / examens / prédictions.
-- Les administrateurs gèrent comptes, modèles, documents RAG et logs,
-- mais n'ont PAS accès aux données patients (moindre privilège).
-- ============================================================

-- ── Fonctions utilitaires (security definer : évitent la récursion RLS) ──
create function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and approved);
$$;

create function public.is_approved_doctor()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'doctor' and approved);
$$;

create function public.is_approved_user()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and approved);
$$;

create function public.current_user_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create function public.current_user_approved()
returns boolean language sql stable security definer set search_path = public as $$
  select approved from public.profiles where id = auth.uid();
$$;

-- ── Activation de la RLS partout ────────────────────────────
alter table public.profiles             enable row level security;
alter table public.abnormality_classes  enable row level security;
alter table public.model_versions       enable row level security;
alter table public.patients             enable row level security;
alter table public.ultrasound_exams     enable row level security;
alter table public.predictions          enable row level security;
alter table public.audit_logs           enable row level security;

-- ── profiles ────────────────────────────────────────────────
create policy "profiles_select_own_or_admin" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

-- Un utilisateur modifie son profil, mais ne peut changer ni son rôle ni son approbation.
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role = public.current_user_role()
    and approved = public.current_user_approved()
  );

create policy "profiles_update_admin" on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ── abnormality_classes / model_versions ────────────────────
create policy "classes_select_approved" on public.abnormality_classes
  for select to authenticated using (public.is_approved_user());
create policy "classes_admin_write" on public.abnormality_classes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "models_select_approved" on public.model_versions
  for select to authenticated using (public.is_approved_user());
create policy "models_admin_write" on public.model_versions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ── patients ────────────────────────────────────────────────
create policy "patients_select_own" on public.patients
  for select to authenticated
  using (doctor_id = auth.uid() and public.is_approved_doctor());

create policy "patients_insert_own" on public.patients
  for insert to authenticated
  with check (doctor_id = auth.uid() and public.is_approved_doctor());

create policy "patients_update_own" on public.patients
  for update to authenticated
  using (doctor_id = auth.uid() and public.is_approved_doctor())
  with check (doctor_id = auth.uid());

-- ── ultrasound_exams ────────────────────────────────────────
create policy "exams_select_own" on public.ultrasound_exams
  for select to authenticated
  using (doctor_id = auth.uid() and public.is_approved_doctor());

-- L'examen doit appartenir à un patient du même médecin.
create policy "exams_insert_own" on public.ultrasound_exams
  for insert to authenticated
  with check (
    doctor_id = auth.uid()
    and public.is_approved_doctor()
    and exists (
      select 1 from public.patients p
      where p.id = patient_id and p.doctor_id = auth.uid()
    )
  );
-- Pas de policy UPDATE/DELETE : le statut est géré uniquement par l'Edge Function (service role).

-- ── predictions ─────────────────────────────────────────────
create policy "predictions_select_own" on public.predictions
  for select to authenticated
  using (doctor_id = auth.uid() and public.is_approved_doctor());

-- INSERT réservé au service role (Edge Function). Le médecin peut seulement valider / corriger.
create policy "predictions_validate_own" on public.predictions
  for update to authenticated
  using (doctor_id = auth.uid() and public.is_approved_doctor())
  with check (doctor_id = auth.uid());

-- Seuls les champs de validation sont modifiables par le médecin.
create function public.predictions_guard()
returns trigger language plpgsql as $$
begin
  if auth.uid() is null then
    return new;  -- appel serveur (service role)
  end if;

  if (new.id, new.exam_id, new.doctor_id, new.model_name, new.model_version, new.predicted_class,
      new.confidence, new.probabilities, new.processing_time_ms, new.low_confidence, new.is_dummy, new.created_at)
     is distinct from
     (old.id, old.exam_id, old.doctor_id, old.model_name, old.model_version, old.predicted_class,
      old.confidence, old.probabilities, old.processing_time_ms, old.low_confidence, old.is_dummy, old.created_at)
  then
    raise exception 'Les champs du résultat du modèle sont immuables.' using errcode = '42501';
  end if;

  new.validated_by := auth.uid();
  new.validated_at := now();
  return new;
end;
$$;

create trigger predictions_guard_trg
  before update on public.predictions
  for each row execute function public.predictions_guard();

-- ── audit_logs : lecture admin uniquement, écriture via triggers / service role ──
create policy "audit_select_admin" on public.audit_logs
  for select to authenticated using (public.is_admin());

create function public.audit_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs (actor_id, action, entity_type, entity_id)
  values (auth.uid(), tg_argv[0], tg_table_name, new.id);
  return new;
end;
$$;

create trigger audit_patient_created after insert on public.patients
  for each row execute function public.audit_insert('patient.create');
create trigger audit_exam_created after insert on public.ultrasound_exams
  for each row execute function public.audit_insert('exam.create');

create function public.audit_prediction_validation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.validation_status is distinct from old.validation_status then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (
      auth.uid(), 'prediction.' || new.validation_status, 'predictions', new.id,
      jsonb_build_object('exam_id', new.exam_id, 'corrected_class', new.corrected_class)
    );
  end if;
  return new;
end;
$$;

create trigger audit_prediction_validated after update on public.predictions
  for each row execute function public.audit_prediction_validation();

-- ── Stockage privé des images ───────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ultrasounds', 'ultrasounds', false, 10485760, array['image/png', 'image/jpeg'])
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Convention de chemin : <doctor_id>/<exam_id>.<ext>
create policy "ultrasounds_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'ultrasounds'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_approved_doctor()
  );

create policy "ultrasounds_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'ultrasounds'
    and (storage.foldername(name))[1] = auth.uid()::text
    and public.is_approved_doctor()
  );

create policy "ultrasounds_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'ultrasounds'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
