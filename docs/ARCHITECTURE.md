# Architecture PreScan

## Vue d'ensemble

```text
 Médecin (navigateur)
        │  HTTPS
        ▼
 ┌──────────────────────────┐        ┌──────────────────────────────────────────┐
 │ web/  Next.js (Vercel)   │───────▶│ Supabase                                 │
 │ React · Tailwind · Motion│  JWT   │  Auth · Postgres (RLS) · Storage privé   │
 └──────────────────────────┘        │  Edge Functions : predict-exam,          │
                                     │                   rag-chat, rag-ingest   │
                                     └───────────────┬──────────────────────────┘
                                                     │ Bearer <jeton de service>
                                                     ▼
                                     ┌──────────────────────────────────────────┐
                                     │ inference-api/  FastAPI (Render/Railway) │
                                     │ prétraitement → modèle (DenseNet121 /    │
                                     │ ensemble) → probabilités des 16 classes  │
                                     └──────────────────────────────────────────┘
```

Principes :

- Le navigateur **n'appelle jamais** l'API d'inférence et ne connaît **aucun secret** : tout passe par l'Edge Function, qui vérifie le JWT, le rôle et la propriété de l'examen.
- Le modèle est **remplaçable sans toucher au frontend ni à la base** : un fichier YAML par version (`inference-api/configs/`), une interface `ModelAdapter` (modèle simple, ensemble, factice).
- La **RLS** est la barrière de sécurité principale. Les administrateurs gèrent comptes, modèles, documents RAG et logs, mais **n'accèdent pas** aux patients, examens ni prédictions.
- Les résultats du modèle sont **immuables** (trigger `predictions_guard`) : le médecin ne peut modifier que sa validation.

## Flux d'une analyse

