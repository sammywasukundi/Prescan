"use client";

import { motion } from "motion/react";
import { Check, Circle, Loader2, X } from "lucide-react";

export type StepState = "pending" | "active" | "done" | "failed";
export interface Step {
  label: string;
  state: StepState;
}

export function AnalysisProgress({ steps }: { steps: Step[] }) {
  return (
    <ol className="card space-y-3 p-4" aria-label="Progression de l'analyse" role="status" aria-live="polite">
      {steps.map((s) => (
        <li key={s.label} className="flex items-center gap-3 text-sm">
          <span className="flex h-6 w-6 items-center justify-center">
            {s.state === "pending" && <Circle size={16} className="text-muted" aria-hidden />}
            {s.state === "active" && <Loader2 size={18} className="animate-spin text-primary" aria-hidden />}
            {s.state === "done" && (
              <motion.span initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 500, damping: 25 }}>
                <Check size={18} className="text-success" aria-hidden />
              </motion.span>
            )}
            {s.state === "failed" && <X size={18} className="text-danger" aria-hidden />}
          </span>
          <span className={s.state === "pending" ? "text-muted" : s.state === "failed" ? "text-danger" : "text-fg"}>
            {s.label}
            <span className="sr-only">
              {s.state === "done" ? " : terminé" : s.state === "active" ? " : en cours" : s.state === "failed" ? " : échec" : " : en attente"}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
