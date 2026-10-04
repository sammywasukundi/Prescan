-- ============================================================
-- PreScan — schéma principal
-- ============================================================

-- ── Profils médecins / administrateurs ──────────────────────
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  role        text not null default 'doctor' check (role in ('doctor', 'admin')),
  hospital    text,
  specialty   text,
  -- Un compte créé via l'inscription reste inactif tant qu'un administrateur ne l'a pas validé.
  approved    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Création automatique du profil. Le rôle n'est JAMAIS lu depuis les métadonnées
-- fournies par l'utilisateur : tout nouveau compte est « doctor » non approuvé.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, hospital, specialty)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'hospital',
    new.raw_user_meta_data ->> 'specialty'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Classes d'anomalies (16) ────────────────────────────────
-- class_index = position de la classe dans la sortie du modèle.
-- ⚠ Doit correspondre EXACTEMENT à l'ordre utilisé à l'entraînement
--   (voir inference-api/configs/densenet121-v1.yaml).
create table public.abnormality_classes (
  class_index     int primary key check (class_index between 0 and 15),
  class_key       text not null unique,
  label_fr        text not null,
  label_en        text not null,
  description_fr  text,
  description_en  text
);

-- TODO(équipe ML) : REMPLACER ces 16 classes PROVISOIRES par vos classes réelles,
-- dans l'ordre exact de l'entraînement. Elles servent uniquement à faire tourner le prototype.
insert into public.abnormality_classes (class_index, class_key, label_fr, label_en) values
  (0,  'normal',                    'Cerveau normal',                     'Normal brain'),
  (1,  'ventriculomegaly',          'Ventriculomégalie',                  'Ventriculomegaly'),
  (2,  'agenesis_corpus_callosum',  'Agénésie du corps calleux',          'Agenesis of the corpus callosum'),
  (3,  'dandy_walker',              'Malformation de Dandy-Walker',       'Dandy-Walker malformation'),
  (4,  'holoprosencephaly',         'Holoprosencéphalie',                 'Holoprosencephaly'),
  (5,  'arachnoid_cyst',            'Kyste arachnoïdien',                 'Arachnoid cyst'),
  (6,  'choroid_plexus_cyst',       'Kyste du plexus choroïde',           'Choroid plexus cyst'),
  (7,  'hydrocephalus',             'Hydrocéphalie',                      'Hydrocephalus'),
  (8,  'microcephaly',              'Microcéphalie',                      'Microcephaly'),
  (9,  'macrocephaly',              'Macrocéphalie',                      'Macrocephaly'),
  (10, 'encephalocele',             'Encéphalocèle',                      'Encephalocele'),
  (11, 'cerebellar_hypoplasia',     'Hypoplasie cérébelleuse',            'Cerebellar hypoplasia'),
  (12, 'vermian_agenesis',          'Agénésie du vermis',                 'Vermian agenesis'),
  (13, 'porencephaly',              'Porencéphalie',                      'Porencephaly'),
  (14, 'schizencephaly',            'Schizencéphalie',                    'Schizencephaly'),
  (15, 'intracranial_hemorrhage',   'Hémorragie intracrânienne',          'Intracranial hemorrhage');

-- ── Versions de modèles ─────────────────────────────────────
create table public.model_versions (
  id          uuid primary key default gen_random_uuid(),
  model_key   text not null unique check (model_key ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  name        text not null,
  kind        text not null default 'single' check (kind in ('single', 'ensemble')),
  is_active   boolean not null default false,
  notes       text,
  created_at  timestamptz not null default now()
);

-- Un seul modèle actif à la fois.
create unique index model_versions_single_active on public.model_versions (is_active) where is_active;

insert into public.model_versions (model_key, name, kind, is_active)
values ('densenet121-v1', 'DenseNet121', 'single', true);

-- ── Patients (pseudonymisés) ────────────────────────────────
create function public.gen_patient_code()
returns text
language sql
volatile
as $$
  select 'PS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
$$;

create table public.patients (
  id                      uuid primary key default gen_random_uuid(),
  doctor_id               uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  -- Code généré automatiquement : aucun nom, aucune date de naissance, aucun n° de dossier.
  anonymous_code          text not null unique default public.gen_patient_code(),
  gestational_age_weeks   int check (gestational_age_weeks between 1 and 45),
  clinical_notes          text check (char_length(clinical_notes) <= 2000),
  created_at              timestamptz not null default now()
);
create index patients_doctor_idx on public.patients (doctor_id, created_at desc);

-- ── Examens (une image = un examen) ─────────────────────────
create table public.ultrasound_exams (
  id           uuid primary key default gen_random_uuid(),
  patient_id   uuid not null references public.patients(id) on delete cascade,
  doctor_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  -- Chemin dans le bucket privé « ultrasounds » : <doctor_id>/<exam_id>.<ext>
  image_path   text not null,
  image_hash   text,
  status       text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  error_code   text,
  created_at   timestamptz not null default now()
);
create index exams_patient_idx on public.ultrasound_exams (patient_id, created_at desc);
create index exams_doctor_idx  on public.ultrasound_exams (doctor_id, created_at desc);

-- ── Prédictions ─────────────────────────────────────────────
create table public.predictions (
  id                  uuid primary key default gen_random_uuid(),
  exam_id             uuid not null references public.ultrasound_exams(id) on delete cascade,
  doctor_id           uuid not null references public.profiles(id),   -- médecin responsable
  model_name          text not null,
  model_version       text not null,
  predicted_class     text not null references public.abnormality_classes(class_key),
  confidence          numeric(6, 5) not null check (confidence between 0 and 1),
  probabilities       jsonb not null,
  processing_time_ms  int,
  low_confidence      boolean not null default false,
  -- true quand la réponse vient du modèle factice de développement : jamais à interpréter cliniquement.
  is_dummy            boolean not null default false,
  validation_status   text not null default 'pending' check (validation_status in ('pending', 'confirmed', 'corrected')),
  corrected_class     text references public.abnormality_classes(class_key),
  doctor_feedback     text check (char_length(doctor_feedback) <= 2000),
  validated_by        uuid references public.profiles(id),
  validated_at        timestamptz,
  created_at          timestamptz not null default now(),
  constraint corrected_class_consistency check ((validation_status = 'corrected') = (corrected_class is not null))
);
create index predictions_doctor_idx on public.predictions (doctor_id, created_at desc);
create index predictions_exam_idx   on public.predictions (exam_id);

-- ── Journal d'audit (append-only) ───────────────────────────
create table public.audit_logs (
  id           bigint generated always as identity primary key,
  actor_id     uuid,
  action       text not null,
  entity_type  text,
  entity_id    uuid,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
