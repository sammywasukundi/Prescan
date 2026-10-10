import { Suspense } from "react";
import type { Metadata } from "next";
import { Check } from "lucide-react";
import { Logo } from "@/components/Logo";
import { PreferencesControls } from "@/components/PreferencesControls";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import { LottiePlayer } from "@/components/landing/LottiePlayer";
import { Reveal } from "@/components/landing/Reveal";
import { getT } from "@/lib/i18n/server";
import { AuthForm } from "./AuthForm";
import ecg from "@/assets/lottie/ecg.json";
import pulse from "@/assets/lottie/pulse.json";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: t("auth.metaTitle") };
}

export default async function LoginPage() {
  const { t } = await getT();
  const points = [t("auth.side1"), t("auth.side2"), t("auth.side3")];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
        <Logo />
        <PreferencesControls />
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-4 py-6 lg:grid-cols-[1fr_28rem] lg:py-10">
        <aside className="relative hidden self-stretch overflow-hidden rounded-2xl border border-border bg-surface p-10 lg:block">
          <LottiePlayer data={pulse} className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 text-primary opacity-30" speed={0.6} />
          <div className="relative">
            <h2 className="max-w-sm text-3xl font-semibold leading-tight tracking-tight">{t("auth.sideTitle")}</h2>
            <p className="mt-4 max-w-md text-muted">{t("auth.sideText")}</p>
            <ul className="mt-8 space-y-4">
              {points.map((p, i) => (
                <Reveal key={p} delay={0.1 + i * 0.12}>
                  <li className="flex items-start gap-3 text-sm">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success"><Check size={13} aria-hidden /></span>
                    {p}
                  </li>
                </Reveal>
              ))}
            </ul>
            <LottiePlayer data={ecg} className="mt-10 h-16 w-72 text-primary" />
          </div>
        </aside>

        <div className="mx-auto w-full max-w-md lg:max-w-none">
          <Suspense fallback={null}>
            <AuthForm />
          </Suspense>
          <MedicalDisclaimer className="mt-5" />
        </div>
      </main>
    </div>
  );
}
