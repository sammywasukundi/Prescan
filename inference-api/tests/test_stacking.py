import json
from pathlib import Path

import numpy as np
import pytest

from app.config import get_settings
from app.services.model_config import ModelConfig
from app.services.model_registry import ModelRegistry, StackingMeta
from tests.conftest import make_image

CONFIGS = Path(__file__).resolve().parent.parent / "configs"
META = CONFIGS / "stacking-v1.meta.json"


def test_config_is_valid_and_ordered():
    import yaml

    cfg = ModelConfig.model_validate(yaml.safe_load((CONFIGS / "stacking-v1.yaml").read_text(encoding="utf-8")))
    assert cfg.kind == "stacking"
    assert [m.name for m in cfg.keras_members] == ["MobileNetV2", "VGG16", "DenseNet121"]
    assert len(cfg.class_names) == 16 and len(set(cfg.class_names)) == 16


def test_meta_model_probabilities():
    meta = StackingMeta(META, n_inputs=48, num_classes=16)
    x = np.random.default_rng(1).random((5, 48))
    p = meta.predict_proba(x)
    assert p.shape == (5, 16)
    np.testing.assert_allclose(p.sum(axis=1), 1.0, atol=1e-9)
    # Les deux classes absentes de l'entraînement du méta-modèle ne sont jamais prédites.
    assert np.all(p[:, [8, 15]] == 0)


def test_meta_model_rejects_wrong_input_size():
    with pytest.raises(ValueError):
        StackingMeta(META, n_inputs=32, num_classes=16)


def test_meta_matches_sklearn_when_available():
    sk = pytest.importorskip("sklearn.linear_model")
    data = json.loads(META.read_text())
    lr = sk.LogisticRegression()
    lr.classes_ = np.asarray(data["classes"])
    lr.coef_ = np.asarray(data["coef"])
    lr.intercept_ = np.asarray(data["intercept"])
    x = np.random.default_rng(2).random((8, 48))
    got = StackingMeta(META, 48, 16).predict_proba(x)[:, lr.classes_]
    np.testing.assert_allclose(got, lr.predict_proba(x), atol=1e-9)


def test_keras_stacking_end_to_end(tmp_path, monkeypatch):
    keras = pytest.importorskip("keras")
    for name in ("mobilenetv2_best.keras", "vgg16_best.h5", "densenet121_best.h5"):
        net = keras.Sequential(
            [
                keras.layers.Input((224, 224, 3)),
                keras.layers.GlobalAveragePooling2D(),
                keras.layers.Dense(16, activation="softmax"),
            ]
        )
        net.save(tmp_path / name)

    settings = get_settings().model_copy(
        update={"models_dir": tmp_path, "configs_dir": CONFIGS, "allow_dummy_model": False}
    )
    loaded = ModelRegistry(settings).get("stacking-v1")
    assert loaded.adapter.is_dummy is False

    batch = np.random.default_rng(3).random((2, 3, 224, 224)).astype(np.float32)
    probs = loaded.adapter.predict_proba(batch)
    assert probs.shape == (2, 16)
    np.testing.assert_allclose(probs.sum(axis=1), 1.0, atol=1e-6)
    assert np.all(probs[:, [8, 15]] == 0)


def test_missing_weights_refused_when_dummy_disabled(tmp_path):
    from app.errors import ModelUnavailable

    settings = get_settings().model_copy(update={"models_dir": tmp_path, "allow_dummy_model": False})
    with pytest.raises(ModelUnavailable):
        ModelRegistry(settings).get("stacking-v1")
