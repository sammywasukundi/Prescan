class InferenceError(Exception):
    """Erreur métier convertie en réponse JSON `{"error": {"code", "message"}}`."""

    status_code = 500
    code = "internal_error"

    def __init__(self, message: str | None = None):
        super().__init__(message or self.default_message)
        self.message = message or self.default_message

    default_message = "Erreur interne du service d'inférence."


class Unauthorized(InferenceError):
    status_code = 401
    code = "unauthorized"
    default_message = "Jeton de service invalide ou absent."


class UnsupportedImageFormat(InferenceError):
    status_code = 415
    code = "unsupported_format"
    default_message = "Format d'image non pris en charge (PNG ou JPEG uniquement)."


class UnreadableImage(InferenceError):
    status_code = 422
    code = "unreadable_image"
    default_message = "L'image est illisible ou corrompue."


class ImageTooLarge(InferenceError):
    status_code = 413
    code = "image_too_large"
    default_message = "Le fichier dépasse la taille maximale autorisée."


class UnknownModelVersion(InferenceError):
    status_code = 404
    code = "unknown_model_version"
    default_message = "Version de modèle inconnue."


class ModelUnavailable(InferenceError):
    status_code = 503
    code = "model_unavailable"
    default_message = "Le modèle est momentanément indisponible."
