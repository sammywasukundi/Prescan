import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireDoctor } from "@/lib/auth";
import { getT } from "@/lib/i18n/server";
import type { ClassInfo, Prediction } from "@/lib/types";
import { AnalysisDetail } from "./AnalysisDetail";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("an.detail") };
}

interface Row extends Prediction {
  exam: {
    image_path: string;
    created_at: string;
    patient: { anonymous_code: string; gestational_age_weeks: number | null } | null;
  } | null;
}

export default async function AnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireDoctor();
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const { t } = await getT();

  const supabase = await createClient();
  // La RLS ne renvoie que les analyses du médecin connecté.
  const { data } = await supabase
    .from("predictions")
    .select("*, exam:ultrasound_exams(image_path, created_at, patient:patients(anonymous_code, gestational_age_weeks))")
    .eq("id", id)
    .maybeSingle();
  const row = data as unknown as Row | null;

  if (!row || !row.exam) {
    return (
      <div className="space-y-4">
        <Link href="/analyses" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg"><ArrowLeft size={16} aria-hidden /> {t("an.back")}</Link>
        <p role="alert" className="card p-6 text-muted">{t("an.notFound")}</p>
      </div>
    );
  }

  const [{ data: classes }, signed, { data: profile }] = await Promise.all([
    supabase.from("abnormality_classes").select("class_index, class_key, label_fr, label_en, description_fr").order("class_index"),
    supabase.storage.from("ultrasounds").createSignedUrl(row.exam.image_path, 3600),
    supabase.from("profiles").select("full_name, hospital, specialty").eq("id", me.id).single(),
  ]);

  const { exam, ...prediction } = row;
  return (
    <AnalysisDetail
      prediction={prediction as Prediction}
      imageUrl={signed.data?.signedUrl ?? null}
      imagePath={exam.image_path}
      examDate={exam.created_at}
      patientRef={exam.patient?.anonymous_code ?? "—"}
      gestationalAge={exam.patient?.gestational_age_weeks ?? null}
      classes={(classes ?? []) as ClassInfo[]}
      me={{ name: profile?.full_name ?? me.full_name, hospital: profile?.hospital ?? null, specialty: profile?.specialty ?? null }}
    />
  );
}
