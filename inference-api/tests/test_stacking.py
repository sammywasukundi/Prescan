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


# ── Garde-fous : image hors sujet et désaccord entre réseaux ─────────────────────────────────────
def _colored_png(color):
    import io
    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (160, 120), color).save(buf, format="PNG")
    return buf.getvalue()


def test_colorful_photo_is_rejected(client, auth):
    r = client.post(
        "/predict", headers=auth, data={"exam_id": "7d1c3a8e-5c1f-4b0e-9d6a-2f3b8c9e1a42"},
        files={"image": ("u", _colored_png((220, 40, 30)), "image/png")},
    )
    assert r.status_code == 422 and r.json()["error"]["code"] == "not_ultrasound"


def test_gray_and_small_doppler_overlay_are_accepted():
    import io
    from PIL import Image
    from app.services.model_config import PreprocessingConfig
    from app.services.preprocessing import colorful_fraction, preprocess_image

    img = Image.new("RGB", (200, 200), (120, 120, 120))
    assert colorful_fraction(img, 40) == 0
    img.paste((255, 0, 0), (0, 0, 50, 50))  # zone Doppler : ~6 % de l'image
    buf = io.BytesIO(); img.save(buf, format="PNG")
    assert 0 < colorful_fraction(img, 40) < 0.1
    preprocess_image(buf.getvalue(), PreprocessingConfig(), 10_000_000)  # ne lève pas


def test_disagreement_between_networks_flags_review(monkeypatch):
    from app.services import inference
    from app.services.model_registry import LoadedModel, ModelAdapter

    class Fake(ModelAdapter):
        def predict_proba(self, batch):
            return self.predict_details(batch)[0]

        def predict_details(self, batch):
            hi = np.zeros((1, 16)); hi[0, 12] = 1.0     # normal
            other = np.zeros((1, 16)); other[0, 10] = 1.0
            final = np.zeros((1, 16)); final[0, 12] = 0.95; final[0, 10] = 0.05
            return final, {"A": hi, "B": other, "C": hi}

    import yaml
    cfg = ModelConfig.model_validate(yaml.safe_load((CONFIGS / "stacking-v1.yaml").read_text(encoding="utf-8")))

    class Reg:
        def get(self, _):
            return LoadedModel(cfg, Fake())

    out = inference.run_inference(make_image(), "stacking-v1", Reg(), 10_000_000)
    assert out["confidence"] >= 0.9                    # confiance élevée…
    assert out["members_agree"] is False and out["low_confidence"] is True   # …mais désaccord signalé
    assert out["member_votes"]["B"] == "mild_ventriculomegaly"
