from functools import lru_cache

from .config import get_settings
from .services.model_registry import ModelRegistry


@lru_cache
def get_registry() -> ModelRegistry:
    return ModelRegistry(get_settings())
