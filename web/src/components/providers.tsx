"use client";

import { ThemeProvider } from "next-themes";
import { MotionConfig } from "motion/react";
import { I18nProvider } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/core";

export function Providers({ children, locale }: { children: React.ReactNode; locale: Locale }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {/* reducedMotion="user" : les animations sont désactivées si le système le demande. */}
      <MotionConfig reducedMotion="user"><I18nProvider initialLocale={locale}>{children}</I18nProvider></MotionConfig>
    </ThemeProvider>
  );
}
