import type { Metadata } from "next";
import { PatientsClient } from "./PatientsClient";

export const metadata: Metadata = { title: "Patients" };

export default function PatientsPage() {
  return <PatientsClient />;
}
