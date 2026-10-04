import io

import numpy as np
from PIL import Image

from ..errors import ImageTooLarge, UnreadableImage, UnsupportedImageFormat
from .model_config import PreprocessingConfig

# Protège contre les « bombes de décompression ».
Image.MAX_IMAGE_PIXELS = 40_000_000

ALLOWED_FORMATS = {"PNG", "JPEG"}


def preprocess_image(raw: bytes, cfg: PreprocessingConfig, max_bytes: int) -> np.ndarray:
    """Convertit les octets d'une image en tenseur float32 de forme (3, H, W).

    ⚠ Ce pipeline doit rester IDENTIQUE à celui de l'entraînement (taille, mode couleur,
    normalisation). Toute modification se fait dans le fichier YAML du modèle.
    """
    if not raw:
        raise UnreadableImage("Le fichier est vide.")
    if len(raw) > max_bytes:
        raise ImageTooLarge()

    try:
        Image.open(io.BytesIO(raw)).verify()          # détecte les fichiers tronqués / corrompus
        img = Image.open(io.BytesIO(raw))             # verify() invalide l'objet : on rouvre
        img.load()
    except Exception as exc:  # noqa: BLE001 — PIL lève de nombreux types d'erreurs
        raise UnreadableImage() from exc

    if img.format not in ALLOWED_FORMATS:
        raise UnsupportedImageFormat()
    if min(img.size) < cfg.min_input_size:
        raise UnreadableImage(f"L'image est trop petite (minimum {cfg.min_input_size} px par côté).")

    img = img.convert("L").convert("RGB") if cfg.color_mode == "grayscale_to_rgb" else img.convert("RGB")

    height, width = cfg.image_size
    img = img.resize((width, height), Image.BILINEAR)

    arr = np.asarray(img, dtype=np.float32) / cfg.rescale          # (H, W, 3)
    mean = np.asarray(cfg.mean, dtype=np.float32)
    std = np.asarray(cfg.std, dtype=np.float32)
    arr = (arr - mean) / std
    return np.ascontiguousarray(arr.transpose(2, 0, 1))            # (3, H, W)
