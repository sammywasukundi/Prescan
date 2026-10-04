from typing import Literal

from pydantic import BaseModel, Field, model_validator


class PreprocessingConfig(BaseModel):
    image_size: tuple[int, int] = (224, 224)  # (hauteur, largeur)
    color_mode: Literal["grayscale_to_rgb", "rgb"] = "grayscale_to_rgb"
    rescale: float = 255.0
    mean: tuple[float, float, float] = (0.485, 0.456, 0.406)
    std: tuple[float, float, float] = (0.229, 0.224, 0.225)
    min_input_size: int = 64


class ModelConfig(BaseModel):
    model_name: str
    model_version: str
    kind: Literal["single", "ensemble"] = "single"
    architecture: Literal["densenet121"] = "densenet121"
    weights_file: str | None = None
    members: list[str] = Field(default_factory=list)
    aggregation: Literal["mean_probabilities"] = "mean_probabilities"
    num_classes: int = 16
    class_names: list[str] = Field(default_factory=list)
    preprocessing: PreprocessingConfig = Field(default_factory=PreprocessingConfig)
    low_confidence_threshold: float = Field(default=0.6, ge=0, le=1)

    @model_validator(mode="after")
    def _check(self) -> "ModelConfig":
        if self.kind == "single":
            if not self.weights_file:
                raise ValueError("`weights_file` est requis pour un modèle simple.")
            if len(self.class_names) != self.num_classes:
                raise ValueError(
                    f"`class_names` contient {len(self.class_names)} entrées, {self.num_classes} attendues."
                )
        else:
            if len(self.members) < 2:
                raise ValueError("Un ensemble nécessite au moins deux membres.")
        return self