1. Le médecin choisit un patient et dépose une image (contrôles navigateur : signature PNG/JPEG, 10 Mo, dimensions).
2. Upload dans le bucket privé `ultrasounds` au chemin `<doctor_id>/<exam_id>.<ext>` (aucun nom de fichier d'origine).
3. Insertion de la ligne `ultrasound_exams` (RLS : le patient doit appartenir au médecin).
4. Appel de `predict-exam` : JWT → médecin approuvé → examen visible via RLS → statut `processing` → téléchargement de l'image → `POST /predict`.
5. L'API prétraite (config YAML), infère, renvoie probabilités, top 3, drapeau de confiance faible et `is_dummy`.
6. L'Edge Function enregistre la prédiction (version du modèle, probabilités, médecin responsable), passe l'examen en `completed`, écrit l'audit.
7. Le médecin confirme ou corrige : `validation_status`, `corrected_class`, `validated_by`, `validated_at` sont renseignés et audités.

## Arborescence

```text
prescan/
├── .github/workflows/ci.yml
├── docs/ARCHITECTURE.md
├── supabase/
│   ├── config.toml
│   ├── migrations/            # schéma · RLS + stockage + audit · RAG (pgvector)
│   ├── functions/
│   │   ├── _shared/           # http.ts · auth.ts · embeddings.ts
│   │   ├── predict-exam/      # analyse d'un examen
│   │   ├── rag-chat/          # chat en streaming SSE
│   │   └── rag-ingest/        # indexation de documents (admin)
│   └── seed/rag/              # documents d'amorçage du chat
├── inference-api/
│   ├── app/
│   │   ├── main.py · config.py · errors.py · schemas.py · security.py · dependencies.py
│   │   ├── routes/            # health.py · predict.py
│   │   ├── services/          # preprocessing.py · model_registry.py · inference.py · model_config.py
│   │   └── models/            # poids (.pt) — non versionnés
│   ├── configs/               # densenet121-v1.yaml · ensemble-v1.example.yaml
│   ├── tests/                 # 22 tests pytest
│   ├── Dockerfile · requirements*.txt
└── web/
    └── src/
        ├── app/               # landing · login · pending · (app)/{dashboard,patients,analyses/new,assistant}
        ├── components/        # UploadDropzone · AnalysisProgress · PredictionResult · ProbabilityBars
        │                      # ConfidenceRing · ValidationPanel · ChatPanel · ThemeToggle · …
        └── lib/               # supabase/{client,server,middleware} · predict · ragStream · validateImage
```

## Endpoints

### Edge Functions (`https://<projet>.supabase.co/functions/v1/…`, en-tête `Authorization: Bearer <JWT>`)

| Méthode | Route | Rôle | Corps | Réponse |
|---|---|---|---|---|
| POST | `/predict-exam` | médecin approuvé | `{ "exam_id": uuid }` | `200 { prediction }` ou `{ error: { code, message } }` |
| POST | `/rag-chat` | médecin / admin | `{ message, history? }` | flux SSE : `sources`, `delta`, `done`, `error` |
| POST | `/rag-ingest` | admin | `{ title, source?, content }` | `201 { document_id, chunks }` |

Codes d'erreur de `predict-exam` : `unauthenticated` (401), `not_approved` / `forbidden` (403), `invalid_request` (400), `exam_not_found` (404), `already_processing` / `already_completed` (409), `image_too_large` (413), `unsupported_format` (415), `unreadable_image` (422), `inference_timeout` (504), `model_unavailable` (503), `prediction_save_failed` (500).

### API d'inférence FastAPI (serveur à serveur uniquement)

| Méthode | Route | Auth | Description |
|---|---|---|---|
| GET | `/health` | aucune | liveness |
| GET | `/ready` | aucune | le modèle par défaut est chargeable (503 sinon) |
| POST | `/predict` (alias `/v1/predict`) | `Bearer <PRESCAN_SERVICE_TOKEN>` | `multipart/form-data` : `exam_id` (uuid), `model_version` (optionnel), `image` (PNG/JPEG) |

Réponse de `/predict` : `exam_id`, `model_name`, `model_version`, `predicted_class`, `confidence`, `probabilities` (16 classes), `top3`, `low_confidence`, `low_confidence_threshold`, `is_dummy`, `processing_time_ms`, `disclaimer`.

### Données (PostgREST, protégées par RLS)

`patients` (select/insert/update), `ultrasound_exams` (select/insert), `predictions` (select, update des champs de validation), `abnormality_classes`, `model_versions` (lecture ; écriture admin), `rag_documents` / `rag_chunks` (lecture ; écriture admin), `audit_logs` (lecture admin).

## Gestion des erreurs

| Situation | Détection | Comportement |
|---|---|---|
| Fichier vide / mauvais format / trop gros | navigateur, Edge Function, FastAPI | message précis avant tout envoi quand c'est possible |
| Image illisible ou trop petite | navigateur (`createImageBitmap`), PIL | `unreadable_image`, examen `failed`, nouvel essai possible |
| Modèle indisponible / poids manquants | FastAPI → 503 | `model_unavailable`, bouton « Réessayer » (l'image n'est pas renvoyée) |
| Timeout d'inférence | Edge Function (`INFERENCE_TIMEOUT_MS`) | `inference_timeout` (504) |
| Confiance sous le seuil | FastAPI (`low_confidence_threshold`) | bandeau d'alerte, compteur sur le tableau de bord |
| Modèle factice actif | `is_dummy` | bandeau rouge « aucune valeur clinique », badge sur le tableau de bord |

## Intégrer le vrai modèle

1. Déposer les poids dans `inference-api/app/models/densenet121_v1.pt` (jamais dans git).
2. Remplacer `class_names` dans `configs/densenet121-v1.yaml` par vos 16 classes **dans l'ordre exact de l'entraînement**, et les mêmes clés dans `abnormality_classes` (migration `…_schema.sql`).
3. Reporter `image_size`, `color_mode`, `mean`, `std` de l'entraînement.
4. Si la tête du réseau diffère d'un `Linear`, adapter `TorchDenseNetAdapter` (`services/model_registry.py`).
5. `pip install -r requirements-ml.txt`, puis `PRESCAN_ALLOW_DUMMY_MODEL=false` en production.
6. Ensemble : copier `ensemble-v1.example.yaml` en `ensemble-v1.yaml`, ajouter la version dans `model_versions` et l'activer.

**Séparation entraînement/test.** Exportez les jeux de données en groupant par `patients.id` (ou `anonymous_code`) : toutes les images d'un patient vont dans le même sous-ensemble (`GroupShuffleSplit`), jamais réparties entre entraînement et test.

## Plan de déploiement

1. **Supabase** : créer le projet (région adaptée à votre cadre réglementaire), `supabase link`, `supabase db push`, vérifier que le bucket `ultrasounds` est privé. Créer le premier administrateur (voir README). Ingérer les documents RAG.
2. **API d'inférence (Render ou Railway)** : déployer le `Dockerfile` (`INSTALL_ML=true` avec vrais poids), variables `PRESCAN_*`, `PRESCAN_ALLOW_DUMMY_MODEL=false`, health check sur `/ready`. Prévoir des poids montés sur un disque persistant ou téléchargés au démarrage depuis un stockage privé.
3. **Edge Functions** : `supabase secrets set INFERENCE_API_URL=… INFERENCE_SERVICE_TOKEN=… ANTHROPIC_API_KEY=… ALLOWED_ORIGIN=https://…` puis `supabase functions deploy predict-exam rag-chat rag-ingest`.
4. **Frontend (Vercel)** : racine `web/`, variables `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Dans Supabase Auth, renseigner l'URL du site et activer la confirmation d'e-mail.
5. **Avant l'usage réel** : sauvegardes Postgres, rotation des secrets, limitation de débit sur les Edge Functions, revue juridique (protection des données de santé, statut de dispositif médical selon le pays) et validation clinique du modèle.

## Feuille de route (prochains commits)

- Historique médical par patient (chronologie, filtres, export PDF).
- Page d'administration : validation des comptes, versions de modèles, documents RAG, logs d'audit.
- Alertes et statistiques de répartition des prédictions.
- Tests e2e (Playwright) et tests RLS (pgTAP).
