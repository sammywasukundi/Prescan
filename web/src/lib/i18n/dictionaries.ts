import { common } from "./messages/common";
import { app } from "./messages/app";
import { admin } from "./messages/admin";
import { landing } from "./messages/landing";
import { auth } from "./messages/auth";
import { interpolate, type Locale, type Params } from "./core";

const groups = [common, app, admin, landing, auth] as const;

export type MessageKey =
  | keyof typeof common.fr
  | keyof typeof app.fr
  | keyof typeof admin.fr
  | keyof typeof landing.fr
  | keyof typeof auth.fr;

const DICT: Record<Locale, Record<string, string>> = {
  fr: Object.assign({}, ...groups.map((g) => g.fr)),
  en: Object.assign({}, ...groups.map((g) => g.en)),
};

export type TFn = (key: MessageKey, params?: Params) => string;

export function translate(locale: Locale, key: MessageKey, params?: Params): string {
  return interpolate(DICT[locale][key] ?? DICT.fr[key] ?? key, params);
}

export function makeT(locale: Locale): TFn {
  return (key, params) => translate(locale, key, params);
}
