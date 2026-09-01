"use client";

import { ReactNode, useEffect, useState } from "react";
import { loadOverallOverrides, overallOverridesEvent } from "@/lib/overallOverrides";

export function OverallOverridesProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [, setVersao] = useState(0);

  useEffect(() => {
    let ativo = true;

    loadOverallOverrides().finally(() => {
      if (ativo) setReady(true);
    });

    const atualizar = () => setVersao((v) => v + 1);
    window.addEventListener(overallOverridesEvent, atualizar);

    return () => {
      ativo = false;
      window.removeEventListener(overallOverridesEvent, atualizar);
    };
  }, []);

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-paper px-6 text-center">
        <div>
          <div className="text-3xl">⚽</div>
          <p className="mt-3 text-sm text-ink/55">Carregando configurações dos jogadores…</p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
