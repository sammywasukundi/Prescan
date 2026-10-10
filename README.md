**English** · [Français](README.fr.md)

# PreScan

A screening-aid platform for fetal brain abnormalities from prenatal ultrasound images, reserved for authenticated physicians. A physician uploads an image; PreScan has a model (DenseNet121, ensemble possible) classify it into 16 categories, shows the confidence and the probabilities, and lets the physician validate or correct the result.

> This result is a screening aid and must be confirmed by a healthcare professional.

**Current status: prototype.**

- The bundled model is a **dummy model**: its results are random and flagged as such in the interface (red banner).
- The 16 classes in the schema are **provisional**: replace them with your own (see `docs/ARCHITECTURE.md`, section "Plugging in the real model").

| Folder | Contents |
|---|---|
| `web/` | Next.js 15, React 19, Tailwind, Motion, Lottie, light/dark theme, French/English |
| `supabase/` | migrations (schema, RLS, pgvector), Edge Functions, seed RAG documents |
| `inference-api/` | FastAPI `POST /predict` API, configurable preprocessing, tests |
| `docs/` | architecture, endpoints, deployment |

---

## How it fits together

```text
Browser ──▶ web (Next.js, :3000) ──▶ Local Supabase (:54321)
                                        │  Auth · Database · Private storage
                                        ▼
                                Edge Functions ──▶ FastAPI API (:8000)
                                                   dummy or real model
```

The browser never talks to the inference API directly: everything goes through the Edge Functions, which check the session.

---

## Prerequisites

