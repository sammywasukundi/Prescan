"use client";

import { motion } from "motion/react";

const loop = { repeat: Infinity, ease: "easeInOut" as const };

/** Petites illustrations animées pour les trois étapes. */
export function StepArt({ kind }: { kind: "upload" | "analyze" | "validate" }) {
  return (
    <svg viewBox="0 0 160 110" className="h-28 w-full" aria-hidden>
      {kind === "upload" && (
        <g>
          <rect x="40" y="22" width="80" height="70" rx="10" className="fill-surface stroke-border" strokeWidth="2" />
          <path d="M52 78l20-22 14 14 10-10 12 18Z" className="fill-primary" opacity="0.25" />
          <circle cx="98" cy="42" r="6" className="fill-primary" opacity="0.5" />
          <motion.g animate={{ y: [4, -6, 4] }} transition={{ duration: 2.4, ...loop }}>
            <circle cx="80" cy="20" r="14" className="fill-primary" />
            <path d="M80 27V13M74 19l6-6 6 6" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </motion.g>
        </g>
      )}
      {kind === "analyze" && (
        <g>
          <ellipse cx="80" cy="56" rx="40" ry="34" className="fill-surface stroke-border" strokeWidth="2" />
          <path d="M80 26v60" className="stroke-border" strokeWidth="2" strokeDasharray="4 3" />
          <path d="M56 50c6-10 16-10 20 0M84 50c4-10 14-10 20 0M58 68c8 8 16 8 20 0M84 68c4 8 14 8 20 0" className="stroke-primary" strokeWidth="3" strokeLinecap="round" fill="none" />
          <motion.rect x="38" y="24" width="84" height="4" rx="2" className="fill-primary" opacity="0.6" animate={{ y: [24, 84, 24] }} transition={{ duration: 3, ...loop }} />
        </g>
      )}
      {kind === "validate" && (
        <g>
          <rect x="44" y="14" width="72" height="84" rx="10" className="fill-surface stroke-border" strokeWidth="2" />
          <path d="M56 40h48M56 54h48M56 68h28" className="stroke-border" strokeWidth="4" strokeLinecap="round" />
          <motion.circle cx="104" cy="82" r="16" className="fill-success" animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 2.2, ...loop }} style={{ transformOrigin: "104px 82px" }} />
          <motion.path d="M96 82l6 6 10-12" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" initial={{ pathLength: 0 }} animate={{ pathLength: [0, 1, 1, 0] }} transition={{ duration: 3, times: [0, 0.3, 0.85, 1], repeat: Infinity }} />
        </g>
      )}
    </svg>
  );
}
