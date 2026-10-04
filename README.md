# PreScan

Plateforme d'aide au dépistage des anomalies cérébrales fœtales à partir d'images d'échographie prénatale, réservée à des médecins authentifiés. Un médecin téléverse une image ; PreScan la fait classer par un modèle (DenseNet121, ensemble possible) parmi 16 catégories, affiche la confiance et les probabilités, et laisse le médecin valider ou corriger.

> Ce résultat est une aide au dépistage et doit être confirmé par un professionnel de santé.

**État actuel : prototype.**

- Le modèle fourni est un **modèle factice** : ses résultats sont aléatoires et signalés comme tels dans l'interface (bandeau rouge).
- Les 16 classes du schéma sont **provisoires** : remplacez-les par les vôtres (voir `docs/ARCHITECTURE.md`, section « Intégrer le vrai modèle »).

| Dossier | Contenu |
|---|---|
| `web/` | Next.js 15, React 19, Tailwind, Motion, thème clair/sombre |
| `supabase/` | migrations (schéma, RLS, pgvector), Edge Functions, documents RAG d'amorçage |
| `inference-api/` | API FastAPI `POST /predict`, prétraitement configurable, tests |
| `docs/` | architecture, endpoints, déploiement |

---

## Comment ça s'articule

```text
Navigateur ──▶ web (Next.js, :3000) ──▶ Supabase local (:54321)
                                           │  Auth · Base · Stockage privé
                                           ▼
                                   Edge Functions ──▶ API FastAPI (:8000)
                                                      modèle factice ou réel
```

Le navigateur ne parle jamais directement à l'API d'inférence : tout passe par les Edge Functions, qui vérifient la session.

---

## Prérequis

