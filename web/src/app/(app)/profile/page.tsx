import type { Metadata } from "next";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";
import type { MyProfile } from "@/lib/types";
import { ProfileClient } from "./ProfileClient";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("prof.title") };
}

export default async function ProfilePage() {
  const session = await getSessionProfile();
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, hospital, specialty, phone, bio, avatar_path")
    .eq("id", session.id)
    .single();

  return <ProfileClient profile={data as MyProfile} avatarUrl={session.avatar_url} />;
}
