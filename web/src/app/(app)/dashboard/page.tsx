import Link from "next/link";
import type { Metadata } from "next";
import { AlertTriangle, FlaskConical } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireDoctor } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import { dateLocale } from "@/lib/i18n/core";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("dash.title") };
}

interface LatestRow {
  id: string;
  predicted_class: string;
  confidence: number;
  low_confidence: boolean;
  is_dummy: boolean;
  validation_status: "pending" | "confirmed" | "corrected";
  created_at: string;
  exam: { patient: { anonymous_code: string } | null } | null;
}

export default async function DashboardPage() {
  await requireDoctor();
  const { t, locale } = await getT();
  const supabase = await createClient();
  const count = { count: "exact", head: true } as const;

  const [patients, exams, toValidate, lowConfidence, latest, classes] = await Promise.all([
    supabase.from("patients").select("id", count),
    supabase.from("ultrasound_exams").select("id", count),
    supabase.from("predictions").select("id", count).eq("validation_status", "pending"),
    supabase.from("predictions").select("id", count).eq("validation_status", "pending").eq("low_confidence", true),
    supabase
      .from("predictions")
      .select("id, predicted_class, confidence, low_confidence, is_dummy, validation_status, created_at, exam:ultrasound_exams(patient:patients(anonymous_code))")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase.from("abnormality_classes").select("class_key, label_fr, label_en"),
  ]);

  const labels = Object.fromEntries((classes.data ?? []).map((c) => [c.class_key, locale === "en" ? c.label_en || c.label_fr : c.label_fr]));
  const rows = (latest.data ?? []) as unknown as LatestRow[];
  const lowCount = lowConfidence.count ?? 0;

  const stats = [
    { label: t("dash.patients"), value: patients.count ?? 0 },
    { label: t("dash.exams"), value: exams.count ?? 0 },
    { label: t("dash.toValidate"), value: toValidate.count ?? 0 },
    { label: t("dash.lowToValidate"), value: lowCount },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t("dash.title")}</h1>
        <Link href="/analyses/new" className="btn-primary">{t("dash.newAnalysis")}</Link>
      </div>

      {lowCount > 0 && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-warn/50 bg-warn/10 px-4 py-3 text-sm">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warn" aria-hidden />
          <p>
            {lowCount === 1 ? t("dash.lowOne") : t("dash.lowMany", { n: lowCount })}
          </p>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-y-6 border-y border-border py-6 md:grid-cols-4">
        {stats.map((s, i) => (
          <div key={s.label} className={`px-4 ${i > 0 ? "md:border-l md:border-border" : "md:pl-0"} ${i % 2 === 1 ? "border-l border-border md:border-l" : ""}`}>
            <dt className="text-sm text-muted">{s.label}</dt>
            <dd className="mt-1 text-3xl font-semibold tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="latest">
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 id="latest" className="text-lg font-semibold">{t("dash.latest")}</h2>
          <Link href="/analyses" className="text-sm font-medium text-primary hover:underline">{t("dash.viewAll")}</Link>
        </div>
        {rows.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-muted">{t("dash.none")}</p>
            <Link href="/analyses/new" className="btn-primary mt-4">{t("dash.first")}</Link>
          </div>
        ) : (
          <ul className="card divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id}>
              <Link href={`/analyses/${r.id}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-border/30">
                <div>
                  <p className="font-medium">
                    {labels[r.predicted_class] ?? r.predicted_class}
                    <span className="ml-2 tabular-nums text-sm text-muted">{Math.round(r.confidence * 100)} %</span>
                  </p>
                  <p className="text-sm text-muted">
                    {t("dash.patient", { code: r.exam?.patient?.anonymous_code ?? "—" })} · {new Date(r.created_at).toLocaleString(dateLocale(locale), { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {r.is_dummy && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-warn/60 px-2 py-0.5 text-warn"><FlaskConical size={12} aria-hidden /> {t("dash.dummy")}</span>
                  )}
                  {r.low_confidence && <span className="rounded-full border border-warn/60 px-2 py-0.5 text-warn">{t("dash.low")}</span>}
                  <span className="rounded-full border border-border px-2 py-0.5 text-muted">{t(`status.${r.validation_status}` as const)}</span>
                </div>
              </Link>
            </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
