import logging
import uuid

from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.concurrency import run_in_threadpool

from ..config import Settings, get_settings
from ..dependencies import get_registry
from ..errors import ImageTooLarge, UnsupportedImageFormat
from ..schemas import PredictionResponse
from ..security import verify_service_token
from ..services.inference import run_inference
from ..services.model_registry import ModelRegistry

logger = logging.getLogger(__name__)
router = APIRouter(tags=["inference"])

ALLOWED_CONTENT_TYPES = {"image/png", "image/jpeg"}


@router.post("/predict", response_model=PredictionResponse, dependencies=[Depends(verify_service_token)])
async def predict(
    exam_id: uuid.UUID = Form(...),
    model_version: str | None = Form(None),
    image: UploadFile = File(...),
    settings: Settings = Depends(get_settings),
    registry: ModelRegistry = Depends(get_registry),
) -> PredictionResponse:
    """Classe une image d'échographie parmi les classes du modèle.

    multipart/form-data : `exam_id` (uuid), `model_version` (optionnel), `image` (PNG/JPEG).
    En-tête : `Authorization: Bearer <PRESCAN_SERVICE_TOKEN>`.
    """
    if image.content_type not in ALLOWED_CONTENT_TYPES:
        raise UnsupportedImageFormat()

    raw = await image.read(settings.max_image_bytes + 1)
    if len(raw) > settings.max_image_bytes:
        raise ImageTooLarge()

    version = model_version or settings.default_model_version
    result = await run_in_threadpool(run_inference, raw, version, registry, settings.max_image_bytes)

    # Journal sans donnée médicale : identifiant d'examen, version et latence uniquement.
    logger.info("predict exam=%s model=%s ms=%s", exam_id, version, result["processing_time_ms"])
    return PredictionResponse(exam_id=str(exam_id), **result)
