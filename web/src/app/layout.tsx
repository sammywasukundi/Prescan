import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getT();
  return {
    title: {
      default: locale === "fr" ? "PreScan — Dépistage assisté par IA des anomalies cérébrales fœtales" : "PreScan — AI-assisted screening of fetal brain abnormalities",
      template: "%s · PreScan",
    },
    description:
      locale === "fr"
        ? "PreScan est une plateforme d'aide au dépistage des anomalies cérébrales fœtales à partir d'échographies prénatales, réservée aux médecins."
        : "PreScan is a screening-aid platform for fetal brain abnormalities from prenatal ultrasound, reserved for physicians.",
    robots: { index: false, follow: false },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale } = await getT();
  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
