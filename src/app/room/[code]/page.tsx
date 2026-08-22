"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useGameStore } from "@/store/useGameStore";
import { Formacao, NOMES_FORMACAO } from "@/lib/formacoes";
import { EstiloJogo, NOMES_ESTILO } from "@/lib/simulacao";

const FORMACOES_DISPONIVEIS: Formacao[] = ["4-3-3", "4-4-2", "3-5-2", "4-2-3-1", "5-3-2", "3-4-3"];

export default function LobbySalaPage() {
  const params = useParams<{ code: string }>();
  const codigo = params.code?.toUpperCase();
  const router = useRouter();

  const sala = useGameStore((s) => s.sala);
  const meuId = useGameStore((s) => s.meuId);
  const participantes = useGameStore((s) => s.participantes);
  const carregarSala = useGameStore((s) => s.carregarSala);
  const entrarNaSala = useGameStore((s) => s.entrarNaSala);
  const configurarJogador = useGameStore((s) => s.configurarJogador);
  const marcarPronto = useGameStore((s) => s.marcarPronto);
  const iniciarPartida = useGameStore((s) => s.iniciarPartida);
  const conectando = useGameStore((s) => s.conectando);
  const erro = useGameStore((s) => s.erro);

  const [apelido, setApelido] = useState("");
  const [formacao, setFormacao] = useState<Formacao>("4-3-3");
  const [estilo, setEstilo] = useState<EstiloJogo>("equilibrado");
  const [salvandoConfig, setSalvandoConfig] = useState(false);
  const [iniciando, setIniciando] = useState(false);

  const eu = participantes.find((p) => p.id === meuId);
  const jaEntrou = Boolean(meuId);
  const souHost = Boolean(sala && meuId && sala.hostId === meuId);
  const todosProntos = participantes.length > 0 && participantes.every((p) => Boolean(p.pronto));
  const configuracaoCompleta = Boolean(apelido.trim() && formacao && estilo);
  const podeFicarPronto = configuracaoCompleta && !salvandoConfig;

  useEffect(() => {
    if (!sala && codigo) carregarSala(codigo);
  }, [sala, codigo, carregarSala]);

  useEffect(() => {
    if (sala?.status === "draft" && meuId) {
      router.replace(`/room/${codigo}/jogar`);
    }
  }, [sala?.status, meuId, codigo, router]);

  useEffect(() => {
    if (!eu) return;
    setApelido((atual) => atual || eu.apelido || "");
    if (eu.formacao) setFormacao(eu.formacao);
    if (eu.estilo) setEstilo(eu.estilo);
  }, [eu?.id, eu?.apelido, eu?.formacao, eu?.estilo]);

  useEffect(() => {
    if (!jaEntrou || !apelido.trim() || !formacao || !estilo) return;
    const timer = window.setTimeout(() => {
      void configurarJogador({ apelido: apelido.trim(), formacao, estilo });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [jaEntrou, apelido, formacao, estilo, configurarJogador]);

  const statusTexto = useMemo(() => {
    if (!eu) return "CONFIGURE SEU TIME";
    return eu.pronto ? "VOCÊ ESTÁ PRONTO" : "AGUARDANDO PRONTO";
  }, [eu]);

  async function entrar() {
    if (!codigo || !apelido.trim()) return;
    await entrarNaSala(codigo, apelido.trim());
  }

  async function alternarPronto() {
    if (!eu?.pronto && !podeFicarPronto) return;
    setSalvandoConfig(true);
    try {
      if (!eu?.pronto) {
        const salvou = await configurarJogador({ apelido: apelido.trim(), formacao, estilo });
        if (!salvou) return;
      }
      await marcarPronto(!eu?.pronto);
    } finally {
      setSalvandoConfig(false);
    }
  }

  async function comecarPartida() {
    if (!souHost || !todosProntos || iniciando) return;
    setIniciando(true);
    const iniciou = await iniciarPartida();
    if (!iniciou) setIniciando(false);
  }

  if (!sala && conectando) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-ink/50">Conectando à sala…</main>;
  }

  if (!sala && !conectando) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-display text-2xl">Sala {codigo} não encontrada</h1>
        <p className="text-sm text-ink/60">{erro}</p>
        <a href="/room/join" className="text-brand underline">Tentar outro código</a>
      </main>
    );
  }

  if (!jaEntrou) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-5 px-6">
        <header>
          <p className="text-xs uppercase tracking-wide text-ink/50">Sala multiplayer</p>
          <h1 className="font-display text-3xl">Código {codigo}</h1>
        </header>

        <div className="rounded-card border border-ink/10 bg-card p-6 shadow-card">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase text-ink/50">Seu nome</span>
            <input
              autoFocus
              value={apelido}
              onChange={(e) => setApelido(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && entrar()}
              placeholder="JOGADOR"
              className="w-full rounded-lg border border-ink/10 bg-paper px-3 py-3 text-sm uppercase outline-none placeholder:text-ink/30 focus:border-brand"
            />
          </label>

          <button
            onClick={entrar}
            disabled={!apelido.trim() || conectando}
            className="mt-4 w-full rounded-lg bg-brand py-3 font-semibold text-card shadow-card disabled:opacity-50"
          >
            {conectando ? "Entrando…" : "ENTRAR NA SALA"}
          </button>
        </div>
        {erro && <p className="text-sm text-brand">{erro}</p>}
      </main>
    );
  }

  if (!sala) return null;

  const prontos = participantes.filter((p) => p.pronto).length;

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink/50">Sala multiplayer · {sala.config.modo}</p>
          <h1 className="font-display text-4xl tracking-wide">{codigo}</h1>
          <p className="mt-1 text-sm text-ink/50">{prontos}/{participantes.length} jogadores prontos</p>
        </div>
        <div className="rounded-lg border border-ink/10 bg-card px-4 py-2 text-right shadow-card">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-ink/40">Capacidade</p>
          <p className="font-semibold">{participantes.length}/{sala.config.capacidade}</p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-card border border-ink/10 bg-card p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Jogadores na sala</p>
              <p className="text-sm text-ink/50">A lista atualiza em tempo real.</p>
            </div>
            <span className="rounded-full bg-ink/5 px-3 py-1 text-xs font-semibold">{prontos} prontos</span>
          </div>

          <ul className="space-y-2">
            {participantes.map((p) => (
              <li key={p.id} className="rounded-xl border border-ink/10 bg-paper/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {p.apelido || "JOGADOR"} {p.id === meuId && <span className="font-normal text-ink/40">(você)</span>}
                      {p.id === sala.hostId && <span className="ml-2 text-xs font-semibold uppercase text-brand">HOST</span>}
                    </p>
                    <p className="mt-1 text-xs text-ink/50">
                      {p.formacao ?? "Formação não definida"} · {p.estilo ? NOMES_ESTILO[p.estilo] : "Estilo não definido"}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold uppercase ${p.pronto ? "bg-pitch/15 text-pitch" : "bg-ink/5 text-ink/40"}`}>
                    {p.pronto ? "✓ PRONTO" : "NÃO PRONTO"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-card border border-ink/10 bg-card p-5 shadow-card">
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Sua configuração</p>
            <h2 className="font-display text-2xl">{statusTexto}</h2>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block text-xs font-semibold uppercase text-ink/50">Nome</span>
            <input
              value={apelido}
              onChange={(e) => setApelido(e.target.value)}
              placeholder="JOGADOR"
              className="w-full rounded-lg border border-ink/10 bg-paper px-3 py-2.5 text-sm uppercase outline-none placeholder:text-ink/30 focus:border-brand"
            />
          </label>

          <fieldset className="mt-5">
            <legend className="mb-2 text-xs font-semibold uppercase text-ink/50">Formação</legend>
            <div className="grid grid-cols-2 gap-2">
              {FORMACOES_DISPONIVEIS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFormacao(f)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition ${formacao === f ? "border-brand bg-brand/10 font-semibold text-brand" : "border-ink/10 text-ink/70 hover:border-ink/30"}`}
                >
                  <span className="font-semibold">{f}</span>
                  <span className="mt-0.5 block text-[10px] text-ink/40">{NOMES_FORMACAO[f]}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-5">
            <legend className="mb-2 text-xs font-semibold uppercase text-ink/50">Estilo de jogo</legend>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(NOMES_ESTILO) as EstiloJogo[]).map((e) => (
                <button
                  key={e}
                  onClick={() => setEstilo(e)}
                  className={`rounded-lg border px-2 py-2.5 text-sm transition ${estilo === e ? "border-brand bg-brand/10 font-semibold text-brand" : "border-ink/10 text-ink/70 hover:border-ink/30"}`}
                >
                  {NOMES_ESTILO[e]}
                </button>
              ))}
            </div>
          </fieldset>

          <button
            onClick={alternarPronto}
            disabled={!eu?.pronto && !podeFicarPronto}
            className={`mt-6 w-full rounded-lg py-3 font-semibold shadow-card transition disabled:cursor-not-allowed disabled:opacity-40 ${eu?.pronto ? "bg-ink/10 text-ink" : "bg-pitch text-card hover:opacity-90"}`}
          >
            {salvandoConfig ? "SALVANDO…" : eu?.pronto ? "CANCELAR PRONTO" : "ESTOU PRONTO"}
          </button>

          {souHost && (
            <div className="mt-6 border-t border-ink/10 pt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/50">Controle do host</p>
              <button
                onClick={comecarPartida}
                disabled={!todosProntos || iniciando}
                className="w-full rounded-lg bg-brand py-3 font-semibold text-card shadow-card transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40"
              >
                {iniciando ? "INICIANDO…" : "COMEÇAR PARTIDA"}
              </button>
              <p className="mt-2 text-center text-xs text-ink/40">
                {todosProntos ? "Todos os jogadores estão prontos." : "O botão será liberado somente quando todos estiverem prontos."}
              </p>
            </div>
          )}

          {!souHost && (
            <p className="mt-5 text-center text-xs text-ink/40">Somente o HOST pode começar a partida.</p>
          )}
        </section>
      </div>

      {erro && <p className="rounded-lg border border-brand/20 bg-brand/5 px-4 py-3 text-sm text-brand">{erro}</p>}
    </main>
  );
}
