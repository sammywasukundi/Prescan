"use client";

import { motion } from "motion/react";

// Illustration animée : valeurs FICTIVES, uniquement pour montrer la forme d'un résultat.
const ROWS = [
  { label: "Classe la plus probable", value: 0.71 },
  { label: "Deuxième classe", value: 0.17 },
  { label: "Troisième classe", value: 0.07 },
  { label: "Treize autres classes", value: 0.05 },
];

export function HeroPreview() {
  return (
    <figure className="card p-5" aria-label="Exemple illustratif de résultat">
      <figcaption className="mb-4 flex items-center justify-between text-sm">
        <span className="font-medium">Résultat de l'analyse</span>
        <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-muted">Exemple fictif</span>
      </figcaption>
      <ul className="space-y-3">
        {ROWS.map((row, i) => (
          <li key={row.label} className="text-sm">
            <div className="mb-1 flex justify-between">
              <span className={i === 0 ? "font-medium" : "text-muted"}>{row.label}</span>
              <span className="tabular-nums text-muted">{Math.round(row.value * 100)} %</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-border/60">
              <motion.div
                className={`h-full rounded-full ${i === 0 ? "bg-primary" : "bg-muted/60"}`}
                initial={{ width: 0 }}
                animate={{ width: `${row.value * 100}%` }}
                transition={{ duration: 0.9, delay: 0.25 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-4 border-t border-border pt-3 text-xs text-muted">Chaque résultat doit être confirmé ou corrigé par le médecin.</p>
    </figure>
  );
}
