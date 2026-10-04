"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { AuditLog } from "@/lib/types";

const ACTION_LABELS: Record<string, string> = {
  "account.approve": "Compte approuvé",
  "account.revoke": "Accès retiré",
  "model.create": "Modèle enregistré",
  "model.activate": "Modèle activé",
  "rag.ingest": "Document indexé",
  "rag.delete": "Document supprimé",
  "rag.query": "Question à l'assistant",
  "patient.create": "Patient créé",
  "exam.create": "Examen créé",
  "prediction.create": "Analyse réalisée",
  "prediction.confirmed": "Résultat confirmé",
  "prediction.corrected": "Résultat corrigé",
};

const FILTERS = [
  { id: "all", label: "Tout", prefixes: [] as string[] },
  { id: "accounts", label: "Comptes", prefixes: ["account."] },
  { id: "models", label: "Modèles", prefixes: ["model."] },
  { id: "docs", label: "Documents et assistant", prefixes: ["rag."] },
  { id: "clinical", label: "Activité clinique", prefixes: ["patient.", "exam.", "prediction."] },
];

interface Actor {
  id: string;
  email: string | null;
  full_name: string;
}

export function AuditTab() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [actors, setActors] = useState<Record<string, Actor>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("audit_logs")
      .select("id, actor_id, action, entity_type, entity_id, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      setError("Impossible de charger le journal.");
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as AuditLog[];
    setLogs(rows);

    const ids = [...new Set(rows.map((r) => r.actor_id).filter((id): id is string => !!id))];
    if (ids.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id, email, full_name").in("id", ids);
      setActors(Object.fromEntries(((profiles ?? []) as Actor[]).map((p) => [p.id, p])));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const prefixes = FILTERS.find((f) => f.id === filter)?.prefixes ?? [];
    return prefixes.length === 0 ? logs : logs.filter((l) => prefixes.some((p) => l.action.startsWith(p)));
  }, [logs, filter]);

  function actorName(log: AuditLog) {
    if (!log.actor_id) return "Système";
    const a = actors[log.actor_id];
    return a?.email ?? a?.full_name ?? log.actor_id.slice(0, 8);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <label htmlFor="audit-filter" className="sr-only">Filtrer le journal</label>
          <select id="audit-filter" className="field w-auto" value={filter} onChange={(e) => setFilter(e.target.value)}>
            {FILTERS.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
        </div>
        <button type="button" onClick={load} disabled={loading} className="btn-secondary !py-2">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} aria-hidden /> Actualiser
        </button>
      </div>

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}

      {visible.length === 0 && !loading ? (
        <p className="card p-4 text-sm text-muted">Aucun événement.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <caption className="sr-only">Journal d'audit : les 200 derniers événements</caption>
            <thead className="border-b border-border text-muted">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Date</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Utilisateur</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Action</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Élément</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((l) => {
                const title = typeof l.metadata?.title === "string" ? l.metadata.title : null;
                const target = l.entity_id ? actors[l.entity_id]?.email : null;
                return (
                  <tr key={l.id}>
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-muted">
                      {new Date(l.created_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "medium" })}
                    </td>
                    <td className="px-4 py-2.5">{actorName(l)}</td>
                    <td className="px-4 py-2.5">{ACTION_LABELS[l.action] ?? l.action}</td>
                    <td className="px-4 py-2.5 text-muted">
                      {target ?? title ?? (l.entity_id ? <span className="font-mono text-xs">{l.entity_id.slice(0, 8)}</span> : "—")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-muted">Le journal est en lecture seule. Il ne contient aucune donnée de patient, ni le texte des questions posées à l'assistant.</p>
    </div>
  );
}
