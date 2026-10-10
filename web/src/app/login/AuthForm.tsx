"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/client";
import type { MessageKey, TFn } from "@/lib/i18n/dictionaries";

type Mode = "signin" | "signup";

const SPECIALTIES: MessageKey[] = ["auth.sp.obgyn", "auth.sp.radio", "auth.sp.fetal", "auth.sp.neonat", "auth.sp.neuro", "auth.sp.other"];

function friendlyError(message: string, t: TFn): string {
  if (/invalid login credentials/i.test(message)) return t("auth.err.invalid");
  if (/email not confirmed/i.test(message)) return t("auth.err.unconfirmed");
  if (/already registered|already been registered/i.test(message)) return t("auth.err.exists");
  if (/password/i.test(message)) return t("auth.err.password");
  if (/rate limit|too many/i.test(message)) return t("auth.err.rate");
  return t("auth.err.generic");
}

/** 0 à 4 : longueur + variété de caractères (indication visuelle, la règle réelle est côté serveur). */
function passwordScore(pw: string): number {
  if (pw.length < 10) return 0;
  let score = 1;
  if (pw.length >= 14) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

export function AuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>(params.get("mode") === "signup" ? "signup" : "signin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [attest, setAttest] = useState(false);

  const score = useMemo(() => passwordScore(password), [password]);

  function switchMode(m: Mode) {
    setMode(m);
    setError(null);
    setSent(false);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const pw = String(form.get("password") ?? "");
    const supabase = createClient();

    if (mode === "signup" && !attest) {
      setError(t("auth.attestRequired"));
      return;
    }
    setBusy(true);

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (error) setError(friendlyError(error.message, t));
      else {
        const next = params.get("next");
        router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
        router.refresh();
        return;
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password: pw,
        options: {
          data: {
            full_name: String(form.get("full_name") ?? "").trim(),
            hospital: String(form.get("hospital") ?? "").trim(),
            specialty: String(form.get("specialty") ?? "").trim(),
          },
        },
      });
      if (error) setError(friendlyError(error.message, t));
      else setSent(true);
    }
    setBusy(false);
  }

  const levelKey = `auth.s${score}` as MessageKey;

  return (
    <div className="card p-6 sm:p-8">
      <div role="tablist" aria-label={t("auth.tabs")} className="relative mb-7 grid grid-cols-2 rounded-lg border border-border bg-bg p-1 text-sm font-medium">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            type="button"
            aria-selected={mode === m}
            onClick={() => switchMode(m)}
            className={`relative z-10 rounded-md px-3 py-2 transition-colors ${mode === m ? "text-primary-fg" : "text-muted hover:text-fg"}`}
          >
            {mode === m && <motion.span layoutId="auth-tab" className="absolute inset-0 -z-10 rounded-md bg-primary" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
            {m === "signin" ? t("auth.tabSignin") : t("auth.tabSignup")}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {sent ? (
          <motion.div key="sent" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="status" className="text-center">
            <motion.div initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 380, damping: 18 }} className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
              <CheckCircle2 size={30} aria-hidden />
            </motion.div>
            <h1 className="mt-4 text-xl font-semibold">{t("auth.successTitle")}</h1>
            <p className="mt-1 text-sm text-muted">{t("auth.successText")}</p>
            <ol className="mx-auto mt-5 max-w-sm space-y-3 text-left text-sm">
              {(["auth.next1", "auth.next2", "auth.next3"] as const).map((k, i) => (
                <motion.li key={k} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.12 }} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">{i + 1}</span>
                  <span>{t(k)}</span>
                </motion.li>
              ))}
            </ol>
            <button type="button" onClick={() => switchMode("signin")} className="btn-secondary mt-6">{t("auth.backToSignin")}</button>
          </motion.div>
        ) : (
          <motion.form key={mode} onSubmit={onSubmit} className="space-y-4" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">{mode === "signin" ? t("auth.signinTitle") : t("auth.signupTitle")}</h1>
              <p className="mt-1 text-sm text-muted">{mode === "signin" ? t("auth.signinText") : t("auth.signupText")}</p>
            </div>

            {mode === "signup" && (
              <>
                <Field label={t("auth.fullName")} name="full_name" autoComplete="name" required />
                <Field label={t("auth.hospital")} name="hospital" autoComplete="organization" required />
                <div>
                  <label htmlFor="f-specialty" className="mb-1.5 block text-sm font-medium">{t("auth.specialty")}</label>
                  <select id="f-specialty" name="specialty" className="field" required defaultValue="">
                    <option value="" disabled>{t("auth.specialtyPick")}</option>
                    {SPECIALTIES.map((k) => (
                      <option key={k} value={t(k)}>{t(k)}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <Field label={t("auth.email")} name="email" type="email" autoComplete="email" required />

            <div>
              <label htmlFor="f-password" className="mb-1.5 block text-sm font-medium">{t("auth.password")}</label>
              <div className="relative">
                <input
                  id="f-password"
                  name="password"
                  type={showPw ? "text" : "password"}
                  className="field pr-11"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  minLength={mode === "signup" ? 10 : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-describedby={mode === "signup" ? "pw-hint" : undefined}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted hover:text-fg"
                  aria-label={showPw ? t("auth.hide") : t("auth.show")}
                  aria-pressed={showPw}
                >
                  {showPw ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
                </button>
              </div>
              {mode === "signup" && (
                <div id="pw-hint" className="mt-2">
                  <div className="flex gap-1" aria-hidden>
                    {[1, 2, 3, 4].map((i) => (
                      <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${score >= i ? (score <= 1 ? "bg-danger" : score === 2 ? "bg-warn" : "bg-success") : "bg-border"}`} />
                    ))}
                  </div>
                  <p className="mt-1.5 text-xs text-muted">
                    {password ? t("auth.strength", { level: t(levelKey) }) : t("auth.passwordHint")}
                  </p>
                </div>
              )}
            </div>

            {mode === "signup" && (
              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input type="checkbox" checked={attest} onChange={(e) => setAttest(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[rgb(var(--primary))]" />
                <span className="text-muted">{t("auth.attest")}</span>
              </label>
            )}

            {error && <p role="alert" className="rounded-lg border border-danger/50 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

            <button type="submit" disabled={busy} className="btn-primary w-full py-3">
              {busy && <Loader2 size={16} className="animate-spin" aria-hidden />}
              {mode === "signin" ? t("auth.submitSignin") : t("auth.submitSignup")}
            </button>

            <p className="text-center text-sm text-muted">
              {mode === "signin" ? t("auth.switchToSignup") : t("auth.switchToSignin")}{" "}
              <button type="button" onClick={() => switchMode(mode === "signin" ? "signup" : "signin")} className="font-medium text-primary underline-offset-2 hover:underline">
                {mode === "signin" ? t("auth.tabSignup") : t("auth.tabSignin")}
              </button>
            </p>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = `f-${props.name}`;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">{label}</label>
      <input id={id} className="field" {...props} />
    </div>
  );
}
