"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Patient } from "@/lib/types";

export function PatientsClient() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await createClient()
      .from("patients")
      .select("id, anonymous_code, gestational_age_weeks, clinical_notes, created_at")
      .order("created_at", { ascending: false });
    if (error) setError("Impossible de charger les patients.");
    setPatients((data ?? []) as Patient[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const weeks = String(form.get("weeks") ?? "").trim();
    const notes = String(form.get("notes") ?? "").trim();

    setBusy(true);
    setError(null);
    // Le code anonyme et le médecin (auth.uid()) sont générés par la base.
    const { error } = await createClient()
      .from("patients")
      .insert({ gestational_age_weeks: weeks ? Number(weeks) : null, clinical_notes: notes || null });
    setBusy(false);
    if (error) {
      // 42501 = refus de la RLS (compte non médecin ou non approuvé) ; 23514 = contrainte CHECK.
      setError(
        error.code === "42501"
          ? "Seuls les comptes médecin approuvés peuvent créer des patients. Les administrateurs n'y ont pas accès : connectez-vous avec un compte médecin."
          : error.code === "23514"
            ? "Âge gestationnel invalide (1 à 45 semaines) ou notes trop longues."
            : "Le patient n'a pas pu être créé. Réessayez.",
      );
      return;
    }
    formEl.reset();
    await load();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section aria-labelledby="liste">
        <h1 id="liste" className="mb-4 text-2xl font-semibold tracking-tight">Patients</h1>
        {loading ? (
          <p className="text-muted" role="status">Chargement…</p>
        ) : patients.length === 0 ? (
          <div className="card p-8 text-center text-muted">Aucun patient. Créez un premier dossier pseudonymisé.</div>
        ) : (
          <ul className="card divide-y divide-border">
            {patients.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-mono text-sm font-medium">{p.anonymous_code}</p>
                  <p className="text-sm text-muted">
                    {p.gestational_age_weeks ? `${p.gestational_age_weeks} semaines d'aménorrhée · ` : ""}
                    créé le {new Date(p.created_at).toLocaleDateString("fr-FR")}
                  </p>
                  {p.clinical_notes && <p className="mt-1 max-w-xl text-sm">{p.clinical_notes}</p>}
                </div>
                <Link href={`/analyses/new?patient=${p.id}`} className="btn-secondary">Nouvelle analyse</Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside>
        <form onSubmit={onCreate} className="card space-y-4 p-5" aria-labelledby="nouveau">
          <h2 id="nouveau" className="text-lg font-semibold">Nouveau patient</h2>
          <p className="rounded-lg border border-warn/50 bg-warn/10 px-3 py-2 text-xs">
            Ne saisissez aucune donnée identifiante : ni nom, ni date de naissance, ni numéro de dossier. Un code anonyme est généré automatiquement.
          </p>
          <div>
            <label htmlFor="weeks" className="mb-1.5 block text-sm font-medium">Âge gestationnel (semaines)</label>
            <input id="weeks" name="weeks" type="number" min={1} max={45} inputMode="numeric" className="field" />
          </div>
          <div>
            <label htmlFor="notes" className="mb-1.5 block text-sm font-medium">Notes cliniques</label>
            <textarea id="notes" name="notes" rows={4} maxLength={2000} className="field resize-y" />
          </div>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Plus size={16} aria-hidden />}
            Créer le patient
          </button>
        </form>
      </aside>
    </div>
  );
}
