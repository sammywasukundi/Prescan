import { FunctionsHttpError } from "@supabase/supabase-js";
import { createClient } from "./supabase/client";
import type { Prediction } from "./types";
import type { MessageKey } from "./i18n/dictionaries";

/** Clé de message (dictionnaire i18n) correspondant à un code d'erreur. */
export function predictErrorKey(code: string): MessageKey {
  const key = `err.${code}` as MessageKey;
  return (KNOWN as readonly string[]).includes(code) ? key : "err.unknown";
}

const KNOWN = [
  "unsupported_format", "image_too_large", "empty_file", "unreadable_image", "upload_failed", "exam_create_failed",
  "model_unavailable", "inference_timeout", "already_processing", "already_completed", "not_approved",
  "unauthenticated", "network_error", "prediction_save_failed", "unknown",
] as const;

export class PredictError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

/** Appelle l'Edge Function `predict-exam` (jamais l'API d'inférence directement). */
export async function requestPrediction(examId: string): Promise<Prediction> {
  const { data, error } = await createClient().functions.invoke("predict-exam", { body: { exam_id: examId } });

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null);
      throw new PredictError(body?.error?.code ?? "unknown");
    }
    throw new PredictError("network_error");
  }
  if (!data?.prediction) throw new PredictError("unknown");
  return data.prediction as Prediction;
}
