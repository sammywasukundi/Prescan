import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: { default: "PreScan — Dépistage assisté par IA des anomalies cérébrales fœtales", template: "%s · PreScan" },
  description:
    "PreScan est une plateforme d'aide au dépistage des anomalies cérébrales fœtales à partir d'échographies prénatales, réservée aux médecins.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
