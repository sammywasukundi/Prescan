"use client";

import { motion } from "motion/react";
import { LottiePlayer } from "./LottiePlayer";
import pulse from "@/assets/lottie/pulse.json";

type Shape = { kind: "ring" | "dot" | "plus" | "cell"; x: string; y: string; size: number; delay: number; dur: number; drift: number };

const SHAPES: Shape[] = [
  { kind: "ring", x: "41%", y: "80%", size: 56, delay: 0, dur: 9, drift: 18 },
  { kind: "cell", x: "88%", y: "10%", size: 74, delay: 1, dur: 11, drift: 22 },
  { kind: "plus", x: "46%", y: "6%", size: 26, delay: 0.5, dur: 8, drift: 14 },
  { kind: "dot", x: "93%", y: "46%", size: 16, delay: 2, dur: 7, drift: 16 },
  { kind: "ring", x: "78%", y: "78%", size: 40, delay: 1.5, dur: 10, drift: 20 },
  { kind: "cell", x: "3%", y: "70%", size: 64, delay: 2.5, dur: 12, drift: 24 },
  { kind: "plus", x: "30%", y: "88%", size: 22, delay: 0.8, dur: 9, drift: 12 },
  { kind: "dot", x: "58%", y: "92%", size: 12, delay: 3, dur: 6, drift: 10 },
  { kind: "dot", x: "14%", y: "42%", size: 10, delay: 1.2, dur: 8, drift: 12 },
];

function Glyph({ kind, size }: { kind: Shape["kind"]; size: number }) {
  switch (kind) {
    case "ring":
      return <span className="block rounded-full border-2 border-primary/40" style={{ width: size, height: size }} />;
    case "dot":
      return <span className="block rounded-full bg-primary/40" style={{ width: size, height: size }} />;
    case "plus":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" className="text-primary/50" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
          <path d="M12 3v18M3 12h18" />
        </svg>
      );
    case "cell":
      return (
        <svg width={size} height={size} viewBox="0 0 80 80" className="text-primary/30">
          <path d="M40 6c15 0 32 9 34 28 2 20-14 40-34 40S4 56 6 36C8 17 25 6 40 6Z" fill="currentColor" />
          <circle cx="34" cy="38" r="9" className="fill-bg opacity-60" />
          <circle cx="52" cy="50" r="5" className="fill-bg opacity-60" />
        </svg>
      );
  }
}

/** Fond animé : formes qui flottent (Motion) + animations Lottie. Purement décoratif. */
export function FloatingBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute -right-20 bottom-0 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />

      {SHAPES.map((s, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{ left: s.x, top: s.y }}
          animate={{ y: [0, -s.drift, 0], x: [0, s.drift / 2, 0], rotate: s.kind === "plus" ? [0, 90, 0] : [0, 6, 0] }}
          transition={{ duration: s.dur, delay: s.delay, repeat: Infinity, ease: "easeInOut" }}
        >
          <Glyph kind={s.kind} size={s.size} />
        </motion.div>
      ))}

      <LottiePlayer data={pulse} className="absolute -left-10 top-1/3 h-56 w-56 text-primary opacity-40" speed={0.7} />
    </div>
  );
}
