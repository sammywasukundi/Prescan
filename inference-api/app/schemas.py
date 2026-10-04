from pydantic import BaseModel

DISCLAIMER = "Ce résultat est une aide au dépistage et doit être confirmé par un professionnel de santé."


class ClassScore(BaseModel):
    class_key: str
    probability: float


class PredictionResponse(BaseModel):
    exam_id: str
    model_name: str
    model_version: str
    predicted_class: str
    confidence: float
    probabilities: dict[str, float]
    top3: list[ClassScore]
    low_confidence: bool
    low_confidence_threshold: float
    is_dummy: bool
    processing_time_ms: int
    disclaimer: str = DISCLAIMER
