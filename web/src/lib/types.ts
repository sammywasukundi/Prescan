export interface ClassInfo {
  class_index: number;
  class_key: string;
  label_fr: string;
  label_en: string;
  description_fr: string | null;
}

export type ValidationStatus = "pending" | "confirmed" | "corrected";

export interface Prediction {
  id: string;
  exam_id: string;
  doctor_id: string;
  model_name: string;
  model_version: string;
  predicted_class: string;
  confidence: number;
  probabilities: Record<string, number>;
  processing_time_ms: number | null;
  low_confidence: boolean;
  is_dummy: boolean;
  validation_status: ValidationStatus;
  corrected_class: string | null;
  doctor_feedback: string | null;
  validated_at: string | null;
  created_at: string;
}

export interface Patient {
  id: string;
  anonymous_code: string;
  gestational_age_weeks: number | null;
  clinical_notes: string | null;
  created_at: string;
}

export const DISCLAIMER = "Ce résultat est une aide au dépistage et doit être confirmé par un professionnel de santé.";
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_TYPES = ["image/png", "image/jpeg"] as const;
