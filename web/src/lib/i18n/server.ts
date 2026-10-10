import { cookies, headers } from "next/headers";
import { detectLocale, isLocale, LOCALE_COOKIE, type Locale } from "./core";
import { makeT } from "./dictionaries";

export async function getLocale(): Promise<Locale> {
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(c)) return c;
  return detectLocale((await headers()).get("accept-language"));
}

export async function getT() {
  const locale = await getLocale();
  return { locale, t: makeT(locale) };
}
