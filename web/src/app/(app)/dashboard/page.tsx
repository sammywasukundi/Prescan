import Link from "next/link";
import type { Metadata } from "next";
import { AlertTriangle, FlaskConical } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Tableau de bord" };

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

const STATUS_LABEL = { pending: "À valider", confirmed: "Confirmé", corrected: "Corrigé" } as const;

export default async function DashboardPage() {
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
    supabase.from("abnormality_classes").select("class_key, label_fr"),
  ]);

  const labels = Object.fromEntries((classes.data ?? []).map((c) => [c.class_key, c.label_fr]));
  const rows = (latest.data ?? []) as unknown as LatestRow[];
  const lowCount = lowConfidence.count ?? 0;

  const stats = [
    { label: "Patients suivis", value: patients.count ?? 0 },
    { label: "Examens analysés", value: exams.count ?? 0 },
    { label: "Résultats à valider", value: toValidate.count ?? 0 },
    { label: "Confiance faible à valider", value: lowCount },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Tableau de bord</h1>
        <Link href="/analyses/new" className="btn-primary">Nouvelle analyse</Link>
      </div>

      {lowCount > 0 && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-warn/50 bg-warn/10 px-4 py-3 text-sm">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warn" aria-hidden />
          <p>
            {lowCount === 1 ? "Un résultat à confiance faible attend" : `${lowCount} résultats à confiance faible attendent`} votre validation. Ils ne doivent pas être utilisés seuls.
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
        <h2 id="latest" className="mb-3 text-lg font-semibold">Dernières analyses</h2>
        {rows.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-muted">Aucune analyse pour le moment.</p>
            <Link href="/analyses/new" className="btn-primary mt-4">Lancer une première analyse</Link>
          </div>
        ) : (
          <ul className="card divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-medium">
                    {labels[r.predicted_class] ?? r.predicted_class}
                    <span className="ml-2 tabular-nums text-sm text-muted">{Math.round(r.confidence * 100)} %</span>
                  </p>
                  <p className="text-sm text-muted">
                    Patient {r.exam?.patient?.anonymous_code ?? "—"} · {new Date(r.created_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {r.is_dummy && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-warn/60 px-2 py-0.5 text-warn"><FlaskConical size={12} aria-hidden /> Modèle factice</span>
                  )}
                  {r.low_confidence && <span className="rounded-full border border-warn/60 px-2 py-0.5 text-warn">Confiance faible</span>}
                  <span className="rounded-full border border-border px-2 py-0.5 text-muted">{STATUS_LABEL[r.validation_status]}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
