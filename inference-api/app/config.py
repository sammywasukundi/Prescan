from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """Configuration lue depuis les variables d'environnement `PRESCAN_*` (ou `.env`)."""

    model_config = SettingsConfigDict(env_prefix="PRESCAN_", env_file=".env", extra="ignore")

    # Secret partagé avec l'Edge Function. Obligatoire, aucune valeur par défaut.
    service_token: str = Field(min_length=16)

    models_dir: Path = BASE_DIR / "app" / "models"
    configs_dir: Path = BASE_DIR / "configs"
    default_model_version: str = "densenet121-v1"

    max_image_bytes: int = 10 * 1024 * 1024
    # En production : false. L'API refuse alors de servir un modèle dont les poids sont absents.
    allow_dummy_model: bool = True
    device: str = "cpu"
    enable_docs: bool = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
