"use client";

import { motion } from "motion/react";

export function ConfidenceRing({ value, low }: { value: number; low: boolean }) {
  const percent = Math.round(value * 100);
  return (
    <div className="relative h-32 w-32 shrink-0" role="img" aria-label={`Confiance du modèle : ${percent} %`}>
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r="52" fill="none" strokeWidth="10" className="stroke-border" />
        <motion.circle
          cx="60"
          cy="60"
          r="52"
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          className={low ? "stroke-warn" : "stroke-primary"}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: value }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-semibold tabular-nums">{percent}<span className="text-lg text-muted"> %</span></span>
        <span className="text-xs text-muted">confiance</span>
      </div>
    </div>
  );
}