| Outil | Version | Vérification |
|---|---|---|
| [Git](https://git-scm.com/) | récente | `git --version` |
| [Node.js](https://nodejs.org/) | 20 ou plus (22 recommandé) | `node --version` |
| [Python](https://www.python.org/) | 3.11 ou plus (testé en 3.12) | `python --version` (`py --version` sous Windows) |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | démarré | `docker info` ne doit pas afficher d'erreur |

La CLI Supabase n'a pas besoin d'être installée : toutes les commandes ci-dessous utilisent `npx supabase`.

> **Windows :** les commandes sont données pour **PowerShell**. Les blocs « macOS / Linux » donnent les équivalents bash.

---

## Démarrage local

Vous allez utiliser **4 terminaux** (dans VS Code : Terminal → New Terminal, puis le bouton **+**). Les terminaux B, C et D restent ouverts tant que l'application tourne.

| Terminal | Rôle |
|---|---|
| A | commandes ponctuelles (Supabase, vérifications) |
| B | API d'inférence (FastAPI) |
| C | Edge Functions |
| D | Frontend (Next.js) |

Placez-vous à la **racine du projet** (le dossier qui contient `web/`, `supabase/` et `inference-api/`).

### Étape 1 — Supabase local *(terminal A)*

```bash
npx supabase start
npx supabase db reset
```

- `start` est long la première fois (téléchargement des images Docker).
- `db reset` applique les migrations : tables, sécurité (RLS), bucket privé, 16 classes provisoires.
- ⚠ `db reset` **efface toutes les données locales** (comptes, patients, analyses). Ne le relancez pas par réflexe.

À la fin de `start`, notez :

- **Project URL** : `http://127.0.0.1:54321`
- **Publishable key** : `sb_publishable_…` (appelée « anon key » dans les anciennes versions)
- **Studio** : http://127.0.0.1:54323 (interface d'administration de la base)
- **Mailpit** : http://127.0.0.1:54324 (boîte mail factice : les e-mails de confirmation s'y affichent)

Pour réafficher ces valeurs plus tard : `npx supabase status`.

**Vérification :** dans Studio → *Table Editor*, vous voyez `profiles`, `patients`, `ultrasound_exams`, `predictions`, `abnormality_classes` (16 lignes)… et dans *Storage*, le bucket `ultrasounds`.

> Ne copiez jamais la clé **Secret** (`sb_secret_…`) dans un fichier du projet ni dans un message.

### Étape 2 — API d'inférence *(terminal B)*

**Windows (PowerShell)**

```powershell
cd inference-api
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt

# Génère le secret partagé et l'enregistre dans inference-api\.env (ignoré par git)
$token = python -c "import secrets; print(secrets.token_hex(24))"
"PRESCAN_SERVICE_TOKEN=$token" | Out-File -Encoding ascii .env

pytest -q
uvicorn app.main:app --reload --port 8000 --host 0.0.0.0
```

Si PowerShell refuse d'activer l'environnement (« l'exécution de scripts est désactivée »), tapez d'abord `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`. Si `python` n'est pas reconnu, utilisez `py`.

**macOS / Linux (bash)**

```bash
cd inference-api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt

echo "PRESCAN_SERVICE_TOKEN=$(python -c 'import secrets; print(secrets.token_hex(24))')" > .env

pytest -q
uvicorn app.main:app --reload --port 8000 --host 0.0.0.0
```

**Vérification :**

- `pytest -q` affiche `22 passed`.
- http://127.0.0.1:8000/health renvoie `{"status":"ok"}`.
- http://127.0.0.1:8000/ready renvoie `"status":"ready"` avec `"is_dummy":true` (modèle factice actif).

> `--host 0.0.0.0` permet aux conteneurs Docker (Edge Functions) d'atteindre l'API. Réservé au développement : l'API exige de toute façon le jeton de service.

### Étape 3 — Edge Functions *(terminal A, puis C)*

Dans le **terminal A**, à la racine du projet, créez le fichier de configuration des fonctions. Il reprend automatiquement le jeton de l'étape 2.

**Windows (PowerShell)**

```powershell
$token = (Get-Content inference-api\.env | Select-String 'PRESCAN_SERVICE_TOKEN=').ToString().Split('=')[1]
@"
INFERENCE_API_URL=http://host.docker.internal:8000
INFERENCE_SERVICE_TOKEN=$token
ANTHROPIC_API_KEY=
RAG_LLM_MODEL=claude-sonnet-5-5
"@ | Out-File -Encoding ascii supabase\functions\.env
```

La ligne `"@` de fin doit commencer tout à gauche, sans espace.

**macOS / Linux (bash)**

```bash
TOKEN=$(grep PRESCAN_SERVICE_TOKEN inference-api/.env | cut -d= -f2)
cat > supabase/functions/.env <<ENVFILE
INFERENCE_API_URL=http://host.docker.internal:8000
INFERENCE_SERVICE_TOKEN=$TOKEN
ANTHROPIC_API_KEY=
RAG_LLM_MODEL=claude-sonnet-5-5
ENVFILE
```

Puis, dans le **terminal C**, démarrez les fonctions :

```bash
npx supabase functions serve --env-file supabase/functions/.env
```

(Sous Windows, écrivez `supabase\functions\.env`.)

- `ANTHROPIC_API_KEY` n'est nécessaire que pour la page **Assistant**. Ouvrez `supabase/functions/.env` dans votre éditeur pour la coller après le `=`, puis relancez `functions serve`. Ne la partagez jamais.
- Sous Linux, si `host.docker.internal` n'est pas résolu, utilisez l'adresse IP de votre machine sur le réseau Docker (souvent `172.17.0.1`).

**Vérification** (terminal A) :

```bash
curl -i -X POST http://127.0.0.1:54321/functions/v1/predict-exam -H "Content-Type: application/json" -d "{}"
```

(Sous PowerShell : `curl.exe` au lieu de `curl`.) La réponse attendue est **401 Unauthorized** : la fonction est joignable et refuse les appels non authentifiés.

### Étape 4 — Frontend *(terminal D)*

**Windows (PowerShell)**

```powershell
cd web
@"
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=COLLEZ_ICI_LA_CLE_PUBLISHABLE
"@ | Out-File -Encoding ascii .env.local
```

**macOS / Linux (bash)**

```bash
cd web
cp .env.local.example .env.local
```

Puis éditez `web/.env.local` : l'URL doit être `http://127.0.0.1:54321` et la clé, la valeur **Publishable** de l'étape 1. Pas de `<` `>`, pas de guillemets, pas d'espace autour du `=`.

```bash
npm install
npm run dev
```

Ouvrez http://localhost:3000. Le bouton lune/soleil bascule entre mode clair et mode sombre.

> Les variables de `.env.local` ne sont lues qu'au démarrage : après toute modification, arrêtez (`Ctrl+C`) et relancez `npm run dev`.

---

## Comptes : administrateur et médecins

PreScan distingue deux rôles :

| Rôle | Peut faire | Ne peut pas |
|---|---|---|
| **Médecin** (`doctor`) | créer des patients, analyser des images, valider les résultats, utiliser l'assistant | voir les patients d'un autre médecin |
| **Administrateur** (`admin`) | valider les comptes, gérer les modèles, indexer les documents de l'assistant, lire le journal d'audit | **accéder aux patients, images et résultats** (volontaire : moindre privilège) |

Conséquences :

- Tout compte créé via le formulaire est un **médecin non approuvé** : il voit « Compte en attente de validation » tant qu'un administrateur ne l'a pas approuvé.
- Le rôle `admin` ne peut **jamais** être choisi depuis l'interface ni via l'inscription : il s'attribue uniquement en base de données, par quelqu'un qui a accès à la base.
- Un administrateur ne peut pas tester les analyses : prévoyez **deux comptes** (un administrateur, un médecin), avec deux adresses e-mail différentes.

### Créer le premier administrateur

1. Dans l'application, ouvrez **Demander un accès** et créez un compte avec l'e-mail de l'administrateur (mot de passe de 10 caractères minimum).
2. Si un message de confirmation est demandé, ouvrez Mailpit (http://127.0.0.1:54324) et cliquez sur le lien.
3. Dans Studio (http://127.0.0.1:54323) → **SQL Editor**, exécutez en remplaçant l'e-mail :

```sql
update public.profiles
set role = 'admin', approved = true
where id = (select id from auth.users where email = 'admin@exemple.org');
```

4. Déconnectez-vous puis reconnectez-vous avec ce compte.

### Valider un médecin

Chaque médecin s'inscrit lui-même via **Demander un accès**. Pour voir les demandes en attente, exécutez dans le SQL Editor :

```sql
select p.id, u.email, p.full_name, p.hospital, p.specialty, p.created_at
from public.profiles p
join auth.users u on u.id = p.id
where not p.approved
order by p.created_at;
```

Puis approuvez (par e-mail) :

```sql
update public.profiles
set approved = true
where id = (select id from auth.users where email = 'docteur@exemple.org');
```

Pour retirer l'accès à un médecin : même requête avec `approved = false`.

> Une page d'administration (validation des comptes, modèles, documents, logs) est prévue dans la feuille de route : elle remplacera ces requêtes SQL.

---

## Tester une analyse

1. Connectez-vous avec le compte **médecin approuvé**.
2. **Patients** → créez un patient. Un code `PS-XXXXXXXX` est généré ; ne saisissez aucune donnée identifiante (nom, date de naissance, n° de dossier).
3. **Nouvelle analyse** → choisissez le patient, déposez une image PNG ou JPEG (64 px minimum par côté, 10 Mo maximum), puis **Analyser l'image**.
4. Vous obtenez la classe principale, la confiance, les trois alternatives et les 16 probabilités, avec un **bandeau rouge « Modèle factice »** (normal tant que les vrais poids ne sont pas installés).
5. **Confirmer** ou **Corriger** : la décision est enregistrée avec la date et le médecin. Vérifiez dans Studio → *Table Editor* → `predictions`.

---

## Alimenter l'assistant (chat RAG)

L'assistant répond uniquement à partir de documents indexés par un administrateur, et affiche ses sources. Prérequis : la clé `ANTHROPIC_API_KEY` renseignée (étape 3) et un compte **administrateur**.

**Windows (PowerShell)** — à la racine du projet :

```powershell
$url  = "http://127.0.0.1:54321"
$anon = "COLLEZ_ICI_LA_CLE_PUBLISHABLE"

# 1. Obtenir le jeton de l'administrateur
$login = Invoke-RestMethod -Method Post -Uri "$url/auth/v1/token?grant_type=password" `
  -Headers @{ apikey = $anon } -ContentType "application/json" `
  -Body (@{ email = "admin@exemple.org"; password = "VOTRE_MOT_DE_PASSE" } | ConvertTo-Json)
$jwt = $login.access_token

# 2. Indexer un document
$content = Get-Content supabase\seed\rag\01-fonctionnement-prescan.md -Raw -Encoding UTF8
$json = @{ title = "Fonctionnement de PreScan"; content = $content } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$url/functions/v1/rag-ingest" `
  -Headers @{ Authorization = "Bearer $jwt"; apikey = $anon } `
  -ContentType "application/json; charset=utf-8" `
  -Body ([System.Text.Encoding]::UTF8.GetBytes($json))
```

Répétez l'étape 2 avec `02-limites-du-modele.md`. La réponse contient `document_id` et le nombre de passages (`chunks`).

**macOS / Linux (bash, avec `jq` et `curl`)**

```bash
URL=http://127.0.0.1:54321
ANON=COLLEZ_ICI_LA_CLE_PUBLISHABLE

JWT=$(curl -s -X POST "$URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"email":"admin@exemple.org","password":"VOTRE_MOT_DE_PASSE"}' | jq -r .access_token)

for f in supabase/seed/rag/*.md; do
  curl -s -X POST "$URL/functions/v1/rag-ingest" \
    -H "Authorization: Bearer $JWT" -H "apikey: $ANON" -H "Content-Type: application/json" \
    -d "$(jq -n --arg t "$(basename "$f" .md)" --rawfile c "$f" '{title:$t, content:$c}')"
done
```

Ouvrez ensuite la page **Assistant** (compte médecin) et posez par exemple : « Quelles sont les limites du modèle ? ». La réponse s'affiche en continu, avec des citations `[1]` `[2]` cliquables et la liste des sources.

> L'assistant refuse tout diagnostic et n'interprète aucune image.

---

## Arrêter et réinitialiser

| Action | Commande |
|---|---|
| Arrêter l'API, les fonctions, le frontend | `Ctrl+C` dans les terminaux B, C et D |
| Arrêter Supabase (en gardant les données) | `npx supabase stop` |
| Tout remettre à zéro (efface les données locales) | `npx supabase db reset` |

Au redémarrage suivant, relancez simplement : `npx supabase start`, puis les terminaux B (activez d'abord `.venv`), C et D. Les fichiers `.env` sont conservés.

---

## Dépannage

| Symptôme | Cause probable et solution |
|---|---|
| `supabase start` échoue / « Cannot connect to the Docker daemon » | Docker Desktop n'est pas démarré. Lancez-le, attendez qu'il soit prêt (`docker info`), puis relancez. |
| Avertissement « Analytics on Windows requires Docker daemon exposed… » | Sans importance : la fonction Analytics n'est pas utilisée. |
| `python` introuvable | Sous Windows essayez `py` ; sinon installez Python et cochez « Add to PATH ». |
| PowerShell : « l'exécution de scripts est désactivée » | `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`, puis relancez l'activation. |
| `copy : Cannot find path '…\.env.local.example'` | Vous n'êtes pas dans `web/`. Faites `cd web` (le prompt doit se terminer par `\web>`). |
| `Invalid supabaseUrl: Provided URL is malformed` | `web/.env.local` est absent, contient encore l'exemple, ou n'a pas été relu. Vérifiez qu'il contient `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`, puis relancez `npm run dev`. |
| Après connexion : « Compte en attente de validation » | Le compte n'est pas approuvé. Voir « Valider un médecin ». |
| Erreur de téléversement / « examen non créé » | Compte non approuvé, ou connecté avec un autre compte que celui approuvé. |
| Analyse : « modèle indisponible » | (1) l'API (terminal B) tourne-t-elle avec `--host 0.0.0.0` ? (2) le jeton de `supabase/functions/.env` est-il identique à celui de `inference-api/.env` ? Si vous modifiez l'un, relancez l'API **et** `functions serve`. |
| Edge Function : « Invalid JWT » avant même d'atteindre le code | Dans `supabase/config.toml`, passez `verify_jwt` à `false` pour les trois fonctions (le code vérifie lui-même la session), puis relancez `functions serve`. |
| Assistant : « momentanément indisponible » | `ANTHROPIC_API_KEY` vide ou invalide dans `supabase/functions/.env`. |
| Assistant : « aucune information pertinente » | Aucun document n'est indexé : voir « Alimenter l'assistant ». |
| Port déjà utilisé (8000, 3000) | Changez le port (`--port 8001`, `npm run dev -- -p 3001`) et adaptez `INFERENCE_API_URL` si besoin. |

---

## Brancher le vrai modèle

1. Déposez les poids dans `inference-api/app/models/densenet121_v1.pt` (ils ne sont jamais versionnés dans git).
2. Dans `inference-api/configs/densenet121-v1.yaml`, remplacez `class_names` par vos 16 classes **dans l'ordre exact de l'entraînement**, et reportez le prétraitement utilisé à l'entraînement (taille, couleur, moyenne, écart-type).
3. Mettez à jour les 16 lignes de `abnormality_classes` (migration `…_schema.sql`, puis `npx supabase db reset`) avec les mêmes `class_key`.
4. `pip install -r requirements-ml.txt`, puis `PRESCAN_ALLOW_DUMMY_MODEL=false` dans `inference-api/.env`.

Détails et variante « ensemble » : `docs/ARCHITECTURE.md`.

---

## Sécurité en bref

RLS sur toutes les tables · bucket d'images privé · aucun secret côté navigateur · jeton de service entre Edge Function et FastAPI · résultats du modèle immuables · journal d'audit · patients pseudonymisés (code généré, aucun nom de fichier conservé) · le chat refuse tout diagnostic.

Les fichiers `.env`, `.env.local` et `supabase/functions/.env` sont ignorés par git : ne les commitez jamais.

PreScan n'est **pas** un dispositif de diagnostic. Avant tout usage clinique : validation du modèle, conformité réglementaire et protection des données de santé selon votre pays.

## Documentation

- `docs/ARCHITECTURE.md` : architecture, flux, endpoints, gestion des erreurs, plan de déploiement (Vercel, Supabase, Render/Railway) et feuille de route.