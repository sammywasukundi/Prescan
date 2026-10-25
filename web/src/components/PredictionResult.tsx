"use client";

import { motion } from "motion/react";
import { AlertTriangle, ChevronDown, FlaskConical } from "lucide-react";
import { ConfidenceRing } from "./ConfidenceRing";
import { ProbabilityBars } from "./ProbabilityBars";
import { ValidationPanel } from "./ValidationPanel";
import { MedicalDisclaimer } from "./MedicalDisclaimer";
import type { ClassInfo, Prediction } from "@/lib/types";
import { useI18n } from "@/lib/i18n/client";

/** Probabilité minimale (5 %) pour qu'une classe alternative soit mise en avant. */
const MIN_ALTERNATIVE = 0.05;

interface Props {
  prediction: Prediction;
  previewUrl: string | null;
  classes: ClassInfo[];
  labels: Record<string, string>;
  onValidated: (p: Prediction) => void;
  readOnly?: boolean;
}

export function PredictionResult({ prediction, previewUrl, classes, labels, onValidated, readOnly }: Props) {
  const { t } = useI18n();
  const ranked = Object.entries(prediction.probabilities).sort((a, b) => b[1] - a[1]);
  const others = ranked.filter(([key]) => key !== prediction.predicted_class);
  // Une alternative n'est montrée que si elle est significative ; quand le modèle est peu sûr,
  // on affiche toujours les 3 meilleures pour aider la décision.
  const alternatives = (prediction.low_confidence ? others : others.filter(([, p]) => p >= MIN_ALTERNATIVE)).slice(0, 3);
  const mainLabel = labels[prediction.predicted_class] ?? prediction.predicted_class;

  return (
    <div className="space-y-6">
      {prediction.is_dummy && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-danger/60 bg-danger/10 px-4 py-3 text-sm">
          <FlaskConical size={18} className="mt-0.5 shrink-0 text-danger" aria-hidden />
          <p><strong>{t("res.dummyTitle")}</strong> {t("res.dummyBody")}</p>
        </div>
      )}
      {prediction.low_confidence && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-warn/60 bg-warn/10 px-4 py-3 text-sm">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warn" aria-hidden />
          <p><strong>{t("res.lowTitle")}</strong> {t("res.lowBody")}</p>
        </div>
      )}

      <section aria-labelledby="principal" className="card grid gap-6 p-5 md:grid-cols-[minmax(0,14rem)_1fr_auto] md:items-center">
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt={t("res.image")} className="max-h-52 w-full rounded-lg bg-black object-contain" />
        ) : (
          <div className="hidden md:block" />
        )}
        <div>
          <p className="text-sm text-muted">{t("res.top")}</p>
          <motion.h2
            id="principal"
            className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            {mainLabel}
          </motion.h2>
          <p className="mt-2 text-xs text-muted">
            {prediction.model_name} · {prediction.model_version}
            {prediction.processing_time_ms != null && ` · ${prediction.processing_time_ms} ms`}
          </p>
        </div>
        <ConfidenceRing value={prediction.confidence} low={prediction.low_confidence} />
      </section>

      <section aria-labelledby="alternatives">
        <h3 id="alternatives" className="mb-3 font-semibold">{t("res.alternatives")}</h3>
        {alternatives.length === 0 ? (
          <p className="card p-4 text-sm text-muted">{t("res.noAlt", { n: Math.round(MIN_ALTERNATIVE * 100) })}</p>
        ) : (
          <ol className="grid gap-3 sm:grid-cols-3">
            {alternatives.map(([key, p], i) => (
              <motion.li
                key={key}
                className="card p-4"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.1, duration: 0.3 }}
              >
                <p className="text-sm text-muted">{t("res.nth", { n: i + 2 })}</p>
                <p className="mt-0.5 font-medium">{labels[key] ?? key}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{(p * 100).toFixed(1)} %</p>
              </motion.li>
            ))}
          </ol>
        )}
      </section>

      <details className="card group p-5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold">
          <span>{t("res.details", { n: ranked.length })}</span>
          <ChevronDown size={18} className="text-muted transition-transform group-open:rotate-180 print:hidden" aria-hidden />
        </summary>
        <p className="mt-2 text-xs text-muted">{t("res.detailsHelp")}</p>
        <div className="mt-4">
          <ProbabilityBars probabilities={prediction.probabilities} labels={labels} highlight={prediction.predicted_class} />
        </div>
      </details>

      <ValidationPanel prediction={prediction} classes={classes} labels={labels} onValidated={onValidated} readOnly={readOnly} />
      <MedicalDisclaimer />
    </div>
  );
}
