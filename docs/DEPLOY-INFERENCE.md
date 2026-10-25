# Déployer l'API d'inférence (ensemble Keras) sur Hugging Face Spaces

Pourquoi pas Render gratuit : l'ensemble pèse ~220 Mo de poids (VGG16 : 169 Mo) et TensorFlow consomme déjà ~400 Mo de RAM, pour 512 Mo disponibles. Un Space « CPU basic » gratuit offre 2 vCPU et 16 Go de RAM.

Compromis à connaître : un Space gratuit **se met en veille après un moment sans visite** (la première analyse suivante attend le redémarrage et le chargement des 3 réseaux, quelques dizaines de secondes), et les fichiers d'un Space public sont publics (les poids, pas les données patients).

## 1. Tester en local (recommandé)

```powershell
cd inference-api
# copier les 3 poids dans app\models\ : mobilenetv2_best.keras, vgg16_best.h5, densenet121_best.h5
python -m venv .venv ; .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt -r requirements-ml.txt
$env:PRESCAN_SERVICE_TOKEN = "un-secret-d-au-moins-16-caracteres"
$env:PRESCAN_ALLOW_DUMMY_MODEL = "false"
uvicorn app.main:app --port 8000
```

Dans un second terminal, `curl http://localhost:8000/ready` doit répondre `"is_dummy": false`. Si le chargement d'un `.h5` échoue, installez dans `requirements-ml.txt` la version de TensorFlow utilisée à l'entraînement (`tf.__version__` dans Colab).

**Vérification indispensable avant la mise en production** : envoyez à `/predict` une dizaine d'images du dossier `test` dont vous connaissez la classe et comparez avec les résultats de `app.py`. Les prédictions doivent être identiques.

## 2. Créer le Space

1. Compte sur huggingface.co → **New Space** → nom `prescan-inference`, SDK **Docker** (modèle « Blank »), CPU basic, visibilité Public.
2. Créez un jeton d'accès (Settings → Access Tokens, droit **Write**) : il sert de mot de passe pour `git push`.
3. Dans le Space → Settings → **Variables and secrets** → New secret : `PRESCAN_SERVICE_TOKEN` = le même secret que `INFERENCE_SERVICE_TOKEN` côté Supabase (32+ caractères aléatoires).

## 3. Pousser le code et les poids

Installez [Git LFS](https://git-lfs.com) une fois, puis :

```powershell
git lfs install
git clone https://huggingface.co/spaces/<votre-compte>/prescan-inference
cd prescan-inference

# depuis le dépôt NeuroScan
$src = "D:\web\prescan\inference-api"
Copy-Item $src\app, $src\configs -Destination . -Recurse
Copy-Item $src\requirements.txt, $src\requirements-ml.txt -Destination .
Copy-Item $src\Dockerfile.space -Destination .\Dockerfile
Copy-Item $src\space\README.md -Destination .\README.md
Copy-Item $src\space\gitattributes.txt -Destination .\.gitattributes -Force

# les 3 poids (dans app\models\)
Copy-Item D:\masters\hackathon\Asetailion\mobilenetv2_best.keras, D:\masters\hackathon\Asetailion\vgg16_best.h5, D:\masters\hackathon\Asetailion\densenet121_best.h5 -Destination .\app\models\

git add -A
git commit -m "NeuroScan inference API"
git push
```

Le build démarre automatiquement (quelques minutes). Quand le Space est « Running », `https://<votre-compte>-prescan-inference.hf.space/health` répond `{"status":"ok"}`.

## 4. Brancher Supabase

```powershell
npx supabase secrets set INFERENCE_API_URL=https://<votre-compte>-prescan-inference.hf.space INFERENCE_SERVICE_TOKEN=<le-même-secret> INFERENCE_TIMEOUT_MS=90000
npx supabase db push        # applique 20261018000007_real_model.sql (16 vraies classes, stacking-v1 actif)
```

Le délai de 90 s couvre le réveil du Space. Lancez ensuite une analyse depuis l'application : le bandeau « modèle factice » ne doit plus apparaître.

## Dépannage

| Symptôme | Cause probable |
|---|---|
| « Modèle indisponible » à la première analyse | le Space dort ou charge les réseaux : réessayez après une minute |
| `401 unauthorized` | `PRESCAN_SERVICE_TOKEN` (Space) ≠ `INFERENCE_SERVICE_TOKEN` (Supabase) |
| Build qui échoue sur TensorFlow | alignez `requirements-ml.txt` sur une version disponible pour Python 3.12 |
| Poids refusés au `git push` | Git LFS non installé : `git lfs install` puis recommitez les fichiers |
