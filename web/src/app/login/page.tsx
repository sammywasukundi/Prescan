import { Suspense } from "react";
import type { Metadata } from "next";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import { AuthForm } from "./AuthForm";

export const metadata: Metadata = { title: "Connexion" };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
        <Logo />
        <ThemeToggle />
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
        <Suspense fallback={null}>
          <AuthForm />
        </Suspense>
        <MedicalDisclaimer className="mt-6" />
      </main>
    </div>
  );
}
