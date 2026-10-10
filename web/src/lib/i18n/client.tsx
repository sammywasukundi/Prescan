"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LOCALE_COOKIE, type Locale } from "./core";
import { makeT, type TFn } from "./dictionaries";

interface Ctx {
  locale: Locale;
  t: TFn;
  setLocale: (l: Locale) => void;
}
const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ initialLocale, children }: { initialLocale: Locale; children: React.ReactNode }) {
  const router = useRouter();
  const [locale, setLoc] = useState<Locale>(initialLocale);

  const setLocale = useCallback(
    (l: Locale) => {
      document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.lang = l;
      setLoc(l);
      router.refresh(); // recharge les composants serveur dans la nouvelle langue
    },
    [router],
  );

  const value = useMemo(() => ({ locale, t: makeT(locale), setLocale }), [locale, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n doit être utilisé dans <I18nProvider>");
  return ctx;
}
