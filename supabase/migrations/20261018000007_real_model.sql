-- Intégration du modèle entraîné : ensemble par stacking MobileNetV2 + VGG16 + DenseNet121.
--
-- 1. Remplace les 16 classes PROVISOIRES par les classes réelles, dans l'ordre exact des colonnes
--    de test/_classes.csv (= index de sortie des réseaux). inference-api/configs/stacking-v1.yaml
--    doit lister les mêmes `class_key`, dans le même ordre.
-- 2. Déclare le modèle `stacking-v1` et l'active.
--
-- Les résultats produits par le modèle FACTICE (is_dummy = true) n'ont aucun sens clinique et
-- référencent les anciennes classes : ils sont supprimés et leurs examens redeviennent « pending »
-- (l'image est conservée, l'analyse peut être relancée avec le vrai modèle).

do $$
begin
  if exists (select 1 from public.predictions where not is_dummy) then
    raise exception 'Des résultats non factices existent : migration interrompue pour ne pas les corrompre.';
  end if;
end $$;

update public.ultrasound_exams
   set status = 'pending', error_code = null
 where id in (select exam_id from public.predictions where is_dummy);

delete from public.predictions where is_dummy;

delete from public.abnormality_classes;

insert into public.abnormality_classes (class_index, class_key, label_fr, label_en) values
  (0,  'arnold_chiari_malformation',  'Malformation d''Arnold-Chiari',          'Arnold-Chiari malformation'),
  (1,  'arachnoid_cyst',              'Kyste arachnoïdien',                     'Arachnoid cyst'),
  (2,  'cerebellar_hypoplasia',       'Hypoplasie cérébelleuse',                'Cerebellar hypoplasia'),
  (3,  'colpocephaly',                'Colpocéphalie',                          'Colpocephaly'),
  (4,  'encephalocele',               'Encéphalocèle',                          'Encephalocele'),
  (5,  'holoprosencephaly',           'Holoprosencéphalie',                     'Holoprosencephaly'),
  (6,  'hydranencephaly',             'Hydranencéphalie',                       'Hydranencephaly'),
  (7,  'intracranial_hemorrhage',     'Hémorragie intracrânienne',              'Intracranial hemorrhage'),
  (8,  'intracranial_tumor',          'Tumeur intracrânienne',                  'Intracranial tumor'),
  (9,  'mega_cisterna_magna',         'Mégacisterna magna',                     'Mega cisterna magna'),
  (10, 'mild_ventriculomegaly',       'Ventriculomégalie légère',               'Mild ventriculomegaly'),
  (11, 'moderate_ventriculomegaly',   'Ventriculomégalie modérée',              'Moderate ventriculomegaly'),
  (12, 'normal',                      'Cerveau normal',                         'Normal brain'),
  (13, 'porencephaly',                'Porencéphalie',                          'Porencephaly'),
  (14, 'severe_ventriculomegaly',     'Ventriculomégalie sévère',               'Severe ventriculomegaly'),
  (15, 'vein_of_galen_malformation',  'Malformation de la veine de Galien',     'Vein of Galen malformation');

-- Les autres tables référencent les classes par `class_key` : aucune ligne ne doit pointer vers une
-- ancienne clé (les prédictions factices viennent d'être supprimées ; les corrections en dépendaient).

update public.model_versions set is_active = false where is_active;

insert into public.model_versions (model_key, name, kind, is_active, notes)
values (
  'stacking-v1',
  'Ensemble MobileNetV2 + VGG16 + DenseNet121 (stacking)',
  'ensemble',
  true,
  'Méta-modèle : régression logistique. Les classes intracranial_tumor et vein_of_galen_malformation '
  'ne sont jamais prédites (absentes de l''entraînement du méta-modèle).'
)
on conflict (model_key) do update set is_active = true, name = excluded.name, kind = excluded.kind, notes = excluded.notes;
