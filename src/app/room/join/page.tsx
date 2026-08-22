"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/useGameStore";

export default function EntrarSalaPage() {
  const router = useRouter();
  const carregarSala = useGameStore((s) => s.carregarSala);
  const erro = useGameStore((s) => s.erro);
  const conectando = useGameStore((s) => s.conectando);

  const [codigo, setCodigo] = useState("");

  async function confirmar() {
    if (!codigo.trim()) return;
    const encontrou = await carregarSala(codigo);
    if (encontrou) router.push(`/room/${codigo.trim().toUpperCase()}`);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-6">
      <h1 className="font-display text-3xl">Entrar em uma sala</h1>
      <label className="block text-sm">
        <span className="mb-1 block text-xs font-semibold uppercase text-ink/50">
          Código da sala
        </span>
        <input
          autoFocus
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && confirmar()}
          placeholder="ex: X7K2M"
          maxLength={8}
          className="w-full rounded-lg border border-ink/10 bg-paper px-3 py-2 text-center font-mono text-lg tracking-[0.3em] outline-none focus:border-brand"
        />
      </label>

      {erro && <p className="text-sm text-brand">{erro}</p>}

      <button
        onClick={confirmar}
        disabled={!codigo.trim() || conectando}
        className="w-full rounded-lg bg-brand py-3 font-semibold text-card shadow-card disabled:opacity-50"
      >
        {conectando ? "Procurando…" : "Continuar"}
      </button>

      <p className="text-center text-sm text-ink/50">
        Não tem uma sala ainda?{" "}
        <a href="/room/create" className="font-semibold text-brand underline">
          Criar sala
        </a>
      </p>
    </main>
  );
}
