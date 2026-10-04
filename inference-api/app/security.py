import hmac

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import Settings, get_settings
from .errors import Unauthorized

_bearer = HTTPBearer(auto_error=False)


def verify_service_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    settings: Settings = Depends(get_settings),
) -> None:
    """Seule l'Edge Function Supabase connaît ce jeton : l'API n'est jamais appelée par le navigateur."""
    if credentials is None:
        raise Unauthorized()
    if not hmac.compare_digest(credentials.credentials.encode(), settings.service_token.encode()):
        raise Unauthorized()
