import hashlib
import json
import logging
import re
import threading
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import yaml
from pydantic import ValidationError

from ..config import Settings
from ..errors import ModelUnavailable, UnknownModelVersion
from .model_config import ModelConfig

logger = logging.getLogger(__name__)

# model_version sert de nom de fichier : on le restreint pour interdire toute traversée de chemin.
VERSION_PATTERN = re.compile(r"^[a-z0-9][a-z0-9._-]{0,63}$")


class ModelAdapter(ABC):
    """Interface commune : un modèle simple ou un ensemble se remplacent sans toucher à l'API."""

    is_dummy: bool = False

    @abstractmethod
    def predict_proba(self, batch: np.ndarray) -> np.ndarray:
        """batch (N, 3, H, W) float32 → probabilités (N, num_classes), lignes de somme 1."""


class DummyAdapter(ModelAdapter):
    """Modèle factice DÉTERMINISTE pour le développement : jamais à interpréter cliniquement."""

    is_dummy = True

    def __init__(self, num_classes: int):
        self.num_classes = num_classes

    def predict_proba(self, batch: np.ndarray) -> np.ndarray:
        out = []
        for sample in batch:
            seed = int(hashlib.sha256(sample.tobytes()).hexdigest()[:8], 16)
            logits = np.random.default_rng(seed).normal(size=self.num_classes) * 2.0
            e = np.exp(logits - logits.max())
            out.append(e / e.sum())
        return np.stack(out).astype(np.float32)


class TorchDenseNetAdapter(ModelAdapter):
    """DenseNet121 (torchvision) avec une tête linéaire à `num_classes` sorties.

    Si votre tête d'entraînement est différente (ex. Dropout + Linear), adaptez `_build_model`.
    """

    def __init__(self, cfg: ModelConfig, weights_path: Path, device: str):
        try:
            import torch
            import torchvision
        except ImportError as exc:
            raise ModelUnavailable(
                "PyTorch n'est pas installé (pip install -r requirements-ml.txt)."
            ) from exc

        self._torch = torch
        self._device = device
        model = torchvision.models.densenet121(weights=None)
        model.classifier = torch.nn.Linear(model.classifier.in_features, cfg.num_classes)
        try:
            state = torch.load(weights_path, map_location=device, weights_only=True)
            if isinstance(state, dict) and "state_dict" in state:
                state = state["state_dict"]
            state = {k.removeprefix("module."): v for k, v in state.items()}
            model.load_state_dict(state)
        except Exception as exc:  # noqa: BLE001
            logger.exception("Chargement des poids impossible : %s", weights_path.name)
            raise ModelUnavailable("Les poids du modèle n'ont pas pu être chargés.") from exc
        self._model = model.eval().to(device)

    def predict_proba(self, batch: np.ndarray) -> np.ndarray:
        torch = self._torch
        with torch.inference_mode():
            x = torch.from_numpy(batch).to(self._device)
            return torch.softmax(self._model(x), dim=1).cpu().numpy()


class StackingMeta:
    """Méta-modèle de stacking : régression logistique multinomiale exportée en JSON.

    Reproduit `LogisticRegression.predict_proba` sans dépendre de scikit-learn (le pickle d'origine
    n'est relisible qu'avec la même version de la bibliothèque). Voir scripts/export_meta_model.py.
    """

    def __init__(self, path: Path, n_inputs: int, num_classes: int):
        data = json.loads(path.read_text(encoding="utf-8"))
        self.classes = np.asarray(data["classes"], dtype=np.int64)
        self.coef = np.asarray(data["coef"], dtype=np.float64)           # (n_meta_classes, n_inputs)
        self.intercept = np.asarray(data["intercept"], dtype=np.float64)  # (n_meta_classes,)
        if self.coef.ndim != 2 or self.coef.shape[1] != n_inputs:
            raise ValueError(f"Le méta-modèle attend {self.coef.shape[1]} entrées, {n_inputs} fournies.")
        if self.coef.shape[0] != len(self.classes) or self.intercept.shape != (len(self.classes),):
            raise ValueError("Dimensions du méta-modèle incohérentes.")
        if self.classes.min() < 0 or self.classes.max() >= num_classes:
            raise ValueError("Indices de classes du méta-modèle hors limites.")
        self.num_classes = num_classes

    def predict_proba(self, features: np.ndarray) -> np.ndarray:
        """(N, n_inputs) → (N, num_classes). Les classes absentes de l'entraînement du
        méta-modèle reçoivent une probabilité nulle."""
        logits = features @ self.coef.T + self.intercept
        logits -= logits.max(axis=1, keepdims=True)
        e = np.exp(logits)
        p = e / e.sum(axis=1, keepdims=True)
        full = np.zeros((features.shape[0], self.num_classes), dtype=np.float64)
        full[:, self.classes] = p
        return full


