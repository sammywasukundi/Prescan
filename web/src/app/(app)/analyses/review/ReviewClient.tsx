"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, FileUp, ThumbsDown, ThumbsUp, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";
import { dateLocale } from "@/lib/i18n/core";
import { PredictionResult } from "@/components/PredictionResult";
import { CaseFileError, downloadJson, parseCaseFile, type CaseFile, type Person } from "@/lib/caseFile";
import type { ClassInfo, Prediction } from "@/lib/types";

export function ReviewClient({ me }: { me: Person }) {
  const { t, locale } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loaded, setLoaded] = useState<{ data: CaseFile; imageUrl: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [agrees, setAgrees] = useState<boolean | null>(null);
  const [proposed, setProposed] = useState("");
  const [comment, setComment] = useState("");
  const [reviewerName, setReviewerName] = useState(me.name);

  const labels = useMemo(
    () => Object.fromEntries((loaded?.data.classes ?? []).map((c) => [c.class_key, locale === "en" ? c.label_en || c.label_fr : c.label_fr])),
    [loaded, locale],
  );
  const classInfos: ClassInfo[] = useMemo(
    () => (loaded?.data.classes ?? []).map((c, i) => ({ class_index: i, class_key: c.class_key, label_fr: c.label_fr, label_en: c.label_en, description_fr: null })),
    [loaded],
  );

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const parsed = await parseCaseFile(file);
      setLoaded(parsed);
      setAgrees(null);
      setProposed("");
      setComment("");
    } catch (e) {
      setLoaded(null);
      setError(e instanceof CaseFileError && e.code === "version" ? t("an.importBadVersion") : t("an.importBad"));
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  function exportWithOpinion() {
    if (!loaded || agrees === null) return;
    const updated: CaseFile = {
      ...loaded.data,
      opinions: [
        ...loaded.data.opinions,
        {
          reviewer: { name: reviewerName.trim() || me.name, hospital: me.hospital, specialty: me.specialty },
          agrees,
          proposed_class: !agrees && proposed ? proposed : null,
          comment: comment.trim() || null,
          created_at: new Date().toISOString(),
        },
      ],
    };
    downloadJson(updated, `prescan-${loaded.data.case.patient_ref}-reviewed.json`);
  }

  const data = loaded?.data;
  // Objet Prediction de lecture seule construit à partir du fichier (identifiants factices, rien n'est enregistré).
  const prediction: Prediction | null = data
    ? { id: "imported", exam_id: "imported", doctor_id: "imported", ...data.prediction, confidence: data.prediction.confidence }
    : null;

  return (
    <div className="space-y-6">
      <Link href="/analyses" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg"><ArrowLeft size={16} aria-hidden /> {t("an.back")}</Link>

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><Users size={24} className="text-primary" aria-hidden /> {t("an.reviewTitle")}</h1>
        <p className="mt-1 text-sm text-muted">{t("an.reviewHelp")}</p>
      </div>

      <div>
        <input ref={fileRef} id="case-file" type="file" accept="application/json,.json" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        <label htmlFor="case-file" className={`${loaded ? "btn-secondary" : "btn-primary"} cursor-pointer`}>
          <FileUp size={16} aria-hidden /> {loaded ? t("an.reviewAnother") : t("an.import")}
        </label>
        {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
      </div>

      {data && prediction && (
        <>
          <div role="status" className="rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-sm">
            <p className="font-medium">{t("an.reviewLoaded")} · {t("an.patientLabel")} <span className="font-mono">{data.case.patient_ref}</span>{data.case.gestational_age_weeks ? ` · ${t("an.gestAge", { n: data.case.gestational_age_weeks })}` : ""}</p>
            <p className="mt-1 text-muted">
              {t("an.exportedBy", {
                name: data.exported_by.name,
                date: data.exported_at ? new Date(data.exported_at).toLocaleString(dateLocale(locale), { dateStyle: "medium", timeStyle: "short" }) : "—",
              })}
            </p>
            <p className="mt-2">{t("an.reviewBanner")}</p>
          </div>

          <PredictionResult prediction={prediction} previewUrl={loaded.imageUrl} classes={classInfos} labels={labels} onValidated={() => {}} readOnly />

          {data.opinions.length > 0 && (
            <section aria-labelledby="ops" className="space-y-3">
              <h2 id="ops" className="font-semibold">{t("an.reviewTitle")}</h2>
              <ul className="space-y-3">
                {data.opinions.map((o, i) => (
                  <li key={i} className="card p-4 text-sm">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {o.agrees ? <ThumbsUp size={16} className="text-success" aria-hidden /> : <ThumbsDown size={16} className="text-warn" aria-hidden />}
                      {t("an.reviewOpinionFrom", { name: o.reviewer.name })}
                      <span className="text-muted">· {o.agrees ? t("an.reviewAgreeLabel") : t("an.reviewDisagreeLabel")}</span>
                    </p>
                    {o.proposed_class && <p className="mt-1">{t("an.reviewProposed")} : <strong>{labels[o.proposed_class] ?? o.proposed_class}</strong></p>}
                    {o.comment && <p className="mt-1 text-muted">{o.comment}</p>}
                    <p className="mt-1 text-xs text-muted">{[o.reviewer.hospital, o.reviewer.specialty].filter(Boolean).join(" · ")} · {new Date(o.created_at).toLocaleDateString(dateLocale(locale))}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="my-opinion" className="card space-y-4 p-5">
            <h2 id="my-opinion" className="font-semibold">{t("an.reviewOpinion")}</h2>
            <div>
              <label htmlFor="rv-name" className="mb-1.5 block text-sm font-medium">{t("an.reviewYourName")}</label>
              <input id="rv-name" className="field max-w-sm" value={reviewerName} onChange={(e) => setReviewerName(e.target.value)} maxLength={200} />
            </div>
            <div role="radiogroup" aria-label={t("an.reviewOpinion")} className="flex flex-wrap gap-3">
              <button type="button" role="radio" aria-checked={agrees === true} onClick={() => setAgrees(true)} className={`btn-secondary ${agrees === true ? "!border-success !text-success" : ""}`}>
                <ThumbsUp size={16} aria-hidden /> {t("an.reviewAgree")}
              </button>
              <button type="button" role="radio" aria-checked={agrees === false} onClick={() => setAgrees(false)} className={`btn-secondary ${agrees === false ? "!border-warn !text-warn" : ""}`}>
                <ThumbsDown size={16} aria-hidden /> {t("an.reviewDisagree")}
              </button>
            </div>
            {agrees === false && (
              <div>
                <label htmlFor="rv-class" className="mb-1.5 block text-sm font-medium">{t("an.reviewProposed")}</label>
                <select id="rv-class" className="field max-w-sm" value={proposed} onChange={(e) => setProposed(e.target.value)}>
                  <option value="">{t("val.select")}</option>
                  {classInfos.map((c) => <option key={c.class_key} value={c.class_key}>{labels[c.class_key]}</option>)}
                </select>
              </div>
            )}
            <div>
              <label htmlFor="rv-comment" className="mb-1.5 block text-sm font-medium">{t("an.reviewComment")}</label>
              <textarea id="rv-comment" className="field resize-y" rows={3} maxLength={2000} value={comment} onChange={(e) => setComment(e.target.value)} />
            </div>
            <button type="button" onClick={exportWithOpinion} disabled={agrees === null} className="btn-primary">
              <Download size={16} aria-hidden /> {t("an.reviewExport")}
            </button>
          </section>
        </>
      )}
    </div>
  );
}
