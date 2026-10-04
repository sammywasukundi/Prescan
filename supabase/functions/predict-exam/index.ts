// POST /functions/v1/predict-exam   { "exam_id": "<uuid>" }
//
// 1. vérifie le JWT et que le compte est un médecin approuvé ;
// 2. vérifie (via la RLS) que l'examen appartient à ce médecin ;
// 3. télécharge l'image dans le bucket privé, l'envoie à l'API FastAPI avec le jeton de service ;
// 4. enregistre la prédiction (modèle, version, probabilités, médecin responsable) et met l'examen à jour.
//
// Le navigateur n'appelle jamais l'API d'inférence et ne connaît jamais son jeton.

import { requireCaller, serviceClient } from "../_shared/auth.ts";
import { corsHeaders, errorResponse, HttpError, json, UUID_RE } from "../_shared/http.ts";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg"];
const TIMEOUT_MS = Number(Deno.env.get("INFERENCE_TIMEOUT_MS") ?? "30000");

// Codes d'erreur renvoyés par l'API d'inférence → statut HTTP + message pour le médecin.
const INFERENCE_ERRORS: Record<string, [number, string]> = {
  image_too_large: [413, "L'image dépasse la taille maximale autorisée (10 Mo)."],
  unsupported_format: [415, "Format non pris en charge : utilisez une image PNG ou JPEG."],
  unreadable_image: [422, "L'image est illisible ou trop petite. Essayez un autre fichier."],
  unknown_model_version: [503, "La version du modèle demandée n'est pas disponible."],
  model_unavailable: [503, "Le modèle d'analyse est momentanément indisponible. Réessayez dans quelques instants."],
};

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function callInferenceApi(examId: string, modelKey: string, bytes: Uint8Array, type: string) {
  const baseUrl = Deno.env.get("INFERENCE_API_URL");
  const token = Deno.env.get("INFERENCE_SERVICE_TOKEN");
  if (!baseUrl || !token) throw new HttpError(503, "model_unavailable", INFERENCE_ERRORS.model_unavailable[1]);

  const form = new FormData();
  form.append("exam_id", examId);
  form.append("model_version", modelKey);
  form.append("image", new Blob([bytes], { type }), "ultrasound");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let resp: Response;
  try {
    resp = await fetch(`${baseUrl.replace(/\/$/, "")}/predict`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      signal: controller.signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") {
      throw new HttpError(504, "inference_timeout", "L'analyse a pris trop de temps. Réessayez.");
    }
    console.error("Appel à l'API d'inférence impossible :", e);
    throw new HttpError(503, "model_unavailable", INFERENCE_ERRORS.model_unavailable[1]);
  } finally {
    clearTimeout(timer);
  }

  if (!resp.ok) {
    const body = await resp.json().catch(() => null);
    const code: string = body?.error?.code ?? "model_unavailable";
    const [status, message] = INFERENCE_ERRORS[code] ?? INFERENCE_ERRORS.model_unavailable;
    console.error(`API d'inférence : HTTP ${resp.status} (${code})`);
    throw new HttpError(status, INFERENCE_ERRORS[code] ? code : "model_unavailable", message);
  }
  return await resp.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = serviceClient();
  let examId: string | null = null;
  let markedProcessing = false;

  try {
    if (req.method !== "POST") throw new HttpError(405, "method_not_allowed", "Méthode non autorisée.");

    const { user, supabase } = await requireCaller(req, ["doctor"]);

    const body = await req.json().catch(() => null);
    if (typeof body?.exam_id !== "string" || !UUID_RE.test(body.exam_id)) {
      throw new HttpError(400, "invalid_request", "Paramètre exam_id (uuid) requis.");
    }
    examId = body.exam_id as string;

    // La RLS garantit que l'examen appartient bien à ce médecin.
    const { data: exam } = await supabase
      .from("ultrasound_exams")
      .select("id, doctor_id, image_path, status")
      .eq("id", examId)
      .maybeSingle();
    if (!exam) throw new HttpError(404, "exam_not_found", "Examen introuvable.");
    if (exam.status === "processing") throw new HttpError(409, "already_processing", "Une analyse est déjà en cours.");
    if (exam.status === "completed") throw new HttpError(409, "already_completed", "Cet examen a déjà été analysé.");

    const { data: model } = await admin
      .from("model_versions")
      .select("model_key, name")
      .eq("is_active", true)
      .maybeSingle();
    if (!model) throw new HttpError(503, "model_unavailable", INFERENCE_ERRORS.model_unavailable[1]);

    await admin.from("ultrasound_exams").update({ status: "processing", error_code: null }).eq("id", examId);
    markedProcessing = true;

    const { data: blob, error: downloadError } = await admin.storage.from("ultrasounds").download(exam.image_path);
    if (downloadError || !blob) throw new HttpError(404, "image_not_found", "Image introuvable. Téléversez-la à nouveau.");
    if (blob.size > MAX_IMAGE_BYTES) throw new HttpError(413, "image_too_large", INFERENCE_ERRORS.image_too_large[1]);
    if (!ALLOWED_TYPES.includes(blob.type)) throw new HttpError(415, "unsupported_format", INFERENCE_ERRORS.unsupported_format[1]);

    const bytes = new Uint8Array(await blob.arrayBuffer());
    const result = await callInferenceApi(examId, model.model_key, bytes, blob.type);

    const { data: prediction, error: insertError } = await admin
      .from("predictions")
      .insert({
        exam_id: examId,
        doctor_id: exam.doctor_id,
        model_name: result.model_name,
        model_version: result.model_version,
        predicted_class: result.predicted_class,
        confidence: result.confidence,
        probabilities: result.probabilities,
        processing_time_ms: result.processing_time_ms,
        low_confidence: result.low_confidence,
        is_dummy: result.is_dummy === true,
      })
      .select()
      .single();
    if (insertError || !prediction) {
      // Typiquement : classe renvoyée par le modèle absente de la table abnormality_classes.
      console.error("Enregistrement de la prédiction impossible :", insertError);
      throw new HttpError(500, "prediction_save_failed", "Le résultat n'a pas pu être enregistré.");
    }

    await admin.from("ultrasound_exams")
      .update({ status: "completed", image_hash: await sha256Hex(bytes), error_code: null })
      .eq("id", examId);

    await admin.from("audit_logs").insert({
      actor_id: user.id,
      action: "prediction.create",
      entity_type: "predictions",
      entity_id: prediction.id,
      metadata: { exam_id: examId, model_version: result.model_version, is_dummy: result.is_dummy === true },
    });

    return json({ prediction });
  } catch (e) {
    if (examId && markedProcessing) {
      const code = e instanceof HttpError ? e.code : "internal_error";
      await admin.from("ultrasound_exams").update({ status: "failed", error_code: code }).eq("id", examId);
    }
    return errorResponse(e);
  }
});
