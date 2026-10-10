export const LOCALES = ["fr", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fr";
export const LOCALE_COOKIE = "prescan-locale";

export function isLocale(v: unknown): v is Locale {
  return v === "fr" || v === "en";
}

export type Params = Record<string, string | number>;

/** Définit un groupe de messages bilingue ; TypeScript impose les mêmes clés en FR et en EN. */
export function defineMessages<const F extends Record<string, string>>(fr: F, en: Record<keyof F, string>) {
  return { fr, en } as { fr: F; en: Record<keyof F, string> };
}

export function interpolate(text: string, params?: Params): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (_, k) => (k in params ? String(params[k]) : `{${k}}`));
}

/** Choisit la langue à partir de l'en-tête Accept-Language. */
export function detectLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const first = acceptLanguage.split(",")[0]?.trim().toLowerCase() ?? "";
  return first.startsWith("en") ? "en" : first.startsWith("fr") ? "fr" : DEFAULT_LOCALE;
}

export function dateLocale(locale: Locale): string {
  return locale === "fr" ? "fr-FR" : "en-GB";
}
