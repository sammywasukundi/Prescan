import { Suspense } from "react";
import type { Metadata } from "next";
import { requireDoctor } from "@/lib/auth";
import { NewAnalysis } from "./NewAnalysis";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("new.title") };
}

export default async function NewAnalysisPage() {
  await requireDoctor();
  // useSearchParams (présélection du patient) exige une frontière Suspense.
  return (
    <Suspense fallback={<p className="text-muted" role="status">…</p>}>
      <NewAnalysis />
    </Suspense>
  );
}
