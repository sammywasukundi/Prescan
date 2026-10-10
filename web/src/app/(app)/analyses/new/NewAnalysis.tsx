"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { RotateCcw, ScanSearch } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PredictError, predictErrorKey, requestPrediction } from "@/lib/predict";
import { useI18n } from "@/lib/i18n/client";
import { detectMime, validateImageFile } from "@/lib/validateImage";
import { useClasses } from "@/lib/useClasses";
import type { Patient, Prediction } from "@/lib/types";
import { UploadDropzone } from "@/components/UploadDropzone";
import { AnalysisProgress, type Step } from "@/components/AnalysisProgress";
import { PredictionResult } from "@/components/PredictionResult";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";

type Phase = "idle" | "uploading" | "analyzing" | "done" | "error";

export function NewAnalysis() {
  const search = useSearchParams();
  const { t } = useI18n();
  const { classes, labels } = useClasses();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState(search.get("patient") ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null); // code d'erreur
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);

  // Un examen n'est créé (et l'image téléversée) qu'une fois : « Réessayer » ne relance que l'analyse.
  const examIdRef = useRef<string | null>(null);

  useEffect(() => {
    createClient()
      .from("patients")
      .select("id, anonymous_code, gestational_age_weeks, clinical_notes, created_at")
      .order("created_at", { ascending: false })
      .then(({ data }) => setPatients((data ?? []) as Patient[]));
  }, []);

  useEffect(() => {
    if (!file) return setPreviewUrl(null);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const resetExam = useCallback(() => {
    examIdRef.current = null;
    setPhase("idle");
    setErrorCode(null);
  }, []);

  async function onSelectFile(next: File | null) {
    resetExam();
    setFileError(null);
    if (!next) return setFile(null);
    const problem = await validateImageFile(next);
    if (problem) {
      setFile(null);
      setFileError(problem);
      return;
    }
    setFile(next);
  }

  async function run() {
    if (!file || !patientId) return;
    setErrorCode(null);
    const supabase = createClient();

    try {
      if (!examIdRef.current) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new PredictError("unauthenticated");

        const examId = crypto.randomUUID();
        // Chemin <doctor_id>/<exam_id>.<ext> : aucun nom de fichier d'origine (il pourrait contenir une identité).
        const mime = await detectMime(file);
        const path = `${user.id}/${examId}.${mime === "image/png" ? "png" : "jpg"}`;

        setPhase("uploading");
        const { error: uploadError } = await supabase.storage.from("ultrasounds").upload(path, file, { contentType: mime, upsert: false });
        if (uploadError) throw new PredictError("upload_failed");

        const { error: insertError } = await supabase.from("ultrasound_exams").insert({ id: examId, patient_id: patientId, image_path: path });
        if (insertError) {
          await supabase.storage.from("ultrasounds").remove([path]); // pas d'image orpheline
          throw new PredictError("exam_create_failed");
        }
        examIdRef.current = examId;
      }

      setPhase("analyzing");
      setPrediction(await requestPrediction(examIdRef.current));
      setPhase("done");
    } catch (e) {
      setErrorCode(e instanceof PredictError ? e.code : "unknown");
      setPhase("error");
    }
  }

  function startOver() {
    resetExam();
    setFile(null);
    setPrediction(null);
  }

  const uploaded = examIdRef.current !== null;
  const busy = phase === "uploading" || phase === "analyzing";
  const steps: Step[] = [
    {
      label: t("new.stepUpload"),
      state: phase === "uploading" ? "active" : phase === "error" && !uploaded ? "failed" : phase === "idle" ? "pending" : "done",
    },
    {
      label: t("new.stepAnalyze"),
      state: phase === "analyzing" ? "active" : phase === "done" ? "done" : phase === "error" && uploaded ? "failed" : "pending",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t("new.title")}</h1>
        {phase === "done" && (
          <button type="button" onClick={startOver} className="btn-secondary">
            <RotateCcw size={16} aria-hidden /> {t("new.another")}
          </button>
        )}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {phase === "done" && prediction ? (
          <motion.div key="result" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <PredictionResult prediction={prediction} previewUrl={previewUrl} classes={classes} labels={labels} onValidated={setPrediction} />
          </motion.div>
        ) : (
          <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="mx-auto max-w-2xl space-y-5">
            <div>
              <label htmlFor="patient" className="mb-1.5 block text-sm font-medium">{t("new.patient")}</label>
              {patients.length === 0 ? (
                <p className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-muted">
                  {t("new.noPatient")} <Link href="/patients" className="font-medium text-primary underline">{t("new.createFirst")}</Link>.
                </p>
              ) : (
                <select
                  id="patient"
                  className="field"
                  value={patientId}
                  disabled={busy}
                  onChange={(e) => { setPatientId(e.target.value); resetExam(); }}
                >
                  <option value="">{t("new.selectPatient")}</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.anonymous_code}{p.gestational_age_weeks ? ` · ${p.gestational_age_weeks} SA` : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <UploadDropzone file={file} previewUrl={previewUrl} error={fileError ? t(predictErrorKey(fileError)) : null} disabled={busy} onSelect={onSelectFile} />

            {(busy || phase === "error") && <AnalysisProgress steps={steps} />}

            {phase === "error" && errorCode && (
              <div role="alert" className="rounded-lg border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-danger">
                {t(predictErrorKey(errorCode))}
              </div>
            )}

            <button type="button" onClick={run} disabled={!file || !patientId || busy} className="btn-primary w-full py-3">
              <ScanSearch size={18} aria-hidden />
              {busy ? t("new.running") : phase === "error" ? t("new.retry") : t("new.analyze")}
            </button>

            <MedicalDisclaimer />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
