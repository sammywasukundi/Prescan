"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useI18n } from "@/lib/i18n/client";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="btn-secondary h-10 w-10 !p-0"
      aria-label={isDark ? t("theme.toLight") : t("theme.toDark")}
      title={isDark ? t("theme.light") : t("theme.dark")}
    >
      {isDark ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
    </button>
  );
}
