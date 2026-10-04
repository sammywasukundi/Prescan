import hashlib
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

        weights = self._settings.models_dir / (cfg.weights_file or "")
        if weights.is_file():
            return TorchDenseNetAdapter(cfg, weights, self._settings.device)
        if self._settings.allow_dummy_model:
            logger.warning("Poids absents (%s) : utilisation du MODÈLE FACTICE.", cfg.weights_file)
            return DummyAdapter(cfg.num_classes)
        raise ModelUnavailable("Les poids du modèle sont introuvables.")
