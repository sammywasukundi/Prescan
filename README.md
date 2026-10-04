# PreScan

Plateforme d'aide au dépistage des anomalies cérébrales fœtales à partir d'images d'échographie prénatale, réservée à des médecins authentifiés. Un médecin téléverse une image ; PreScan la fait classer par un modèle (DenseNet121, ensemble possible) parmi 16 catégories, affiche la confiance et les probabilités, et laisse le médecin valider ou corriger.

> Ce résultat est une aide au dépistage et doit être confirmé par un professionnel de santé.

**État actuel : prototype.** Le modèle fourni est un **modèle factice** (résultats aléatoires, signalés comme tels dans l'interface). Les 16 classes du schéma sont **provisoires** : à remplacer par les vôtres (voir `docs/ARCHITECTURE.md`, « Intégrer le vrai modèle »).

| Dossier | Contenu |
|---|---|
| `web/` | Next.js 15, React 19, Tailwind, Motion, thème clair/sombre |
| `supabase/` | migrations (schéma, RLS, pgvector), Edge Functions, documents RAG d'amorçage |
| `inference-api/` | API FastAPI `POST /predict`, prétraitement configurable, tests |
| `docs/` | architecture, endpoints, déploiement |

## Démarrage local

Prérequis : Node 22, Python 3.12, [Supabase CLI](https://supabase.com/docs/guides/cli), Docker.

```bash
# 1. Supabase local (applique les migrations)
supabase start
supabase db reset

# 2. API d'inférence (modèle factice)
cd inference-api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
export PRESCAN_SERVICE_TOKEN="$(openssl rand -hex 24)"      # à réutiliser à l'étape 3
uvicorn app.main:app --reload --port 8000
pytest -q                                                   # 22 tests

# 3. Edge Functions
cat > supabase/functions/.env <<EOF2
INFERENCE_API_URL=http://host.docker.internal:8000
INFERENCE_SERVICE_TOKEN=$PRESCAN_SERVICE_TOKEN
ANTHROPIC_API_KEY=<votre clé>
EOF2
supabase functions serve --env-file supabase/functions/.env

# 4. Frontend
cd web
cp .env.local.example .env.local      # URL et clé anon affichées par `supabase status`
npm install && npm run dev            # http://localhost:3000
```

### Créer le premier administrateur

Inscrivez-vous via l'interface, puis dans le SQL Editor :

```sql
update public.profiles set role = 'admin', approved = true where id = (select id from auth.users where email = 'vous@exemple.org');
```

Pour valider un médecin : `update public.profiles set approved = true where id = '<uuid>';` (la page d'administration est prévue dans la feuille de route).

### Alimenter le chat RAG

Avec le compte administrateur (JWT) :

```bash
curl -X POST "$SUPABASE_URL/functions/v1/rag-ingest" \
  -H "Authorization: Bearer $ADMIN_JWT" -H "Content-Type: application/json" \
  -d "$(jq -n --arg c "$(cat supabase/seed/rag/01-fonctionnement-prescan.md)" '{title:"Fonctionnement de PreScan", content:$c}')"
```

## Sécurité en bref

RLS sur toutes les tables · bucket d'images privé · aucun secret côté navigateur · jeton de service entre Edge Function et FastAPI · résultats du modèle immuables · journal d'audit · patients pseudonymisés (code généré, aucun nom de fichier conservé) · le chat refuse tout diagnostic.

PreScan n'est **pas** un dispositif de diagnostic. Avant tout usage clinique : validation du modèle, conformité réglementaire et protection des données de santé selon votre pays.