| Tool | Version | Check |
|---|---|---|
| [Git](https://git-scm.com/) | recent | `git --version` |
| [Node.js](https://nodejs.org/) | 20 or later (22 recommended) | `node --version` |
| [Python](https://www.python.org/) | 3.11 or later (tested on 3.12) | `python --version` (`py --version` on Windows) |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | running | `docker info` must not print an error |

The Supabase CLI does not need to be installed: every command below uses `npx supabase`.

> **Windows:** commands are given for **PowerShell**. The "macOS / Linux" blocks give the bash equivalents.

---

## Running locally

You will use **4 terminals** (in VS Code: Terminal → New Terminal, then the **+** button). Terminals B, C and D stay open as long as the app is running.

| Terminal | Role |
|---|---|
| A | one-off commands (Supabase, checks) |
| B | inference API (FastAPI) |
| C | Edge Functions |
| D | Frontend (Next.js) |

Go to the **project root** (the folder that contains `web/`, `supabase/` and `inference-api/`).

### Step 1 — Local Supabase *(terminal A)*

```bash
npx supabase start
npx supabase db reset
```

- `start` is slow the first time (Docker images are downloaded).
- `db reset` applies the migrations: tables, security (RLS), private buckets, 16 provisional classes.
- ⚠ `db reset` **erases all local data** (accounts, patients, analyses). Do not run it out of habit.

When `start` finishes, note:

- **Project URL**: `http://127.0.0.1:54321`
- **Publishable key**: `sb_publishable_…` (called "anon key" in older versions)
- **Studio**: http://127.0.0.1:54323 (database admin interface)
- **Mailpit**: http://127.0.0.1:54324 (fake mailbox: confirmation emails show up here)

To display these values again later: `npx supabase status`.

**Check:** in Studio → *Table Editor* you see `profiles`, `patients`, `ultrasound_exams`, `predictions`, `abnormality_classes` (16 rows)… and in *Storage*, the `ultrasounds` and `avatars` buckets.

> Never copy the **Secret** key (`sb_secret_…`) into a project file or a message.

### Step 2 — Inference API *(terminal B)*

**Windows (PowerShell)**

```powershell
cd inference-api
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt

# Generate the shared secret and save it to inference-api\.env (ignored by git)
$token = python -c "import secrets; print(secrets.token_hex(24))"
"PRESCAN_SERVICE_TOKEN=$token" | Out-File -Encoding ascii .env

pytest -q
uvicorn app.main:app --reload --port 8000 --host 0.0.0.0
```

If PowerShell refuses to activate the environment ("running scripts is disabled"), first type `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`. If `python` is not recognised, use `py`.

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

**Check:**

- `pytest -q` prints `22 passed`.
- http://127.0.0.1:8000/health returns `{"status":"ok"}`.
- http://127.0.0.1:8000/ready returns `"status":"ready"` with `"is_dummy":true` (dummy model active).

> `--host 0.0.0.0` lets the Docker containers (Edge Functions) reach the API. Development only: the API requires the service token anyway.

### Step 3 — Edge Functions *(terminal A, then C)*

In **terminal A**, from the project root, create the functions configuration file. It automatically reuses the token from step 2.

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

The closing `"@` line must start at the far left, with no space.

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

Then, in **terminal C**, start the functions:

```bash
npx supabase functions serve --env-file supabase/functions/.env
```

(On Windows, write `supabase\functions\.env`.)

- `ANTHROPIC_API_KEY` is only needed for the **Assistant** (currently shown as "under maintenance" in the interface, but the back end is ready). Open `supabase/functions/.env` in your editor to paste it after the `=`, then restart `functions serve`. Never share it.
- On Linux, if `host.docker.internal` does not resolve, use your machine's IP address on the Docker network (often `172.17.0.1`).

**Check** (terminal A):

```bash
curl -i -X POST http://127.0.0.1:54321/functions/v1/predict-exam -H "Content-Type: application/json" -d "{}"
```

(In PowerShell: `curl.exe` instead of `curl`.) The expected response is **401 Unauthorized**: the function is reachable and rejects unauthenticated calls.

### Step 4 — Frontend *(terminal D)*

**Windows (PowerShell)**

```powershell
cd web
@"
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=PASTE_THE_PUBLISHABLE_KEY_HERE
"@ | Out-File -Encoding ascii .env.local
```

**macOS / Linux (bash)**

```bash
cd web
cp .env.local.example .env.local
```

Then edit `web/.env.local`: the URL must be `http://127.0.0.1:54321` and the key must be the **Publishable** value from step 1. No `<` `>`, no quotes, no spaces around the `=`.

```bash
npm install
npm run dev
```

Open http://localhost:3000. The **FR/EN** button switches the language and the moon/sun button switches between light and dark mode; both choices are remembered.

> The variables in `.env.local` are only read at startup: after any change, stop (`Ctrl+C`) and restart `npm run dev`.

---

## Accounts: administrator and physicians

PreScan has two roles:

| Role | Can | Cannot |
|---|---|---|
| **Physician** (`doctor`) | create patients, analyse images, validate results, review past analyses, export a result for a colleague | see another physician's patients |
| **Administrator** (`admin`) | approve accounts, manage models, index assistant documents, read the audit log | **access patients, images and results** (deliberate: least privilege) |

Consequences:

- Every account created through the form is an **unapproved physician**: it sees "Account awaiting validation" until an administrator approves it.
- The `admin` role can **never** be chosen from the interface or at sign-up: it is only granted in the database, by someone with database access.
- An administrator cannot test analyses: plan for **two accounts** (one administrator, one physician) with two different email addresses.
- Every user (physician or administrator) has a **My profile** page (menu on the top right) to edit personal information and change the profile photo, stored in a private Supabase Storage bucket.

### Creating the first administrator

1. In the app, open **Request access** and create an account with the administrator's email (password of at least 10 characters).
2. If an email confirmation is requested, open Mailpit (http://127.0.0.1:54324) and click the link.
3. In Studio (http://127.0.0.1:54323) → **SQL Editor**, run the following, replacing the email:

```sql
update public.profiles
set role = 'admin', approved = true
where id = (select id from auth.users where email = 'admin@example.org');
```

4. Sign out, then sign in again with that account.

### Approving a physician

Each physician signs up on their own through **Request access**. Then sign in with the **administrator** account: you land on the **Administration** page.

1. **Accounts** tab: requests appear under "Awaiting validation".
2. Click **Approve**. The physician can now sign in and use PreScan.
3. **Remove access** suspends a physician at any time; their account and data remain in the database.

Administrators are redirected to `/admin`, physicians to `/dashboard`. Every approval or removal is recorded in the **Audit log** tab.

The Administration page has four tabs:

| Tab | Function |
|---|---|
| Accounts | approve / remove physicians' access |
| Models | register a version, **activate** the one used for new analyses |
| Assistant documents | index (`.md` / `.txt` file or pasted text), enable, disable, delete |
| Audit log | last 200 events, filterable, read-only |

*SQL fallback* (Studio → SQL Editor), if the page is not reachable:

```sql
select p.id, p.email, p.full_name, p.hospital from public.profiles p where not p.approved;

update public.profiles set approved = true
where id = (select id from auth.users where email = 'doctor@example.org');
```

---

## Trying an analysis

1. Sign in with the **approved physician** account.
2. **Patients** → create a patient. A `PS-XXXXXXXX` code is generated; do not enter any identifying data (name, date of birth, file number).
3. **New analysis** → choose the patient, drop a PNG or JPEG image (64 px minimum per side, 10 MB maximum), then **Analyse image**.
4. You get the main class, the confidence, the three alternatives and the 16 probabilities, with a **red "Dummy model" banner** (normal until the real weights are installed).
5. **Confirm** or **Correct**: the decision is recorded with the date and the physician. Check in Studio → *Table Editor* → `predictions`.

### Reviewing past analyses and second opinions

- **Analyses** (menu) lists all your analyses. **Click any row** to open the full result: image, main class, alternatives, the 16 probabilities and the validation panel.
- On an analysis page, **Share for a second opinion** exports a *pseudonymised* case file (`.json`, with the image embedded) or a printable/PDF version. No patient identity is included, and each export is written to the audit log.
- A colleague opens **Analyses → Import a file** to examine the case read-only, records whether they agree or disagree (and optionally a proposed class and a comment), and exports the file back with their opinion added.

---

## Feeding the assistant (RAG chat)

The assistant only answers from documents indexed by an administrator, and shows its sources. In the interface it is the floating **Assistant** button at the bottom right; it currently opens a "under maintenance" notice while the feature is being finalised, but the Edge Functions (`rag-ingest`, `rag-chat`) are fully functional. Prerequisites for using the back end: `ANTHROPIC_API_KEY` set (step 3) and an **administrator** account.

**Simple method (interface).** Administrator account → **Administration** → **Assistant documents** tab → choose `supabase/seed/rag/01-fonctionnement-prescan.md` (then `02-limites-du-modele.md`) → **Index document**.

**Command-line alternative:**

**Windows (PowerShell)** — from the project root:

```powershell
$url  = "http://127.0.0.1:54321"
$anon = "PASTE_THE_PUBLISHABLE_KEY_HERE"

# 1. Get the administrator's token
$login = Invoke-RestMethod -Method Post -Uri "$url/auth/v1/token?grant_type=password" `
  -Headers @{ apikey = $anon } -ContentType "application/json" `
  -Body (@{ email = "admin@example.org"; password = "YOUR_PASSWORD" } | ConvertTo-Json)
$jwt = $login.access_token

# 2. Index a document
$content = Get-Content supabase\seed\rag\01-fonctionnement-prescan.md -Raw -Encoding UTF8
$json = @{ title = "How PreScan works"; content = $content } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "$url/functions/v1/rag-ingest" `
  -Headers @{ Authorization = "Bearer $jwt"; apikey = $anon } `
  -ContentType "application/json; charset=utf-8" `
  -Body ([System.Text.Encoding]::UTF8.GetBytes($json))
```

Repeat step 2 with `02-limites-du-modele.md`. The response contains `document_id` and the number of passages (`chunks`).

**macOS / Linux (bash, with `jq` and `curl`)**

```bash
URL=http://127.0.0.1:54321
ANON=PASTE_THE_PUBLISHABLE_KEY_HERE

JWT=$(curl -s -X POST "$URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON" -H "Content-Type: application/json" \
  -d '{"email":"admin@example.org","password":"YOUR_PASSWORD"}' | jq -r .access_token)

for f in supabase/seed/rag/*.md; do
  curl -s -X POST "$URL/functions/v1/rag-ingest" \
    -H "Authorization: Bearer $JWT" -H "apikey: $ANON" -H "Content-Type: application/json" \
    -d "$(jq -n --arg t "$(basename "$f" .md)" --rawfile c "$f" '{title:$t, content:$c}')"
done
```

> The assistant refuses to give any diagnosis and does not interpret any image.

---

## Updating after a `git pull`

```bash
cd web && npm install                       # possible new dependencies
cd ../inference-api && pip install -r requirements-dev.txt
cd .. && npx supabase migration up          # applies the NEW migrations without erasing data
```

Then restart terminals B, C and D. Do not use `db reset` for this: it erases local data.

---

## Stopping and resetting

| Action | Command |
|---|---|
| Stop the API, functions, frontend | `Ctrl+C` in terminals B, C and D |
| Stop Supabase (keeping data) | `npx supabase stop` |
| Reset everything (erases local data) | `npx supabase db reset` |

At the next start, simply run: `npx supabase start`, then terminals B (activate `.venv` first), C and D. The `.env` files are kept.

---

## Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| `supabase start` fails / "Cannot connect to the Docker daemon" | Docker Desktop is not running. Start it, wait until it is ready (`docker info`), then retry. |
| Warning "Analytics on Windows requires Docker daemon exposed…" | Harmless: the Analytics feature is not used. |
| `python` not found | On Windows try `py`; otherwise install Python and tick "Add to PATH". |
| PowerShell: "running scripts is disabled" | `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`, then run the activation again. |
| `copy : Cannot find path '…\.env.local.example'` | You are not in `web/`. Run `cd web` (the prompt should end with `\web>`). |
| `Invalid supabaseUrl: Provided URL is malformed` | `web/.env.local` is missing, still contains the example, or was not re-read. Check it contains `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`, then restart `npm run dev`. |
| "Only approved physician accounts can create patients" | You are signed in with an **administrator** account (no access to patients, by design). Use a second account approved as a physician. |
| After sign-in: "Account awaiting validation" | The account is not approved. See "Approving a physician". |
| Upload error / "exam not created" | Account not approved, or signed in with a different account than the approved one. |
| Analysis: "model unavailable" | (1) is the API (terminal B) running with `--host 0.0.0.0`? (2) is the token in `supabase/functions/.env` identical to the one in `inference-api/.env`? If you change one, restart the API **and** `functions serve`. |
| Edge Function: "Invalid JWT" before even reaching the code | In `supabase/config.toml`, set `verify_jwt` to `false` for the three functions (the code checks the session itself), then restart `functions serve`. |
| Profile photo upload fails | The `avatars` bucket comes from the latest migration: run `npx supabase migration up`. |
| Assistant: "temporarily unavailable" | `ANTHROPIC_API_KEY` empty or invalid in `supabase/functions/.env`. |
| Assistant: "no relevant information" | No document is indexed: see "Feeding the assistant". |
| Port already in use (8000, 3000) | Change the port (`--port 8001`, `npm run dev -- -p 3001`) and adapt `INFERENCE_API_URL` if needed. |

---

## Plugging in the real model

1. Put the weights in `inference-api/app/models/densenet121_v1.pt` (they are never versioned in git).
2. In `inference-api/configs/densenet121-v1.yaml`, replace `class_names` with your 16 classes **in the exact training order**, and copy the preprocessing used at training time (size, colour, mean, standard deviation).
3. Update the 16 rows of `abnormality_classes` (migration `…_schema.sql`, then `npx supabase db reset`) with the same `class_key` values.
4. `pip install -r requirements-ml.txt`, then set `PRESCAN_ALLOW_DUMMY_MODEL=false` in `inference-api/.env`.

Details and the "ensemble" variant: `docs/ARCHITECTURE.md`.

---

## Security at a glance

RLS on every table · private image bucket · no secret in the browser · service token between Edge Function and FastAPI · immutable model results · audit log (including exports) · pseudonymised patients (generated code, no original file name kept, no identity in exported case files) · the chat refuses any diagnosis.

The `.env`, `.env.local` and `supabase/functions/.env` files are ignored by git: never commit them.

PreScan is **not** a diagnostic device. Before any clinical use: model validation, regulatory compliance and health-data protection according to your country.

## Documentation

- `docs/ARCHITECTURE.md`: architecture, flows, endpoints, error handling, deployment plan (Vercel, Supabase, Render/Railway) and roadmap.
