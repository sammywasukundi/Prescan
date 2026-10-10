"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { AuditLog } from "@/lib/types";
import { useI18n } from "@/lib/i18n/client";
import { dateLocale } from "@/lib/i18n/core";
import type { MessageKey } from "@/lib/i18n/dictionaries";

const ACTIONS = [
  "account.approve", "account.revoke", "model.create", "model.activate", "rag.ingest", "rag.delete", "rag.query",
  "patient.create", "exam.create", "prediction.create", "prediction.confirmed", "prediction.corrected",
  "prediction.export", "profile.update",
];

const FILTERS: { id: string; key: MessageKey; prefixes: string[] }[] = [
  { id: "all", key: "aud.f.all", prefixes: [] },
  { id: "accounts", key: "aud.f.accounts", prefixes: ["account.", "profile."] },
  { id: "models", key: "aud.f.models", prefixes: ["model."] },
  { id: "docs", key: "aud.f.docs", prefixes: ["rag."] },
  { id: "clinical", key: "aud.f.clinical", prefixes: ["patient.", "exam.", "prediction."] },
];

interface Actor {
  id: string;
  email: string | null;
  full_name: string;
}

export function AuditTab() {
  const { t, locale } = useI18n();
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
      setError(t("aud.loadError"));
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
    if (!log.actor_id) return t("aud.system");
    const a = actors[log.actor_id];
    return a?.email ?? a?.full_name ?? log.actor_id.slice(0, 8);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <label htmlFor="audit-filter" className="sr-only">{t("aud.filterLabel")}</label>
          <select id="audit-filter" className="field w-auto" value={filter} onChange={(e) => setFilter(e.target.value)}>
            {FILTERS.map((f) => (
              <option key={f.id} value={f.id}>{t(f.key)}</option>
            ))}
          </select>
        </div>
        <button type="button" onClick={load} disabled={loading} className="btn-secondary !py-2">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} aria-hidden /> {t("aud.refresh")}
        </button>
      </div>

      {error && <p role="alert" className="text-sm text-danger">{error}</p>}

      {visible.length === 0 && !loading ? (
        <p className="card p-4 text-sm text-muted">{t("aud.none")}</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <caption className="sr-only">{t("aud.caption")}</caption>
            <thead className="border-b border-border text-muted">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">{t("aud.date")}</th>
                <th scope="col" className="px-4 py-2.5 font-medium">{t("aud.user")}</th>
                <th scope="col" className="px-4 py-2.5 font-medium">{t("aud.action")}</th>
                <th scope="col" className="px-4 py-2.5 font-medium">{t("aud.item")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((l) => {
                const title = typeof l.metadata?.title === "string" ? l.metadata.title : null;
                const target = l.entity_id ? actors[l.entity_id]?.email : null;
                return (
                  <tr key={l.id}>
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-muted">
                      {new Date(l.created_at).toLocaleString(dateLocale(locale), { dateStyle: "short", timeStyle: "medium" })}
                    </td>
                    <td className="px-4 py-2.5">{actorName(l)}</td>
                    <td className="px-4 py-2.5">{(ACTIONS as string[]).includes(l.action) ? t(`aud.${l.action}` as MessageKey) : l.action}</td>
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
      <p className="text-xs text-muted">{t("aud.note")}</p>
    </div>
  );
}
