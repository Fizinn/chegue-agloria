"use client";

import Link from "next/link";

export function AdminOverallButton() {
  return (
    <Link
      href="/admin/overalls"
      title="Área administrativa"
      className="fixed bottom-3 right-3 z-[60] flex h-9 w-9 items-center justify-center rounded-full border border-ink/10 bg-card/80 text-sm text-ink/45 shadow-card backdrop-blur transition hover:scale-105 hover:text-brand"
      aria-label="Abrir área administrativa"
    >
      ⚙
    </Link>
  );
}
