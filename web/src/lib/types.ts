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

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_TYPES = ["image/png", "image/jpeg"] as const;

export interface Account {
  id: string;
  email: string | null;
  full_name: string;
  hospital: string | null;
  specialty: string | null;
  role: "doctor" | "admin";
  approved: boolean;
  created_at: string;
}

export interface ModelVersion {
  id: string;
  model_key: string;
  name: string;
  kind: "single" | "ensemble";
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

export interface RagDocument {
  id: string;
  title: string;
  source: string | null;
  is_active: boolean;
  created_at: string;
  rag_chunks: { count: number }[];
}

export interface AuditLog {
  id: number;
  actor_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface MyProfile {
  id: string;
  email: string | null;
  full_name: string;
  role: "doctor" | "admin";
  hospital: string | null;
  specialty: string | null;
  phone: string | null;
  bio: string | null;
  avatar_path: string | null;
}
