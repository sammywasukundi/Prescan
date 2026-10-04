import io
import os

# Variables nécessaires avant l'import de l'application.
os.environ.setdefault("PRESCAN_SERVICE_TOKEN", "test-token-0123456789-abcdef")
os.environ.setdefault("PRESCAN_ALLOW_DUMMY_MODEL", "true")

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.config import get_settings
from app.main import app

TOKEN = os.environ["PRESCAN_SERVICE_TOKEN"]
EXAM_ID = "7d1c3a8e-5c1f-4b0e-9d6a-2f3b8c9e1a42"


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def auth():
    return {"Authorization": f"Bearer {TOKEN}"}


def make_image(fmt="PNG", size=(160, 120), color=128) -> bytes:
    buf = io.BytesIO()
    Image.new("L", size, color).save(buf, format=fmt)
    return buf.getvalue()


@pytest.fixture
def png():
    return make_image("PNG")


@pytest.fixture
def settings_override():
    def _apply(**changes):
        settings = get_settings().model_copy(update=changes)
        app.dependency_overrides[get_settings] = lambda: settings
    return _apply
