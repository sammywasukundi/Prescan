import Link from "next/link";
import type { Metadata } from "next";
import { UserPlus } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminClient } from "@/components/admin/AdminClient";

export const metadata: Metadata = { title: "Administration" };

export default async function AdminPage() {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "doctor")
    .eq("approved", false);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Administration</h1>
      {(count ?? 0) > 0 && (
        <div role="status" className="flex items-center gap-3 rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-sm">
          <UserPlus size={18} className="shrink-0 text-primary" aria-hidden />
          <p>
            {count === 1 ? "1 demande d'accès attend" : `${count} demandes d'accès attendent`} votre validation (onglet « Comptes »).
          </p>
        </div>
      )}
      <AdminClient currentUserId={admin.id} />
      <p className="text-xs text-muted">
        Les administrateurs gèrent les comptes, les modèles, les documents de l'assistant et le journal d'audit. Ils n'ont pas accès aux patients, aux images ni aux résultats.{" "}
        <Link href="/assistant" className="underline">Ouvrir l'assistant</Link>
      </p>
    </div>
  );
}
