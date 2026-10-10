import type { Metadata } from "next";
import { UserPlus } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminClient } from "@/components/admin/AdminClient";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("adm.title") };
}

export default async function AdminPage() {
  const admin = await requireAdmin();
  const { t } = await getT();
  const supabase = await createClient();
  const { count } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "doctor")
    .eq("approved", false);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("adm.title")}</h1>
      {(count ?? 0) > 0 && (
        <div role="status" className="flex items-center gap-3 rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-sm">
          <UserPlus size={18} className="shrink-0 text-primary" aria-hidden />
          <p>{count === 1 ? t("adm.pendingOne") : t("adm.pendingMany", { n: count ?? 0 })}</p>
        </div>
      )}
      <AdminClient currentUserId={admin.id} />
      <p className="text-xs text-muted">{t("adm.scope")}</p>
    </div>
  );
}
