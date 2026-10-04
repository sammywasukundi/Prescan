"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton({ className = "btn-secondary" }: { className?: string }) {
  const router = useRouter();
  async function signOut() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }
  return (
    <button type="button" onClick={signOut} className={className}>
      <LogOut size={16} aria-hidden /> Se déconnecter
    </button>
  );
}
