"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Download, Loader2, Printer, Share2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/client";
import { dateLocale } from "@/lib/i18n/core";
import { PredictionResult } from "@/components/PredictionResult";
import { blobToBase64, CASE_FORMAT, CASE_VERSION, downloadJson, sha256Hex, type CaseFile, type Person } from "@/lib/caseFile";
import type { ClassInfo, Prediction } from "@/lib/types";

interface Props {
  prediction: Prediction;
  imageUrl: string | null;
  imagePath: string;
  examDate: string;
  patientRef: string;
  gestationalAge: number | null;
  classes: ClassInfo[];
  me: Person;
}

export function AnalysisDetail({ prediction: initial, imageUrl, imagePath, examDate, patientRef, gestationalAge, classes, me }: Props) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [prediction, setPrediction] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const labels = useMemo(
    () => Object.fromEntries(classes.map((c) => [c.class_key, locale === "en" ? c.label_en || c.label_fr : c.label_fr])),
    [classes, locale],
  );

  async function exportJson() {
    setBusy(true);
    setMsg(null);
    try {
      const supabase = createClient();
      const { data: blob, error } = await supabase.storage.from("ultrasounds").download(imagePath);
      if (error || !blob) throw new Error("download");
      const mime = blob.type === "image/png" ? "image/png" : "image/jpeg";
      const file: CaseFile = {
        format: CASE_FORMAT,
        version: CASE_VERSION,
        exported_at: new Date().toISOString(),
        exported_by: me,
        // Jamais de notes cliniques ni d'identité : uniquement le code pseudonyme et l'âge gestationnel.
        case: { patient_ref: patientRef, gestational_age_weeks: gestationalAge, exam_date: examDate },
        prediction: {
          model_name: prediction.model_name,
          model_version: prediction.model_version,
          predicted_class: prediction.predicted_class,
          confidence: Number(prediction.confidence),
          probabilities: prediction.probabilities,
          processing_time_ms: prediction.processing_time_ms,
          low_confidence: prediction.low_confidence,
          is_dummy: prediction.is_dummy,
          validation_status: prediction.validation_status,
          corrected_class: prediction.corrected_class,
          doctor_feedback: prediction.doctor_feedback,
          validated_at: prediction.validated_at,
          created_at: prediction.created_at,
        },
        classes: classes.map((c) => ({ class_key: c.class_key, label_fr: c.label_fr, label_en: c.label_en })),
        image: { mime, sha256: await sha256Hex(await blob.arrayBuffer()), data_base64: await blobToBase64(blob) },
        opinions: [],
      };
      const { error: logError } = await supabase.rpc("log_prediction_export", { p_prediction_id: prediction.id, p_format: "json" });
      if (logError) throw new Error("audit");
      downloadJson(file, `neuroscan-${patientRef}-${prediction.id.slice(0, 8)}.json`);
      setMsg({ kind: "ok", text: t("an.exported") });
    } catch {
      setMsg({ kind: "error", text: t("an.exportFailed") });
    }
    setBusy(false);
  }

  async function remove() {
    if (!window.confirm(t("an.deleteConfirm"))) return;
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    const { data: path, error } = await supabase.rpc("delete_analysis", { p_prediction_id: prediction.id });
    if (error) {
      setMsg({ kind: "error", text: t("an.deleteFailed") });
      setBusy(false);
      return;
    }
    // L'analyse est déjà supprimée en base ; l'échec du retrait de l'image n'est pas bloquant.
    if (typeof path === "string" && path) await supabase.storage.from("ultrasounds").remove([path]);
    router.push("/analyses");
    router.refresh();
  }

  async function print() {
    await createClient().rpc("log_prediction_export", { p_prediction_id: prediction.id, p_format: "print" });
    window.print();
  }

  return (
    <div className="space-y-6">
      <Link href="/analyses" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg print:hidden">
        <ArrowLeft size={16} aria-hidden /> {t("an.back")}
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("an.detail")}</h1>
        <p className="mt-1 text-sm text-muted">
          {t("an.patientLabel")} <span className="font-mono">{patientRef}</span>
          {gestationalAge ? ` · ${t("an.gestAge", { n: gestationalAge })}` : ""} ·{" "}
          {new Date(examDate).toLocaleString(dateLocale(locale), { dateStyle: "long", timeStyle: "short" })}
        </p>
      </div>

      <PredictionResult prediction={prediction} previewUrl={imageUrl} classes={classes} labels={labels} onValidated={setPrediction} />

      <section aria-labelledby="share" className="card space-y-3 p-5 print:hidden">
        <h2 id="share" className="flex items-center gap-2 font-semibold"><Share2 size={18} className="text-primary" aria-hidden /> {t("an.exportTitle")}</h2>
        <p className="text-sm text-muted">{t("an.exportHelp")}</p>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={exportJson} disabled={busy} className="btn-primary">
            {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Download size={16} aria-hidden />} {t("an.exportJson")}
          </button>
          <button type="button" onClick={print} className="btn-secondary"><Printer size={16} aria-hidden /> {t("an.exportPdf")}</button>
        </div>
        {msg && <p role={msg.kind === "error" ? "alert" : "status"} className={`text-sm ${msg.kind === "error" ? "text-danger" : "text-success"}`}>{msg.text}</p>}
      </section>

      <section aria-labelledby="del" className="card space-y-3 p-5 print:hidden">
        <h2 id="del" className="flex items-center gap-2 font-semibold"><Trash2 size={18} className="text-danger" aria-hidden /> {t("an.deleteTitle")}</h2>
        <p className="text-sm text-muted">{t("an.deleteHelp")}</p>
        <button type="button" onClick={remove} disabled={busy} className="btn-secondary border-danger/60 text-danger">
          <Trash2 size={16} aria-hidden /> {t("an.delete")}
        </button>
      </section>
    </div>
  );
}
