"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/store/useGameStore";
import { ConfiguracaoSala, ModoSala } from "@/types/game";

export default function CriarSalaPage() {
  const router = useRouter();
  const criarSala = useGameStore((s) => s.criarSala);
  const erro = useGameStore((s) => s.erro);
  const conectando = useGameStore((s) => s.conectando);

  const [modo, setModo] = useState<ModoSala>("classico");
  const [capacidade, setCapacidade] = useState<4 | 8 | 16>(8);
  const [senha, setSenha] = useState("");
  const [publica, setPublica] = useState(true);
  const [tempoDraft, setTempoDraft] = useState(300);

  async function handleCriarSala() {
    const config: ConfiguracaoSala = {
      modo,
      capacidade,
      senha: senha || undefined,
      publica,
      tempoDraftSegundos: tempoDraft,
    };
    const codigo = await criarSala(config);
    if (codigo) router.push(`/room/${codigo}`);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-6 py-10">
      <h1 className="font-display text-3xl">Criar sala</h1>

      <div className="space-y-5 rounded-card border border-ink/10 bg-card p-6 shadow-card">
        <fieldset>
          <legend className="mb-2 text-xs font-semibold uppercase text-ink/50">
            Modo
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {(["classico", "almanaque"] as ModoSala[]).map((opcao) => (
              <button
                key={opcao}
                onClick={() => setModo(opcao)}
                className={`rounded-lg border px-3 py-2 text-sm capitalize transition ${
                  modo === opcao
                    ? "border-brand bg-brand/10 font-semibold text-brand"
                    : "border-ink/10 text-ink/70 hover:border-ink/30"
                }`}
              >
                {opcao}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-xs font-semibold uppercase text-ink/50">
            Quantidade de jogadores
          </legend>
          <div className="grid grid-cols-3 gap-2">
            {([4, 8, 16] as const).map((opcao) => (
              <button
                key={opcao}
                onClick={() => setCapacidade(opcao)}
                className={`rounded-lg border px-3 py-2 text-sm transition ${
                  capacidade === opcao
                    ? "border-brand bg-brand/10 font-semibold text-brand"
                    : "border-ink/10 text-ink/70 hover:border-ink/30"
                }`}
              >
                {opcao}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="block text-sm">
          <span className="mb-1 block text-xs font-semibold uppercase text-ink/50">
            Senha (opcional)
          </span>
          <input
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="deixe em branco para sala sem senha"
            className="w-full rounded-lg border border-ink/10 bg-paper px-3 py-2 text-sm outline-none focus:border-brand"
          />
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={publica}
            onChange={(e) => setPublica(e.target.checked)}
          />
          Sala pública (aparece na listagem)
        </label>

        <fieldset>
          <legend className="mb-2 text-xs font-semibold uppercase text-ink/50">Tempo de escolha</legend>
          <div className="grid grid-cols-3 gap-2">
            {([2, 5, 8] as const).map((minutos) => {
              const segundos = minutos * 60;
              return (
                <button
                  key={minutos}
                  onClick={() => setTempoDraft(segundos)}
                  className={`rounded-lg border px-3 py-3 text-sm transition ${
                    tempoDraft === segundos
                      ? "border-brand bg-brand/10 font-semibold text-brand"
                      : "border-ink/10 text-ink/70 hover:border-ink/30"
                  }`}
                >
                  {minutos} min
                </button>
              );
            })}
          </div>
        </fieldset>

        {erro && <p className="text-sm text-brand">{erro}</p>}

        <button
          onClick={handleCriarSala}
          disabled={conectando}
          className="w-full rounded-lg bg-brand py-3 font-semibold text-card shadow-card transition hover:bg-brand-dark disabled:opacity-60"
        >
          {conectando ? "Criando…" : "Criar sala"}
        </button>
      </div>

      <p className="text-center text-sm text-ink/50">
        Já tem um código?{" "}
        <Link href="/room/join" className="font-semibold text-brand underline">
          Entrar em uma sala
        </Link>
      </p>
    </main>
  );
}
