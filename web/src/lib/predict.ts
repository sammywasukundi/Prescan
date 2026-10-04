import { FunctionsHttpError } from "@supabase/supabase-js";
import { createClient } from "./supabase/client";
import type { Prediction } from "./types";

// Messages affichés au médecin pour chaque code d'erreur (Edge Function, API d'inférence ou client).
export const ERROR_MESSAGES: Record<string, string> = {
  unsupported_format: "Format non pris en charge : utilisez une image PNG ou JPEG.",
  image_too_large: "L'image dépasse la taille maximale autorisée (10 Mo).",
  empty_file: "Le fichier est vide.",
  unreadable_image: "L'image est illisible ou trop petite. Essayez un autre fichier.",
  upload_failed: "Le téléversement de l'image a échoué. Vérifiez votre connexion puis réessayez.",
  exam_create_failed: "L'examen n'a pas pu être créé. Vérifiez que le patient vous appartient et réessayez.",
  model_unavailable: "Le modèle d'analyse est momentanément indisponible. Réessayez dans quelques instants.",
  inference_timeout: "L'analyse a pris trop de temps. Réessayez.",
  already_processing: "Une analyse est déjà en cours pour cet examen.",
  already_completed: "Cet examen a déjà été analysé.",
  not_approved: "Votre compte n'a pas encore été validé par un administrateur.",
  unauthenticated: "Votre session a expiré. Reconnectez-vous.",
  network_error: "Connexion impossible. Vérifiez votre réseau et réessayez.",
  prediction_save_failed: "Le résultat n'a pas pu être enregistré. Réessayez.",
  unknown: "Une erreur inattendue est survenue. Réessayez.",
};

export class PredictError extends Error {
  constructor(public code: string) {
    super(ERROR_MESSAGES[code] ?? ERROR_MESSAGES.unknown);
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
