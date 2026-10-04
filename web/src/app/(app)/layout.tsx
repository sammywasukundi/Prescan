import { AppShell } from "@/components/AppShell";
import { getSessionProfile } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getSessionProfile();
  return (
    <AppShell fullName={profile.full_name || profile.email || ""} role={profile.role}>
      {children}
    </AppShell>
  );
}
