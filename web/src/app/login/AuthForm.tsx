"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

function friendlyError(message: string): string {
  if (/invalid login credentials/i.test(message)) return "Adresse e-mail ou mot de passe incorrect.";
  if (/email not confirmed/i.test(message)) return "Confirmez d'abord votre adresse e-mail grâce au lien reçu.";
  if (/already registered|already been registered/i.test(message)) return "Un compte existe déjà avec cette adresse e-mail.";
  if (/password/i.test(message)) return "Mot de passe refusé : utilisez au moins 10 caractères.";
  if (/rate limit|too many/i.test(message)) return "Trop de tentatives. Patientez quelques minutes.";
  return "L'opération a échoué. Vérifiez vos informations et réessayez.";
}

export function AuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<Mode>(params.get("mode") === "signup" ? "signup" : "signin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const supabase = createClient();

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(friendlyError(error.message));
      else {
        const next = params.get("next");
        router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
        router.refresh();
        return;
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: String(form.get("full_name") ?? "").trim(),
            hospital: String(form.get("hospital") ?? "").trim(),
            specialty: String(form.get("specialty") ?? "").trim(),
          },
        },
      });
      if (error) setError(friendlyError(error.message));
      else
        setNotice(
          "Demande envoyée. Confirmez votre adresse e-mail si un message vous est envoyé, puis attendez la validation de votre compte par un administrateur.",
        );
    }
    setBusy(false);
  }

  return (
    <div className="card p-6">
      <div role="tablist" aria-label="Accès" className="mb-6 grid grid-cols-2 rounded-lg border border-border p-1 text-sm font-medium">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            type="button"
            aria-selected={mode === m}
            onClick={() => { setMode(m); setError(null); setNotice(null); }}
            className={`rounded-md px-3 py-2 transition-colors ${mode === m ? "bg-primary text-primary-fg" : "text-muted hover:text-fg"}`}
          >
            {m === "signin" ? "Connexion" : "Demander un accès"}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="space-y-4" noValidate={false}>
        {mode === "signup" && (
          <>
            <Field label="Nom complet" name="full_name" autoComplete="name" required />
            <Field label="Établissement" name="hospital" autoComplete="organization" required />
            <Field label="Spécialité" name="specialty" placeholder="Ex. : gynécologie-obstétrique" required />
          </>
        )}
        <Field label="Adresse e-mail professionnelle" name="email" type="email" autoComplete="email" required />
        <Field
          label="Mot de passe"
          name="password"
          type="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          minLength={mode === "signup" ? 10 : undefined}
          hint={mode === "signup" ? "10 caractères minimum." : undefined}
          required
        />

        {error && <p role="alert" className="rounded-lg border border-danger/50 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        {notice && <p role="status" className="rounded-lg border border-success/50 bg-success/10 px-3 py-2 text-sm text-success">{notice}</p>}

        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy && <Loader2 size={16} className="animate-spin" aria-hidden />}
          {mode === "signin" ? "Se connecter" : "Envoyer ma demande"}
        </button>
      </form>
    </div>
  );
}

function Field({ label, hint, ...props }: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = `f-${props.name}`;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">{label}</label>
      <input id={id} className="field" aria-describedby={hint ? `${id}-hint` : undefined} {...props} />
      {hint && <p id={`${id}-hint`} className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
