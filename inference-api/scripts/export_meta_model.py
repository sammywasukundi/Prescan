"""Exporte le méta-modèle de stacking (LogisticRegression pickle) en JSON portable.

Usage (dans l'environnement où le pickle a été créé, scikit-learn installé) :
    python scripts/export_meta_model.py stacking_meta_model.pkl configs/stacking-v1.meta.json

Le JSON contient classes, coefficients et intercepts : l'API recalcule la prédiction en NumPy,
sans scikit-learn, et le script vérifie l'égalité avec `predict_proba` avant d'écrire.
"""
import json
import sys

import joblib
import numpy as np


def main(src: str, dst: str) -> None:
    model = joblib.load(src)
    if type(model).__name__ != "LogisticRegression":
        sys.exit(f"Type inattendu : {type(model).__name__} (LogisticRegression attendu).")
    coef, intercept, classes = model.coef_, model.intercept_, model.classes_

    rng = np.random.default_rng(0)
    x = rng.random((64, coef.shape[1]))
    logits = x @ coef.T + intercept
    logits -= logits.max(axis=1, keepdims=True)
    ours = np.exp(logits) / np.exp(logits).sum(axis=1, keepdims=True)
    if not np.allclose(ours, model.predict_proba(x), atol=1e-9):
        sys.exit("Le calcul NumPy ne reproduit pas predict_proba : export annulé.")

    with open(dst, "w", encoding="utf-8") as fh:
        json.dump(
            {"classes": [int(c) for c in classes], "coef": coef.tolist(), "intercept": intercept.tolist()},
            fh,
        )
    print(f"OK : {len(classes)} classes, {coef.shape[1]} entrées → {dst}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
