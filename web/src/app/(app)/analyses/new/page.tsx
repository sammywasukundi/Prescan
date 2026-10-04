import { Suspense } from "react";
import type { Metadata } from "next";
import { requireDoctor } from "@/lib/auth";
import { NewAnalysis } from "./NewAnalysis";

export const metadata: Metadata = { title: "Nouvelle analyse" };

export default async function NewAnalysisPage() {
  await requireDoctor();
  // useSearchParams (présélection du patient) exige une frontière Suspense.
  return (
    <Suspense fallback={<p className="text-muted" role="status">Chargement…</p>}>
      <NewAnalysis />
    </Suspense>
  );
}
