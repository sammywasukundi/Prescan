-- ============================================================
-- PreScan — suppression d'une analyse par son médecin
-- ============================================================
-- Supprime l'examen (la prédiction part en cascade) et, si le patient pseudonyme n'a plus aucun
-- autre examen, le patient lui-même (minimisation des données). L'image du stockage est supprimée
-- par le navigateur avec le chemin renvoyé (la policy « ultrasounds_delete_own » existe déjà).
-- Le journal d'audit garde seulement le fait de la suppression, sans donnée patient.

create function public.delete_analysis(p_prediction_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_exam_id uuid;
  v_patient_id uuid;
  v_path text;
begin
  select e.id, e.patient_id, e.image_path
    into v_exam_id, v_patient_id, v_path
  from public.predictions p
  join public.ultrasound_exams e on e.id = p.exam_id
  where p.id = p_prediction_id
    and p.doctor_id = auth.uid()
    and e.doctor_id = auth.uid()
    and public.is_approved_doctor();

  if v_exam_id is null then
    raise exception 'Analyse introuvable.' using errcode = '42501';
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id)
  values (auth.uid(), 'prediction.delete', 'predictions', p_prediction_id);

  delete from public.ultrasound_exams where id = v_exam_id;
  delete from public.patients p
  where p.id = v_patient_id
    and not exists (select 1 from public.ultrasound_exams e where e.patient_id = p.id);

  return v_path;
end;
$$;

revoke all on function public.delete_analysis(uuid) from public, anon;
grant execute on function public.delete_analysis(uuid) to authenticated;
