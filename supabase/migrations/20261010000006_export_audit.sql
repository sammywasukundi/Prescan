-- ============================================================
-- PreScan — journalisation des exports de dossiers d'analyse
-- ============================================================
-- Le fichier exporté est produit côté navigateur ; cette fonction enregistre seulement
-- le fait qu'un export a eu lieu (sans aucune donnée patient), pour l'onglet « Journal d'audit ».
-- Elle vérifie que la prédiction appartient bien au médecin appelant.

create function public.log_prediction_export(p_prediction_id uuid, p_format text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_format not in ('json', 'print') then
    raise exception 'Format inconnu.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.predictions
    where id = p_prediction_id and doctor_id = auth.uid()
  ) or not public.is_approved_doctor() then
    raise exception 'Analyse introuvable.' using errcode = '42501';
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'prediction.export', 'predictions', p_prediction_id, jsonb_build_object('format', p_format));
end;
$$;

revoke all on function public.log_prediction_export(uuid, text) from public, anon;
grant execute on function public.log_prediction_export(uuid, text) to authenticated;
