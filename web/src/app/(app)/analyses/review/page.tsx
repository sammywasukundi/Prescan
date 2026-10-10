import type { Metadata } from "next";
import { requireDoctor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import { ReviewClient } from "./ReviewClient";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("an.reviewTitle") };
}

export default async function ReviewPage() {
  const me = await requireDoctor();
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("full_name, hospital, specialty").eq("id", me.id).single();
  return <ReviewClient me={{ name: profile?.full_name ?? me.full_name, hospital: profile?.hospital ?? null, specialty: profile?.specialty ?? null }} />;
}
