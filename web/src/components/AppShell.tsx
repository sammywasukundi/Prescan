"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";
import { PreferencesControls } from "./PreferencesControls";
import { SignOutButton } from "./SignOutButton";
import { useI18n } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/dictionaries";

const DOCTOR_NAV: { href: string; key: MessageKey }[] = [
  { href: "/dashboard", key: "nav.dashboard" },
  { href: "/patients", key: "nav.patients" },
  { href: "/analyses/new", key: "nav.newAnalysis" },
  { href: "/assistant", key: "nav.assistant" },
];

// Les administrateurs n'ont volontairement pas accès aux patients ni aux analyses.
const ADMIN_NAV: { href: string; key: MessageKey }[] = [
  { href: "/admin", key: "nav.administration" },
  { href: "/assistant", key: "nav.assistant" },
];

export function AppShell({ fullName, role, children }: { fullName: string; role: "doctor" | "admin"; children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useI18n();
  const NAV = role === "admin" ? ADMIN_NAV : DOCTOR_NAV;

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-fg">
        {t("common.skipToContent")}
      </a>
      <header className="sticky top-0 z-40 border-b border-border bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Logo href={role === "admin" ? "/admin" : "/dashboard"} />
          <nav aria-label={t("common.mainNav")} className="order-3 flex w-full gap-1 overflow-x-auto md:order-none md:w-auto md:flex-1">
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active ? "bg-primary/10 text-primary" : "text-muted hover:bg-border/40 hover:text-fg"
                  }`}
                >
                  {t(item.key)}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-sm text-muted sm:inline">{fullName}{role === "admin" && <span className="ml-2 rounded-full border border-primary/50 px-2 py-0.5 text-xs text-primary">{t("common.admin")}</span>}</span>
            <PreferencesControls />
            <SignOutButton />
          </div>
        </div>
      </header>

      <main id="contenu" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {children}
      </main>

      <footer className="border-t border-border px-4 py-4 text-center text-xs text-muted">{t("common.disclaimer")}</footer>
    </div>
  );
}
