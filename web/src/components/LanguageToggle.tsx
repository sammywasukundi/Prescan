"use client";

import { Languages } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";

export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n();
  const next = locale === "fr" ? "en" : "fr";
  return (
    <button
      type="button"
      onClick={() => setLocale(next)}
      className="btn-secondary h-10 gap-1.5 px-3"
      aria-label={locale === "fr" ? t("lang.switchToEn") : t("lang.switchToFr")}
      title={t("lang.label")}
    >
      <Languages size={16} aria-hidden />
      <span className="text-xs font-semibold uppercase" aria-hidden>{locale}</span>
    </button>
  );
}
