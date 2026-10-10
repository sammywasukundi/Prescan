import Link from "next/link";
import type { Metadata } from "next";
import { AlertTriangle, ChevronRight, FileUp, FlaskConical } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireDoctor } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { dateLocale } from "@/lib/i18n/core";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("an.title") };
}

interface Row {
  id: string;
  predicted_class: string;
  confidence: number;
  low_confidence: boolean;
  is_dummy: boolean;
  validation_status: "pending" | "confirmed" | "corrected";
  created_at: string;
  exam: { patient: { anonymous_code: string } | null } | null;
}

const FILTERS = ["all", "pending", "validated"] as const;

export default async function AnalysesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireDoctor();
  const { t, locale } = await getT();
  const { status } = await searchParams;
  const filter = (FILTERS as readonly string[]).includes(status ?? "") ? (status as (typeof FILTERS)[number]) : "all";

  const supabase = await createClient();
  let query = supabase
    .from("predictions")
    .select("id, predicted_class, confidence, low_confidence, is_dummy, validation_status, created_at, exam:ultrasound_exams(patient:patients(anonymous_code))")
    .order("created_at", { ascending: false })
    .limit(100);
  if (filter === "pending") query = query.eq("validation_status", "pending");
  if (filter === "validated") query = query.neq("validation_status", "pending");

  const [{ data }, classes] = await Promise.all([query, supabase.from("abnormality_classes").select("class_key, label_fr, label_en")]);
  const labels = Object.fromEntries((classes.data ?? []).map((c) => [c.class_key, locale === "en" ? c.label_en || c.label_fr : c.label_fr]));
  const rows = (data ?? []) as unknown as Row[];

  const filterLabel = { all: t("an.filterAll"), pending: t("an.filterPending"), validated: t("an.filterValidated") };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("an.title")}</h1>
          <p className="mt-1 text-sm text-muted">{t("an.subtitle")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/analyses/review" className="btn-secondary"><FileUp size={16} aria-hidden /> {t("an.import")}</Link>
          <Link href="/analyses/new" className="btn-primary">{t("dash.newAnalysis")}</Link>
        </div>
      </div>

      <nav aria-label={t("an.title")} className="flex gap-1 border-b border-border">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === "all" ? "/analyses" : `/analyses?status=${f}`}
            aria-current={filter === f ? "page" : undefined}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${filter === f ? "border-primary text-primary" : "border-transparent text-muted hover:text-fg"}`}
          >
            {filterLabel[f]}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-muted">{t("an.empty")}</p>
          <Link href="/analyses/new" className="btn-primary mt-4">{t("dash.first")}</Link>
        </div>
      ) : (
        <ul className="card divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/analyses/${r.id}`} className="group flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-border/30 focus-visible:bg-border/30">
                <div className="min-w-0">
                  <p className="font-medium">
                    {labels[r.predicted_class] ?? r.predicted_class}
                    <span className="ml-2 tabular-nums text-sm text-muted">{Math.round(r.confidence * 100)} %</span>
                  </p>
                  <p className="text-sm text-muted">
                    {t("dash.patient", { code: r.exam?.patient?.anonymous_code ?? "—" })} · {new Date(r.created_at).toLocaleString(dateLocale(locale), { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {r.is_dummy && <span className="inline-flex items-center gap-1 rounded-full border border-warn/60 px-2 py-0.5 text-warn"><FlaskConical size={12} aria-hidden /> {t("dash.dummy")}</span>}
                  {r.low_confidence && <span className="inline-flex items-center gap-1 rounded-full border border-warn/60 px-2 py-0.5 text-warn"><AlertTriangle size={12} aria-hidden /> {t("dash.low")}</span>}
                  <span className={`rounded-full border px-2 py-0.5 ${r.validation_status === "pending" ? "border-border text-muted" : "border-success/50 text-success"}`}>{t(`status.${r.validation_status}` as const)}</span>
                  <ChevronRight size={18} className="text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
                  <span className="sr-only">{t("an.open")}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
