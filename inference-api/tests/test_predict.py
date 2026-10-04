import numpy as np
import pytest

from app.config import get_settings
from app.services.model_config import PreprocessingConfig
from app.services.preprocessing import preprocess_image
from tests.conftest import EXAM_ID, make_image


def post(client, headers, image=b"", content_type="image/png", **data):
    payload = {"exam_id": EXAM_ID, **data}
    return client.post("/predict", headers=headers, data=payload, files={"image": ("u", image, content_type)})


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_ready_reports_dummy_model(client):
    body = client.get("/ready").json()
    assert body["status"] == "ready" and body["is_dummy"] is True


def test_predict_requires_token(client, png):
    r = post(client, {}, png)
    assert r.status_code == 401 and r.json()["error"]["code"] == "unauthorized"


def test_predict_rejects_wrong_token(client, png):
    r = post(client, {"Authorization": "Bearer wrong-token-0123456789"}, png)
    assert r.status_code == 401


def test_predict_success_shape(client, auth, png):
    r = post(client, auth, png)
    assert r.status_code == 200
    body = r.json()
    assert body["exam_id"] == EXAM_ID
    assert body["model_version"] == "densenet121-v1"
    assert len(body["probabilities"]) == 16
    assert sum(body["probabilities"].values()) == pytest.approx(1.0, abs=1e-3)
    assert body["predicted_class"] in body["probabilities"]
    assert body["confidence"] == pytest.approx(max(body["probabilities"].values()), abs=1e-4)
    assert len(body["top3"]) == 3 and body["top3"][0]["class_key"] == body["predicted_class"]
    assert body["is_dummy"] is True
    assert "aide au dépistage" in body["disclaimer"]


def test_predict_is_deterministic_for_dummy(client, auth, png):
    a = post(client, auth, png).json()
    b = post(client, auth, png).json()
    assert a["probabilities"] == b["probabilities"]


def test_v1_alias(client, auth, png):
    r = client.post("/v1/predict", headers=auth, data={"exam_id": EXAM_ID}, files={"image": ("u", png, "image/png")})
    assert r.status_code == 200


def test_unsupported_content_type(client, auth):
    r = post(client, auth, b"hello", content_type="text/plain")
    assert r.status_code == 415 and r.json()["error"]["code"] == "unsupported_format"


def test_unreadable_image(client, auth):
    r = post(client, auth, b"definitely not an image", content_type="image/png")
    assert r.status_code == 422 and r.json()["error"]["code"] == "unreadable_image"


def test_empty_file(client, auth):
    r = post(client, auth, b"")
    assert r.status_code == 422 and r.json()["error"]["code"] == "unreadable_image"


def test_gif_declared_as_png_is_rejected(client, auth):
    r = post(client, auth, make_image("GIF"))
    assert r.status_code == 415


def test_image_too_small(client, auth):
    r = post(client, auth, make_image("PNG", size=(20, 20)))
    assert r.status_code == 422 and r.json()["error"]["code"] == "unreadable_image"


def test_image_too_large(client, auth, png, settings_override):
    settings_override(max_image_bytes=50)
    r = post(client, auth, png)
    assert r.status_code == 413 and r.json()["error"]["code"] == "image_too_large"


def test_unknown_model_version(client, auth, png):
    r = post(client, auth, png, model_version="inexistant-v9")
    assert r.status_code == 404 and r.json()["error"]["code"] == "unknown_model_version"


@pytest.mark.parametrize("version", ["../../etc/passwd", "..%2f..%2fsecret", "A B", "densenet121-v1/../x"])
def test_model_version_path_traversal_is_blocked(client, auth, png, version):
    r = post(client, auth, png, model_version=version)
    assert r.status_code == 404 and r.json()["error"]["code"] == "unknown_model_version"


def test_invalid_exam_id(client, auth, png):
    r = client.post("/predict", headers=auth, data={"exam_id": "pas-un-uuid"}, files={"image": ("u", png, "image/png")})
    assert r.status_code == 422 and r.json()["error"]["code"] == "invalid_request"


@pytest.mark.parametrize("mode", ["grayscale_to_rgb", "rgb"])
def test_preprocess_output_contract(mode):
    cfg = PreprocessingConfig(color_mode=mode)
    arr = preprocess_image(make_image("JPEG"), cfg, max_bytes=get_settings().max_image_bytes)
    assert arr.shape == (3, 224, 224) and arr.dtype == np.float32 and np.isfinite(arr).all()


def test_preprocess_normalisation_is_applied():
    cfg = PreprocessingConfig(mean=(0.5, 0.5, 0.5), std=(0.5, 0.5, 0.5))
    arr = preprocess_image(make_image("PNG", color=255), cfg, max_bytes=10**7)
    assert arr == pytest.approx(1.0, abs=1e-5)  # (255/255 - 0.5) / 0.5
