import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface SessionProfile {
  id: string;
  email: string | null;
  full_name: string;
  role: "doctor" | "admin";
  avatar_url: string | null;
}

/** Utilisateur connecté ET approuvé, sinon redirection. */
export async function getSessionProfile(): Promise<SessionProfile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, approved, avatar_path")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.approved) redirect("/pending");

  let avatar_url: string | null = null;
  if (profile.avatar_path) {
    const { data } = await supabase.storage.from("avatars").createSignedUrl(profile.avatar_path, 3600);
    avatar_url = data?.signedUrl ?? null;
  }

  return { id: user.id, email: user.email ?? null, full_name: profile.full_name, role: profile.role as "doctor" | "admin", avatar_url };
}

/** Pages médecin (patients, analyses, tableau de bord) : un administrateur est renvoyé vers /admin. */
export async function requireDoctor(): Promise<SessionProfile> {
  const profile = await getSessionProfile();
  if (profile.role === "admin") redirect("/admin");
  return profile;
}

/** Pages d'administration : un médecin est renvoyé vers son tableau de bord. */
export async function requireAdmin(): Promise<SessionProfile> {
  const profile = await getSessionProfile();
  if (profile.role !== "admin") redirect("/dashboard");
  return profile;
}
