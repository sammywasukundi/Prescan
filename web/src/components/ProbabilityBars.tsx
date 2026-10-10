"use client";

import { motion } from "motion/react";
import { useI18n } from "@/lib/i18n/client";

interface Props {
  probabilities: Record<string, number>;
  labels: Record<string, string>;
  highlight?: string;
}

/** Barres triées par probabilité décroissante ; chaque barre se remplit avec un léger décalage. */
export function ProbabilityBars({ probabilities, labels, highlight }: Props) {
  const { t } = useI18n();
  const rows = Object.entries(probabilities).sort((a, b) => b[1] - a[1]);

  return (
    <ul className="space-y-2.5" aria-label={t("res.allAria")}>
      {rows.map(([key, p], i) => {
        const label = labels[key] ?? key;
        const isTop = key === highlight;
        return (
          <li key={key} className="grid grid-cols-[minmax(0,11rem)_1fr_3.75rem] items-center gap-3 text-sm sm:grid-cols-[minmax(0,14rem)_1fr_4rem]">
            <span className={`truncate ${isTop ? "font-semibold" : "text-muted"}`} title={label}>{label}</span>
            <div
              className="h-2.5 overflow-hidden rounded-full bg-border/60"
              role="progressbar"
              aria-label={label}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(p * 100)}
            >
              <motion.div
                className={`h-full rounded-full ${isTop ? "bg-primary" : "bg-muted/60"}`}
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(p * 100, p > 0 ? 0.8 : 0)}%` }}
                transition={{ duration: 0.7, delay: 0.3 + i * 0.04, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <span className="text-right tabular-nums">{(p * 100).toFixed(1)} %</span>
          </li>
        );
      })}
    </ul>
  );
}
