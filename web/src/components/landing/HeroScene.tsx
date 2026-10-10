"use client";

import { motion } from "motion/react";
import { useI18n } from "@/lib/i18n/client";

const SKIN_A = "#E8B796";
const SKIN_B = "#A8694A";
const INK = "#1E293B";

/**
 * Illustration vectorielle : deux médecins devant un écran d'échographie montrant une tête fœtale.
 * Les animations (balayage, anneau d'alerte, clignements, tracé ECG) sont gérées par Motion.
 */
export function HeroScene() {
  const { t } = useI18n();
  const loop = { repeat: Infinity, ease: "easeInOut" as const };

  return (
    <svg viewBox="0 0 620 440" role="img" aria-label={t("land.heroAlt")} className="h-auto w-full">
      <defs>
        <radialGradient id="us-bg" cx="50%" cy="10%" r="95%">
          <stop offset="0" stopColor="#5B6B80" />
          <stop offset="0.55" stopColor="#2A3547" />
          <stop offset="1" stopColor="#0E1624" />
        </radialGradient>
        <clipPath id="fan-clip">
          <path d="M320 74 L228 186 A150 150 0 0 0 412 186 Z" />
        </clipPath>
      </defs>

      {/* Sol et halo */}
      <ellipse cx="310" cy="410" rx="270" ry="16" className="fill-border" opacity="0.7" />
      <circle cx="320" cy="190" r="170" className="fill-primary" opacity="0.07" />

      {/* ───────── Écran d'échographie ───────── */}
      <rect x="222" y="296" width="196" height="14" rx="7" className="fill-border" />
      <rect x="310" y="262" width="20" height="40" className="fill-border" />
      <rect x="196" y="40" width="248" height="222" rx="16" fill={INK} />
      <rect x="196" y="40" width="248" height="222" rx="16" fill="none" className="stroke-border" strokeWidth="2" />
      <circle cx="212" cy="54" r="3" fill="#EF4444" />
      <circle cx="224" cy="54" r="3" fill="#F59E0B" />
      <circle cx="236" cy="54" r="3" fill="#22C55E" />

      <path d="M320 74 L228 186 A150 150 0 0 0 412 186 Z" fill="url(#us-bg)" />
      <g clipPath="url(#fan-clip)">
        {/* Tête fœtale : crâne, ligne médiane, ventricules */}
        <ellipse cx="320" cy="146" rx="50" ry="42" fill="none" stroke="#CBD5E1" strokeWidth="5" opacity="0.85" />
        <path d="M320 106v80" stroke="#94A3B8" strokeWidth="2" strokeDasharray="4 3" />
        <path d="M296 130c6-8 16-8 20 0 3 8-4 16-12 16s-12-8-8-16Z" fill="#E2E8F0" opacity="0.35" />
        <ellipse cx="342" cy="140" rx="12" ry="7" fill="#E2E8F0" opacity="0.28" />
        <ellipse cx="300" cy="158" rx="16" ry="9" fill="#0B1220" opacity="0.7" />
        {/* Ventricule élargi = zone détectée */}
        <motion.ellipse
          cx="340" cy="158" rx="19" ry="11" fill="#0B1220"
          animate={{ rx: [17, 21, 17] }} transition={{ duration: 3, ...loop }}
        />
        <path d="M296 190c10 10 40 10 50 0" stroke="#CBD5E1" strokeWidth="3" fill="none" opacity="0.6" />
        {/* Balayage */}
        <motion.rect
          x="220" y="74" width="200" height="6" fill="#7DD3FC" opacity="0.5"
          animate={{ y: [74, 188, 74] }} transition={{ duration: 4.5, ...loop }}
        />
      </g>

      {/* Anneau d'alerte pulsé autour du ventricule */}
      <motion.circle
        cx="340" cy="158" r="22" fill="none" stroke="#FBBF24" strokeWidth="2.5"
        animate={{ r: [20, 32, 20], opacity: [0.95, 0, 0.95] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut" }}
      />
      <circle cx="340" cy="158" r="22" fill="none" stroke="#FBBF24" strokeWidth="2" strokeDasharray="5 4" />

      {/* Bandeau de résultat sur l'écran */}
      <rect x="214" y="204" width="212" height="44" rx="8" fill="#0B1220" stroke="#334155" />
      <text x="226" y="219" fontSize="11" fill="#94A3B8" fontFamily="system-ui, sans-serif">{t("land.heroLabel")}</text>
      <text x="226" y="234" fontSize="12" fontWeight="600" fill="#E2E8F0" fontFamily="system-ui, sans-serif">{t("land.heroFinding")}</text>
      <rect x="226" y="241" width="188" height="3" rx="1.5" fill="#334155" />
      <motion.rect
        x="226" y="241" height="3" rx="1.5" fill="#3B82F6"
        initial={{ width: 0 }} animate={{ width: [0, 166, 166, 0] }} transition={{ duration: 6, times: [0, 0.3, 0.9, 1], ...loop }}
      />

      {/* ───────── Médecin A (gauche) : pointe l'écran ───────── */}
      <g>
        {/* corps */}
        <path d="M70 410 L76 236 Q76 206 112 202 L148 202 Q184 206 184 236 L190 410 Z" fill="#F8FAFC" className="stroke-border" strokeWidth="2" />
        <path d="M112 202 L130 238 L148 202 Z" className="fill-primary" />
        <path d="M130 238 L130 410" className="stroke-border" strokeWidth="2" />
        {/* stéthoscope */}
        <path d="M110 204 C100 250 112 268 130 268 C148 268 160 250 150 204" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        <circle cx="130" cy="272" r="6" fill="#64748B" stroke={INK} strokeWidth="2" />
        {/* cou + tête */}
        <rect x="122" y="178" width="16" height="26" rx="6" fill={SKIN_A} />
        <circle cx="130" cy="150" r="30" fill={SKIN_A} />
        <path d="M98 148c-4-32 20-48 40-44 22 2 34 22 28 46-6-14-14-20-26-22-14 2-30 2-42 20Z" fill="#3B2A22" />
        <circle cx="110" cy="112" r="14" fill="#3B2A22" />
        {/* visage */}
        <motion.g animate={{ scaleY: [1, 1, 0.1, 1, 1] }} transition={{ duration: 4.5, times: [0, 0.45, 0.5, 0.55, 1], repeat: Infinity }} style={{ transformOrigin: "130px 152px" }}>
          <circle cx="120" cy="152" r="2.6" fill={INK} />
          <circle cx="142" cy="152" r="2.6" fill={INK} />
        </motion.g>
        <path d="M122 166 Q131 173 140 166" stroke="#9A4B3A" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        {/* bras gauche (tablette) : la main est dessinée avant l'objet tenu */}
        <path d="M82 226 Q58 262 74 304" fill="none" className="stroke-border" strokeWidth="26" strokeLinecap="round" />
        <path d="M82 226 Q58 262 74 304" fill="none" stroke="#F8FAFC" strokeWidth="22" strokeLinecap="round" />
        <circle cx="80" cy="312" r="10" fill={SKIN_A} />
        <g transform="rotate(-8 70 330)">
          <rect x="30" y="300" width="84" height="58" rx="8" fill={INK} />
          <rect x="35" y="305" width="74" height="48" rx="4" fill="#0F2A4A" />
          <motion.polyline
            points="40,330 54,330 59,318 65,342 71,326 77,330 104,330"
            fill="none" stroke="#38BDF8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: [0, 1, 1, 0] }} transition={{ duration: 3.2, times: [0, 0.6, 0.9, 1], repeat: Infinity }}
          />
        </g>
        {/* bras droit : pointe vers l'écran */}
        <motion.g animate={{ rotate: [-2, 3, -2] }} transition={{ duration: 3.5, ...loop }} style={{ transformOrigin: "170px 230px" }}>
          <path d="M170 230 Q206 222 238 188" fill="none" className="stroke-border" strokeWidth="26" strokeLinecap="round" />
          <path d="M170 230 Q206 222 238 188" fill="none" stroke="#F8FAFC" strokeWidth="22" strokeLinecap="round" />
          <circle cx="244" cy="182" r="10" fill={SKIN_A} />
          <path d="M248 176 L270 156" stroke={SKIN_A} strokeWidth="6" strokeLinecap="round" />
        </motion.g>
      </g>

      {/* ───────── Médecin B (droite) : consulte le dossier ───────── */}
      <g>
        <path d="M456 410 L462 238 Q462 210 496 206 L530 206 Q566 210 566 240 L572 410 Z" fill="#14B8A6" className="stroke-border" strokeWidth="2" />
        <path d="M496 206 L513 236 L530 206 Z" fill="#F8FAFC" />
        <rect x="506" y="182" width="16" height="26" rx="6" fill={SKIN_B} />
        <circle cx="513" cy="154" r="30" fill={SKIN_B} />
        <path d="M483 150c0-26 14-40 32-40 20 0 32 16 30 40-6-12-14-18-30-18s-26 6-32 18Z" fill="#1B1B1F" />
        <motion.g animate={{ scaleY: [1, 1, 0.1, 1, 1] }} transition={{ duration: 5.2, times: [0, 0.6, 0.65, 0.7, 1], repeat: Infinity }} style={{ transformOrigin: "513px 156px" }}>
          <circle cx="503" cy="156" r="2.6" fill="#0F0F12" />
          <circle cx="525" cy="156" r="2.6" fill="#0F0F12" />
        </motion.g>
        <path d="M505 169 Q514 175 523 169" stroke="#4A2417" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        {/* badge */}
        <rect x="536" y="240" width="18" height="12" rx="2" fill="#F8FAFC" />
        {/* bras + presse-papiers */}
        <path d="M472 232 Q452 262 470 300" fill="none" className="stroke-border" strokeWidth="26" strokeLinecap="round" />
        <path d="M472 232 Q452 262 470 300" fill="none" stroke="#14B8A6" strokeWidth="22" strokeLinecap="round" />
        <circle cx="474" cy="308" r="10" fill={SKIN_B} />
        <g transform="rotate(6 470 330)">
          <rect x="440" y="296" width="64" height="82" rx="6" fill="#F8FAFC" className="stroke-border" strokeWidth="2" />
          <rect x="462" y="291" width="20" height="10" rx="3" fill="#64748B" />
          <path d="M452 320h40M452 332h40M452 344h26" stroke="#94A3B8" strokeWidth="3" strokeLinecap="round" />
          <motion.path d="M452 358l6 6 12-12" fill="none" stroke="#22C55E" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: [0, 1, 1, 0] }} transition={{ duration: 4, times: [0, 0.2, 0.85, 1], repeat: Infinity }} />
        </g>
      </g>

      {/* Croix médicale flottante */}
      <motion.g animate={{ y: [0, -8, 0] }} transition={{ duration: 5, ...loop }}>
        <rect x="560" y="70" width="40" height="40" rx="12" className="fill-surface stroke-border" strokeWidth="2" />
        <path d="M580 80v20M570 90h20" className="stroke-primary" strokeWidth="4" strokeLinecap="round" />
      </motion.g>
    </svg>
  );
}