class KerasStackingAdapter(ModelAdapter):
    """Plusieurs réseaux Keras (probabilités softmax) combinés par un méta-modèle de stacking."""

    def __init__(self, cfg: ModelConfig, models_dir: Path, configs_dir: Path):
        try:
            import keras
        except ImportError as exc:
            raise ModelUnavailable("TensorFlow/Keras n'est pas installé (pip install -r requirements-ml.txt).") from exc

        self._num_classes = cfg.num_classes
        self._networks = []
        try:
            for member in cfg.keras_members:
                path = models_dir / member.file
                logger.info("Chargement du réseau %s (%s)", member.name, member.file)
                self._networks.append(keras.models.load_model(path, compile=False))
            self._meta = StackingMeta(
                configs_dir / (cfg.meta_file or ""), cfg.num_classes * len(cfg.keras_members), cfg.num_classes
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception("Chargement du modèle de stacking impossible")
            raise ModelUnavailable("Les poids du modèle n'ont pas pu être chargés.") from exc

    def predict_proba(self, batch: np.ndarray) -> np.ndarray:
        # Le prétraitement commun produit (N, 3, H, W) ; Keras attend (N, H, W, 3).
        x = np.ascontiguousarray(batch.transpose(0, 2, 3, 1), dtype=np.float32)
        outputs = []
        for net in self._networks:
            out = np.asarray(net(x, training=False), dtype=np.float64)
            if out.shape != (x.shape[0], self._num_classes):
                raise ModelUnavailable("La sortie d'un réseau est incohérente.")
            outputs.append(out)
        return self._meta.predict_proba(np.concatenate(outputs, axis=1))


class EnsembleAdapter(ModelAdapter):
    def __init__(self, members: list[ModelAdapter]):
        self._members = members
        self.is_dummy = any(m.is_dummy for m in members)

    def predict_proba(self, batch: np.ndarray) -> np.ndarray:
        return np.mean([m.predict_proba(batch) for m in self._members], axis=0)


@dataclass(frozen=True)
class LoadedModel:
    config: ModelConfig
    adapter: ModelAdapter


class ModelRegistry:
    def __init__(self, settings: Settings):
        self._settings = settings
        self._cache: dict[str, LoadedModel] = {}
        self._lock = threading.RLock()

    def load_config(self, version: str) -> ModelConfig:
        if not VERSION_PATTERN.match(version):
            raise UnknownModelVersion()
        path = self._settings.configs_dir / f"{version}.yaml"
        if not path.is_file():
            raise UnknownModelVersion()
        try:
            cfg = ModelConfig.model_validate(yaml.safe_load(path.read_text(encoding="utf-8")))
        except (ValidationError, yaml.YAMLError) as exc:
            logger.error("Configuration invalide %s : %s", path.name, exc)
            raise ModelUnavailable("La configuration du modèle est invalide.") from exc
        if cfg.model_version != version:
            raise ModelUnavailable("La version déclarée ne correspond pas au nom du fichier de configuration.")
        return cfg

    def get(self, version: str) -> LoadedModel:
        with self._lock:
            if version in self._cache:
                return self._cache[version]
            cfg = self.load_config(version)
            loaded = LoadedModel(cfg, self._build_adapter(cfg))
            self._cache[version] = loaded
            logger.info("Modèle chargé : %s (factice=%s)", version, loaded.adapter.is_dummy)
            return loaded

    def _build_adapter(self, cfg: ModelConfig) -> ModelAdapter:
        if cfg.kind == "ensemble":
            members = [self.get(v) for v in cfg.members]
            if not cfg.class_names:
                cfg.class_names = members[0].config.class_names
            if any(m.config.class_names != cfg.class_names for m in members):
                raise ModelUnavailable("Les membres de l'ensemble n'ont pas le même ordre de classes.")
            return EnsembleAdapter([m.adapter for m in members])

        if cfg.kind == "stacking":
            models_dir = self._settings.models_dir
            if all((models_dir / m.file).is_file() for m in cfg.keras_members):
                return KerasStackingAdapter(cfg, models_dir, self._settings.configs_dir)
            if self._settings.allow_dummy_model:
                logger.warning("Poids absents (%s) : utilisation du MODÈLE FACTICE.", cfg.model_version)
                return DummyAdapter(cfg.num_classes)
            raise ModelUnavailable("Les poids du modèle sont introuvables.")

        weights = self._settings.models_dir / (cfg.weights_file or "")
        if weights.is_file():
            return TorchDenseNetAdapter(cfg, weights, self._settings.device)
        if self._settings.allow_dummy_model:
            logger.warning("Poids absents (%s) : utilisation du MODÈLE FACTICE.", cfg.weights_file)
            return DummyAdapter(cfg.num_classes)
        raise ModelUnavailable("Les poids du modèle sont introuvables.")
