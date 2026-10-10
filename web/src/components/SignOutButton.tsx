"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/client";

export function SignOutButton({ className = "btn-secondary" }: { className?: string }) {
  const router = useRouter();
  const { t } = useI18n();
  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }
  return (
    <button type="button" onClick={signOut} className={className}>
      <LogOut size={16} aria-hidden /> {t("common.signOut")}
    </button>
  );
}
