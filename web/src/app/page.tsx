import Link from "next/link";
import { Logo } from "@/components/Logo";
import { PreferencesControls } from "@/components/PreferencesControls";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import { HeroScene } from "@/components/landing/HeroScene";
import { FloatingBackground } from "@/components/landing/FloatingBackground";
import { LottiePlayer } from "@/components/landing/LottiePlayer";
import { Reveal } from "@/components/landing/Reveal";
import { StepArt } from "@/components/landing/StepArt";
import { getT } from "@/lib/i18n/server";
import ecg from "@/assets/lottie/ecg.json";
import pulse from "@/assets/lottie/pulse.json";
import scan from "@/assets/lottie/scan.json";

export default async function Home() {
  const { t } = await getT();
  const steps = [
    { kind: "upload", title: t("land.step1.title"), text: t("land.step1.text") },
    { kind: "analyze", title: t("land.step2.title"), text: t("land.step2.text") },
    { kind: "validate", title: t("land.step3.title"), text: t("land.step3.text") },
  ] as const;
  const principles = [
    { title: t("land.p1.title"), text: t("land.p1.text") },
    { title: t("land.p2.title"), text: t("land.p2.text") },
    { title: t("land.p3.title"), text: t("land.p3.text") },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
        <Logo />
        <div className="flex items-center gap-2">
          <PreferencesControls />
          <Link href="/login" className="btn-secondary">{t("common.signIn")}</Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative">
          <FloatingBackground />
          <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-10 md:grid-cols-[1fr_1.05fr] md:py-16">
            <div>
              <h1 className="max-w-xl text-4xl font-semibold leading-tight tracking-tight md:text-5xl">{t("land.title")}</h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted">{t("land.subtitle")}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/login" className="btn-primary px-5">{t("common.signIn")}</Link>
                <Link href="/login?mode=signup" className="btn-secondary px-5">{t("common.requestAccess")}</Link>
              </div>
              <MedicalDisclaimer className="mt-8 max-w-lg" />
            </div>
            <HeroScene />
          </div>
        </section>

        <section aria-label={t("land.stripTitle")} className="border-y border-border bg-surface/60">
          <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-5">
            <LottiePlayer data={ecg} className="h-14 w-40 shrink-0 text-primary sm:w-64" />
            <p className="text-sm font-medium text-muted sm:text-base">{t("land.stripTitle")}</p>
          </div>
        </section>

        <section aria-labelledby="how" className="mx-auto w-full max-w-6xl px-4 py-16">
          <Reveal><h2 id="how" className="text-2xl font-semibold tracking-tight md:text-3xl">{t("land.stepsTitle")}</h2></Reveal>
          <ol className="mt-8 grid gap-5 md:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.kind}>
                <Reveal delay={i * 0.1} className="card h-full p-5">
                  <StepArt kind={s.kind} />
                  <h3 className="mt-3 font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{s.text}</p>
                </Reveal>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto grid w-full max-w-6xl gap-8 border-t border-border px-4 py-12 md:grid-cols-3">
          {principles.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.08} className="md:border-l md:border-border md:pl-6 md:first:border-l-0 md:first:pl-0">
              <h2 className="text-base font-semibold">{p.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{p.text}</p>
            </Reveal>
          ))}
        </section>

        <section className="relative mx-4 mb-14 overflow-hidden rounded-2xl border border-border bg-surface md:mx-auto md:max-w-6xl">
          <LottiePlayer data={pulse} className="pointer-events-none absolute -right-10 -top-10 h-64 w-64 text-primary opacity-30" speed={0.7} />
          <LottiePlayer data={scan} className="pointer-events-none absolute -left-4 bottom-0 hidden h-40 w-40 text-primary opacity-30 md:block" />
          <div className="relative px-6 py-12 text-center md:py-16">
            <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{t("land.ctaTitle")}</h2>
            <p className="mx-auto mt-3 max-w-xl text-muted">{t("land.ctaText")}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/login?mode=signup" className="btn-primary px-5">{t("common.requestAccess")}</Link>
              <Link href="/login" className="btn-secondary px-5">{t("common.signIn")}</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-4 py-5 text-center text-xs text-muted">{t("land.footer")}</footer>
    </div>
  );
}
