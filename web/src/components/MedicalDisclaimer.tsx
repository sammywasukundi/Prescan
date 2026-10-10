"use client";

import { ShieldAlert } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";

export function MedicalDisclaimer({ className = "" }: { className?: string }) {
  const { t } = useI18n();
  return (
    <div role="note" className={`flex items-start gap-3 rounded-lg border border-warn/50 bg-warn/10 px-4 py-3 text-sm text-fg ${className}`}>
      <ShieldAlert size={18} className="mt-0.5 shrink-0 text-warn" aria-hidden />
      <p>{t("common.disclaimer")}</p>
    </div>
  );
}
