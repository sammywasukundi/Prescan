import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("full_name, role, approved").eq("id", user.id).maybeSingle();
  if (!profile?.approved) redirect("/pending");

  return <AppShell fullName={profile.full_name || user.email || ""}>{children}</AppShell>;
}
