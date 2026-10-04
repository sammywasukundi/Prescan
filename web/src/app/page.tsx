import Link from "next/link";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import { HeroPreview } from "@/components/HeroPreview";

const PRINCIPLES = [
  { title: "Le médecin décide", text: "PreScan propose une seconde lecture. Chaque résultat est confirmé ou corrigé par le médecin, qui reste responsable." },
  { title: "Un résultat lisible", text: "Classe principale, niveau de confiance, trois alternatives et probabilité des 16 classes. Les confiances faibles sont signalées." },
  { title: "Des données protégées", text: "Patients pseudonymisés, images dans un espace privé, accès limité à chaque médecin, journal d'audit des actions." },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/login" className="btn-secondary">Se connecter</Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4">
        <section className="grid items-center gap-10 py-12 md:grid-cols-[1.1fr_0.9fr] md:py-20">
          <div>
            <h1 className="max-w-xl text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
              Une seconde lecture assistée par IA pour l'échographie cérébrale fœtale
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted">
              PreScan classe une image d'échographie prénatale parmi 16 catégories d'anomalies, indique sa confiance et laisse la décision au médecin.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login" className="btn-primary px-5">Se connecter</Link>
              <Link href="/login?mode=signup" className="btn-secondary px-5">Demander un accès</Link>
            </div>
            <MedicalDisclaimer className="mt-8 max-w-lg" />
          </div>
          <HeroPreview />
        </section>

        <section aria-label="Principes" className="grid gap-8 border-t border-border py-12 md:grid-cols-3">
          {PRINCIPLES.map((p) => (
            <div key={p.title} className="md:border-l md:border-border md:pl-6 md:first:border-l-0 md:first:pl-0">
              <h2 className="text-base font-semibold">{p.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{p.text}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border px-4 py-5 text-center text-xs text-muted">
        PreScan est un outil d'aide au dépistage réservé aux professionnels de santé. Il ne constitue pas un dispositif de diagnostic autonome.
      </footer>
    </div>
  );
}
