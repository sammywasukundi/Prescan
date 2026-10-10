import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { SignOutButton } from "@/components/SignOutButton";
import { createClient } from "@/lib/supabase/server";
import { PreferencesControls } from "@/components/PreferencesControls";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("pend.meta") };
}

export default async function PendingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { t } = await getT();

  const { data: profile } = await supabase.from("profiles").select("approved").eq("id", user.id).maybeSingle();
  if (profile?.approved) redirect("/dashboard");

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4">
      <div className="flex items-center justify-between">
        <Logo />
        <PreferencesControls />
      </div>
      <div className="card p-6">
        <h1 className="text-xl font-semibold">{t("pend.title")}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">{t("pend.text")}</p>
        <div className="mt-5"><SignOutButton /></div>
      </div>
    </div>
  );
}
