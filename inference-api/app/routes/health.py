from fastapi import APIRouter, Depends

from ..config import Settings, get_settings
from ..dependencies import get_registry
from ..services.model_registry import ModelRegistry

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, str]:
    """Liveness : le processus répond."""
    return {"status": "ok"}


@router.get("/ready")
def ready(
    settings: Settings = Depends(get_settings),
    registry: ModelRegistry = Depends(get_registry),
) -> dict[str, object]:
    """Readiness : le modèle par défaut est chargeable (503 sinon, via ModelUnavailable)."""
    loaded = registry.get(settings.default_model_version)
    return {"status": "ready", "model_version": loaded.config.model_version, "is_dummy": loaded.adapter.is_dummy}
