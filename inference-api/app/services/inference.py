import logging
import time

import numpy as np

from ..errors import ModelUnavailable
from .model_registry import ModelRegistry
from .preprocessing import preprocess_image

logger = logging.getLogger(__name__)


def run_inference(raw: bytes, model_version: str, registry: ModelRegistry, max_bytes: int) -> dict:
    """Prétraite l'image, interroge le modèle et renvoie un dictionnaire prêt à sérialiser."""
    started = time.perf_counter()

    loaded = registry.get(model_version)
    cfg = loaded.config

    tensor = preprocess_image(raw, cfg.preprocessing, max_bytes)
    try:
        full, members = loaded.adapter.predict_details(tensor[None, ...])
        probs = np.asarray(full[0], dtype=np.float64)
    except ModelUnavailable:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.exception("Échec de l'inférence (%s)", model_version)
        raise ModelUnavailable("Le modèle n'a pas pu produire de résultat.") from exc

    if probs.shape != (len(cfg.class_names),) or not np.all(np.isfinite(probs)):
        logger.error("Sortie du modèle incohérente : forme %s", probs.shape)
        raise ModelUnavailable("La sortie du modèle est incohérente.")

    order = np.argsort(probs)[::-1]
    top = int(order[0])
    low_confidence = bool(probs[top] < cfg.low_confidence_threshold)

    # Désaccord entre les réseaux d'un ensemble : signal d'image atypique, résultat à vérifier.
    member_votes: dict[str, str] | None = None
    members_agree: bool | None = None
    if members:
        member_votes = {name: cfg.class_names[int(np.argmax(p[0]))] for name, p in members.items()}
        members_agree = len(set(member_votes.values())) == 1
        low_confidence = low_confidence or not members_agree

    return {
        "model_name": cfg.model_name,
        "model_version": cfg.model_version,
        "predicted_class": cfg.class_names[top],
        "confidence": round(float(probs[top]), 5),
        "probabilities": {name: round(float(p), 6) for name, p in zip(cfg.class_names, probs)},
        "top3": [{"class_key": cfg.class_names[int(i)], "probability": round(float(probs[i]), 6)} for i in order[:3]],
        "low_confidence": low_confidence,
        "low_confidence_threshold": cfg.low_confidence_threshold,
        "members_agree": members_agree,
        "member_votes": member_votes,
        "is_dummy": loaded.adapter.is_dummy,
        "processing_time_ms": int((time.perf_counter() - started) * 1000),
    }
