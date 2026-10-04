import type { Metadata } from "next";
import { requireDoctor } from "@/lib/auth";
import { PatientsClient } from "./PatientsClient";

export const metadata: Metadata = { title: "Patients" };

export default async function PatientsPage() {
  await requireDoctor();
  return <PatientsClient />;
}
