"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Loader2, UserX } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Account } from "@/lib/types";

export function AccountsTab({ currentUserId }: { currentUserId: string }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await createClient()
      .from("profiles")
      .select("id, email, full_name, hospital, specialty, role, approved, created_at")
      .order("created_at", { ascending: false });
    if (error) setError("Impossible de charger les comptes.");
    setAccounts((data ?? []) as Account[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function setApproved(account: Account, approved: boolean) {
    const who = account.email ?? account.full_name;
    if (!approved && !window.confirm(`Retirer l'accès de ${who} ? Il ne pourra plus se servir de PreScan.`)) return;
    setBusyId(account.id);
    setError(null);
    const { error } = await createClient().from("profiles").update({ approved }).eq("id", account.id);
    setBusyId(null);
    if (error) {
      setError("La modification a échoué.");
      return;
    }
    await load();
  }

  const { pending, doctors, admins } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (a: Account) =>
      !q || [a.email, a.full_name, a.hospital, a.specialty].some((v) => v?.toLowerCase().includes(q));
    const filtered = accounts.filter(match);
    return {
      pending: filtered.filter((a) => a.role === "doctor" && !a.approved),
      doctors: filtered.filter((a) => a.role === "doctor" && a.approved),
      admins: filtered.filter((a) => a.role === "admin"),
    };
  }, [accounts, query]);

  if (loading) return <p className="text-muted" role="status">Chargement…</p>;

  return (
    <div className="space-y-8">
      <div>
        <label htmlFor="account-search" className="sr-only">Rechercher un compte</label>
        <input id="account-search" className="field max-w-sm" placeholder="Rechercher (e-mail, nom, établissement)…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}

      <Section title="En attente de validation ou suspendus" count={pending.length} empty="Aucune demande en attente.">
        {pending.map((a) => (
          <Row key={a.id} account={a}>
            <button type="button" disabled={busyId === a.id} onClick={() => setApproved(a, true)} className="btn-primary !py-2">
              {busyId === a.id ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Check size={16} aria-hidden />} Approuver
            </button>
          </Row>
        ))}
      </Section>

      <Section title="Médecins approuvés" count={doctors.length} empty="Aucun médecin approuvé.">
        {doctors.map((a) => (
          <Row key={a.id} account={a}>
            <button type="button" disabled={busyId === a.id} onClick={() => setApproved(a, false)} className="btn-secondary !py-2">
              {busyId === a.id ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <UserX size={16} aria-hidden />} Retirer l'accès
            </button>
          </Row>
        ))}
      </Section>

      <Section title="Administrateurs" count={admins.length} empty="Aucun administrateur.">
        {admins.map((a) => (
          <Row key={a.id} account={a}>
            <span className="text-sm text-muted">{a.id === currentUserId ? "Vous" : "Géré en base de données"}</span>
          </Row>
        ))}
      </Section>

      <p className="text-xs text-muted">
        Le rôle « administrateur » ne s'attribue jamais depuis l'application : uniquement par SQL, par une personne ayant accès à la base.
      </p>
    </div>
  );
}

function Section({ title, count, empty, children }: { title: string; count: number; empty: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold">
        {title} <span className="ml-1 text-sm font-normal text-muted">({count})</span>
      </h2>
      {count === 0 ? <p className="card p-4 text-sm text-muted">{empty}</p> : <ul className="card divide-y divide-border">{children}</ul>}
    </section>
  );
}

function Row({ account, children }: { account: Account; children: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate font-medium">{account.full_name || "(sans nom)"}</p>
        <p className="truncate text-sm text-muted">{account.email ?? "e-mail inconnu"}</p>
        <p className="text-xs text-muted">
          {[account.hospital, account.specialty].filter(Boolean).join(" · ") || "—"} · inscrit le {new Date(account.created_at).toLocaleDateString("fr-FR")}
        </p>
      </div>
      {children}
    </li>
  );
}
