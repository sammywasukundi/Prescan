import type { Prediction } from "./types";

/** Format du dossier d'analyse échangé entre médecins (JSON, pseudonymisé, généré dans le navigateur). */
export const CASE_FORMAT = "prescan-case";
export const CASE_VERSION = 1;
const MAX_FILE_BYTES = 16 * 1024 * 1024;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export interface Person {
  name: string;
  hospital: string | null;
  specialty: string | null;
}

export interface Opinion {
  reviewer: Person;
  agrees: boolean;
  proposed_class: string | null;
  comment: string | null;
  created_at: string;
}

export interface CaseClass {
  class_key: string;
  label_fr: string;
  label_en: string;
}

export interface CaseFile {
  format: typeof CASE_FORMAT;
  version: typeof CASE_VERSION;
  exported_at: string;
  exported_by: Person;
  case: { patient_ref: string; gestational_age_weeks: number | null; exam_date: string };
  prediction: Pick<
    Prediction,
    | "model_name" | "model_version" | "predicted_class" | "confidence" | "probabilities" | "processing_time_ms"
    | "low_confidence" | "is_dummy" | "validation_status" | "corrected_class" | "doctor_feedback" | "validated_at" | "created_at"
  >;
  classes: CaseClass[];
  image: { mime: "image/png" | "image/jpeg"; sha256: string; data_base64: string };
  opinions: Opinion[];
}

export class CaseFileError extends Error {
  constructor(public code: "bad" | "version") {
    super(code);
  }
}

export async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const isStr = (v: unknown, max = 5000): v is string => typeof v === "string" && v.length <= max;
const isStrOrNull = (v: unknown, max = 5000): v is string | null => v === null || isStr(v, max);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function parsePerson(v: unknown): Person {
  if (!isObj(v) || !isStr(v.name, 200) || !isStrOrNull(v.hospital ?? null, 200) || !isStrOrNull(v.specialty ?? null, 200)) throw new CaseFileError("bad");
  return { name: v.name, hospital: (v.hospital as string | null) ?? null, specialty: (v.specialty as string | null) ?? null };
}

/** Lit et valide un fichier importé : rien n'est supposé fiable (taille, types, image, empreinte). */
export async function parseCaseFile(file: File): Promise<{ data: CaseFile; imageUrl: string }> {
  if (file.size > MAX_FILE_BYTES) throw new CaseFileError("bad");
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    throw new CaseFileError("bad");
  }
  if (!isObj(raw) || raw.format !== CASE_FORMAT) throw new CaseFileError("bad");
  if (raw.version !== CASE_VERSION) throw new CaseFileError("version");

  const c = raw.case, p = raw.prediction, img = raw.image;
  if (!isObj(c) || !isObj(p) || !isObj(img) || !Array.isArray(raw.classes) || !Array.isArray(raw.opinions)) throw new CaseFileError("bad");

  if (!isStr(c.patient_ref, 40) || !isStr(c.exam_date, 40)) throw new CaseFileError("bad");
  const weeks = c.gestational_age_weeks;
  if (weeks !== null && (typeof weeks !== "number" || weeks < 1 || weeks > 45)) throw new CaseFileError("bad");

  if (raw.classes.length === 0 || raw.classes.length > 64) throw new CaseFileError("bad");
  const classes: CaseClass[] = raw.classes.map((k) => {
    if (!isObj(k) || !isStr(k.class_key, 80) || !isStr(k.label_fr, 200) || !isStr(k.label_en, 200)) throw new CaseFileError("bad");
    return { class_key: k.class_key, label_fr: k.label_fr, label_en: k.label_en };
  });
  const keys = new Set(classes.map((k) => k.class_key));

  if (!isStr(p.model_name, 100) || !isStr(p.model_version, 100) || !isStr(p.predicted_class, 80) || !keys.has(p.predicted_class)) throw new CaseFileError("bad");
  if (typeof p.confidence !== "number" || p.confidence < 0 || p.confidence > 1) throw new CaseFileError("bad");
  if (!isObj(p.probabilities)) throw new CaseFileError("bad");
  const probabilities: Record<string, number> = {};
  for (const [k, v] of Object.entries(p.probabilities)) {
    if (!keys.has(k) || typeof v !== "number" || v < 0 || v > 1) throw new CaseFileError("bad");
    probabilities[k] = v;
  }
  if (!["pending", "confirmed", "corrected"].includes(String(p.validation_status))) throw new CaseFileError("bad");
  if (p.corrected_class !== null && !(isStr(p.corrected_class, 80) && keys.has(p.corrected_class))) throw new CaseFileError("bad");
  if (!isStrOrNull(p.doctor_feedback, 2000) || !isStrOrNull(p.validated_at, 40) || !isStr(p.created_at, 40)) throw new CaseFileError("bad");
  if (p.processing_time_ms !== null && typeof p.processing_time_ms !== "number") throw new CaseFileError("bad");

  if ((img.mime !== "image/png" && img.mime !== "image/jpeg") || !isStr(img.sha256, 64) || typeof img.data_base64 !== "string" || img.data_base64.length > MAX_IMAGE_BYTES * 1.4) throw new CaseFileError("bad");
  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(img.data_base64);
  } catch {
    throw new CaseFileError("bad");
  }
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES || (img.mime === "image/png" ? !isPng : !isJpeg)) throw new CaseFileError("bad");
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  if ((await sha256Hex(buf)) !== img.sha256) throw new CaseFileError("bad");

  if (raw.opinions.length > 50) throw new CaseFileError("bad");
  const opinions: Opinion[] = raw.opinions.map((o) => {
    if (!isObj(o) || typeof o.agrees !== "boolean" || !isStrOrNull(o.comment ?? null, 2000) || !isStr(o.created_at, 40)) throw new CaseFileError("bad");
    const proposed = o.proposed_class ?? null;
    if (proposed !== null && !(isStr(proposed, 80) && keys.has(proposed))) throw new CaseFileError("bad");
    return { reviewer: parsePerson(o.reviewer), agrees: o.agrees, proposed_class: proposed, comment: (o.comment as string | null) ?? null, created_at: o.created_at };
  });

  const data: CaseFile = {
    format: CASE_FORMAT,
    version: CASE_VERSION,
    exported_at: isStr(raw.exported_at, 40) ? raw.exported_at : "",
    exported_by: parsePerson(raw.exported_by),
    case: { patient_ref: c.patient_ref, gestational_age_weeks: weeks as number | null, exam_date: c.exam_date },
    prediction: {
      model_name: p.model_name,
      model_version: p.model_version,
      predicted_class: p.predicted_class,
      confidence: p.confidence,
      probabilities,
      processing_time_ms: (p.processing_time_ms as number | null) ?? null,
      low_confidence: p.low_confidence === true,
      is_dummy: p.is_dummy === true,
      validation_status: p.validation_status as Prediction["validation_status"],
      corrected_class: (p.corrected_class as string | null) ?? null,
      doctor_feedback: (p.doctor_feedback as string | null) ?? null,
      validated_at: (p.validated_at as string | null) ?? null,
      created_at: p.created_at,
    },
    classes,
    image: { mime: img.mime, sha256: img.sha256, data_base64: img.data_base64 },
    opinions,
  };
  return { data, imageUrl: `data:${img.mime};base64,${img.data_base64}` };
}
