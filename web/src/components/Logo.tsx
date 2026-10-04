import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5 font-semibold tracking-tight text-fg">
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
        <circle cx="14" cy="14" r="12" stroke="rgb(var(--primary))" strokeWidth="2" />
        <path d="M14 14 L14 2 A12 12 0 0 1 24.4 8 Z" fill="rgb(var(--primary))" opacity="0.9" />
        <circle cx="14" cy="14" r="2.2" fill="rgb(var(--fg))" />
      </svg>
      <span className="text-lg">PreScan</span>
    </Link>
  );
}
