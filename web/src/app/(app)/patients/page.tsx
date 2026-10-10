import type { Metadata } from "next";
import { requireDoctor } from "@/lib/auth";
import { PatientsClient } from "./PatientsClient";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("pat.title") };
}

export default async function PatientsPage() {
  await requireDoctor();
  return <PatientsClient />;
}
