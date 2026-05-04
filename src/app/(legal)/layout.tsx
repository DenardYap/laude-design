import type { ReactNode } from 'react';
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function LegalLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <main className="relative min-h-[100dvh] bg-background">
      <div className="pointer-events-none absolute inset-x-0 top-[-10%] -z-10 mx-auto h-[420px] w-[120%] max-w-[1600px] rounded-2xl bg-brand/30 blur-3xl" />

      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="Laude Design"
            width={28}
            height={28}
            className="size-7"
          />
          <span className="text-sm font-semibold tracking-tight text-ink">
            Laude Design
          </span>
        </Link>
      </header>

      <article className="mx-auto max-w-3xl px-6 pb-24 pt-6">
        {children}
      </article>
    </main>
  );
}
