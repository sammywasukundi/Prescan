import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { SignOutButton } from "@/components/SignOutButton";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Compte en attente" };

export default async function PendingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("approved").eq("id", user.id).maybeSingle();
  if (profile?.approved) redirect("/dashboard");

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4">
      <Logo />
      <div className="card p-6">
        <h1 className="text-xl font-semibold">Votre compte attend sa validation</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          PreScan est réservé aux professionnels de santé. Un administrateur doit valider votre demande avant que vous puissiez accéder aux patients et aux analyses. Vous pourrez ensuite vous reconnecter normalement.
        </p>
        <div className="mt-5"><SignOutButton /></div>
      </div>
    </div>
  );
}
