"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Campo } from "@/components/Campo";
import { Banco } from "@/components/Banco";
import { BoxScore } from "@/components/BoxScore";
import { ResumoOveralls } from "@/components/ResumoOveralls";
import { Torneio } from "@/components/Torneio";
import { BotaoTema } from "@/components/BotaoTema";
import { useDraft } from "@/hooks/useDraft";
import { ELENCOS_REAIS, ElencoSelecao, ANOS_VALIDOS_COPA, categoriasJogaveis, posicoesJogaveis } from "@/lib/squads";
import { Formacao, NOMES_FORMACAO } from "@/lib/formacoes";
import { EstiloJogo, NOMES_ESTILO, forcaDoTime, overallDoJogador } from "@/lib/simulacao";
import { ModoSala, PosicaoAmpla } from "@/types/game";

// Ordem de exibição da lista do elenco: goleiro, defesa, meio, ataque —
// sem dividir em seções/tópicos, só ordenando os mesmos itens da lista corrida.
const ORDEM_POSICAO_AMPLA: Record<PosicaoAmpla, number> = { GOL: 0, DEF: 1, MEI: 2, ATA: 3 };
const FORMACOES_DISPONIVEIS: Formacao[] = ["4-3-3", "4-4-2", "3-5-2", "4-2-3-1", "5-3-2", "3-4-3"];

type Fase = "setup" | "draft" | "torneio";

export default function SoloPage() {
  const [fase, setFase] = useState<Fase>("setup");
  const [formacao, setFormacao] = useState<Formacao>("4-3-3");
  const [estilo, setEstilo] = useState<EstiloJogo>("equilibrado");
  const [modo, setModo] = useState<ModoSala>("classico");

  const [elencos, setElencos] = useState<ElencoSelecao[]>(ELENCOS_REAIS);
  const [fonteCompleta, setFonteCompleta] = useState(false);

  useEffect(() => {
    fetch("/data/squads-full.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((dados: ElencoSelecao[] | null) => {
        if (dados && dados.length > 0) {
          const validos = dados.filter((e) => ANOS_VALIDOS_COPA.has(e.ano) && e.competicao === "Copa do Mundo" && e.jogadores?.length > 0);
          setElencos(validos);
          setFonteCompleta(true);
        }
      })
      .catch(() => {});
  }, []);

  const draft = useDraft(formacao);
  const [rolando, setRolando] = useState(false);
  const [squadAtual, setSquadAtual] = useState<ElencoSelecao | null>(null);
  const [rerolls, setRerolls] = useState(0);
  const limiteRerolls = modo === "classico" ? 3 : 1;
  const rerollsEsgotados = Boolean(squadAtual) && rerolls >= limiteRerolls;

  function elencosDisponiveis() {
    const disponiveis = elencos.filter((e) =>
      e.jogadores.some(
        (j) => !draft.usados.has(j.id) && !categoriasJogaveis(j).every((cat) => draft.categoriaEsgotada(cat)),
      ),
    );
    return disponiveis.length > 0 ? disponiveis : elencos;
  }

  function executarRolagem(escolher: () => ElencoSelecao) {
    if (draft.timeCompleto) return;
    setRolando(true);
    setTimeout(() => {
      setSquadAtual(escolher());
      setRolando(false);
    }, 500);
  }

  function outraSelecao() {
    if (rerollsEsgotados) return;
    if (squadAtual) setRerolls((r) => r + 1);
    executarRolagem(() => {
      const pool = elencosDisponiveis();
      return pool[Math.floor(Math.random() * pool.length)];
    });
  }

  function outraCopa() {
    if (rerollsEsgotados) return;
    if (squadAtual) setRerolls((r) => r + 1);
    executarRolagem(() => {
      const pool = elencosDisponiveis();
      const mesmaSelecao = squadAtual
        ? pool.filter((e) => e.selecao === squadAtual.selecao && e.id !== squadAtual.id)
        : [];
      const lista = mesmaSelecao.length > 0 ? mesmaSelecao : pool;
      return lista[Math.floor(Math.random() * lista.length)];
    });
  }

  function reiniciarRolagem() {
    setSquadAtual(null);
    // NÃO reinicia "rerolls" aqui — o limite vale pro draft inteiro, não
    // por jogador escolhido (senão dava pra sempre ter 3 de novo só
    // colocando alguém no time, o que anula o limite).
  }

  if (fase === "setup") {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-6 py-10">
        <header className="flex items-start justify-between">
          <div>
            <Link href="/" className="text-sm text-ink/50 hover:text-ink">
              ← voltar
            </Link>
            <h1 className="mt-2 font-display text-3xl">Antes de começar</h1>
          </div>
          <BotaoTema />
        </header>

        <div className="space-y-5 rounded-card border border-ink/10 bg-card p-6 shadow-card">
          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase text-ink/50">
              Formação
            </legend>
            <div className="space-y-2">
              {FORMACOES_DISPONIVEIS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFormacao(f)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                    formacao === f
                      ? "border-brand bg-brand/10 font-semibold text-brand"
                      : "border-ink/10 text-ink/70 hover:border-ink/30"
                  }`}
                >
                  <span className="font-semibold">{f}</span>
                  <span className="ml-2 text-ink/50">{NOMES_FORMACAO[f]}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase text-ink/50">
              Estilo de jogo
            </legend>
            <div className="space-y-2">
              {(Object.keys(NOMES_ESTILO) as EstiloJogo[]).map((e) => (
                <button
                  key={e}
                  onClick={() => setEstilo(e)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm capitalize transition ${
                    estilo === e
                      ? "border-brand bg-brand/10 font-semibold text-brand"
                      : "border-ink/10 text-ink/70 hover:border-ink/30"
                  }`}
                >
                  {NOMES_ESTILO[e]}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-xs font-semibold uppercase text-ink/50">
              Modo
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {(["classico", "almanaque"] as ModoSala[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setModo(m)}
                  className={`rounded-lg border px-3 py-2 text-sm capitalize transition ${
                    modo === m
                      ? "border-brand bg-brand/10 font-semibold text-brand"
                      : "border-ink/10 text-ink/70 hover:border-ink/30"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink/50">
              {modo === "classico"
                ? "Mostra o overall de cada jogador durante a escalação."
                : "Não mostra overall — só o nome, no estilo álbum de figurinha."}
            </p>
          </fieldset>

          <button
            onClick={() => setFase("draft")}
            className="w-full rounded-lg bg-brand py-3 font-semibold text-card shadow-card transition hover:bg-brand-dark"
          >
            Começar
          </button>
        </div>
      </main>
    );
  }

  if (fase === "draft") {
    const mostrarOverall = modo === "classico";

    if (draft.timeCompleto) {
      return (
        <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
          <p className="text-5xl">✅</p>
          <h1 className="font-display text-2xl">Time completo!</h1>
          <div className="mt-2 w-full rounded-card border border-ink/10 bg-card p-4 shadow-card">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink/50">Overall final do time</p>
            <ResumoOveralls slots={draft.slots} titulares={draft.titulares} mostrarValores />
          </div>
          <p className="text-sm text-ink/60">
            Sua escalação está pronta. Bora pra Copa do Mundo.
          </p>
          <button
            onClick={() => setFase("torneio")}
            className="rounded-lg bg-brand px-6 py-3 font-semibold text-card shadow-card hover:bg-brand-dark"
          >
            Iniciar Copa do Mundo 🏆
          </button>
        </main>
      );
    }

    return (
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
        <header className="flex items-center justify-between">
          <h1 className="font-display text-3xl">Monte seu time</h1>
          <p className="text-xs uppercase text-ink/40">
            {formacao} · {NOMES_ESTILO[estilo]} · {modo}
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[300px_1fr_300px]">
          <div className="space-y-4">
            <div className="rounded-card border border-ink/10 bg-card p-5 shadow-card">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-ink/40">
                {fonteCompleta
                  ? `✓ base completa (${elencos.length} elencos)`
                  : `base curada (${elencos.length} elencos)`}
              </p>
              <p className="mb-4 text-sm text-ink/60">
                {draft.selecionado
                  ? `Escolha onde colocar ${draft.selecionado.nome} (destacado em dourado).`
                  : squadAtual
                    ? rerollsEsgotados
                      ? "Rolagens acabaram — escolha alguém dessa seleção."
                      : `Clique num jogador, ou sorteie outra seleção/copa (restam ${limiteRerolls - rerolls}).`
                    : "Role para sortear uma seleção e clique num jogador da lista."}
              </p>

              {!squadAtual ? (
                <button
                  onClick={outraSelecao}
                  disabled={rolando}
                  className="w-full rounded-lg bg-brand py-3 font-semibold text-card shadow-card transition hover:bg-brand-dark disabled:opacity-60"
                >
                  {rolando ? "Rolando…" : "Rolar 🎲"}
                </button>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={outraSelecao}
                    disabled={rolando || rerollsEsgotados}
                    className="w-full rounded-lg bg-brand py-2.5 font-semibold text-card shadow-card transition hover:bg-brand-dark disabled:opacity-40"
                  >
                    {rolando ? "Rolando…" : "OUTRA SELEÇÃO"}
                  </button>
                  <button
                    onClick={outraCopa}
                    disabled={rolando || rerollsEsgotados}
                    className="w-full rounded-lg border border-brand bg-brand/5 py-2.5 font-semibold text-brand shadow-card transition hover:bg-brand/10 disabled:opacity-40"
                  >
                    {rolando ? "Rolando…" : "OUTRA COPA"}
                  </button>
                </div>
              )}

              <AnimatePresence mode="wait">
                {squadAtual && (
                  <motion.div
                    key={squadAtual.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 rounded-lg border border-brand/30 bg-brand/5 p-3"
                  >
                    <p className="text-xs uppercase tracking-wide text-ink/50">Saiu</p>
                    <p className="font-display text-xl text-brand">
                      {squadAtual.sigla} {squadAtual.selecao}
                    </p>
                    <p className="text-xs text-ink/50">
                      {squadAtual.competicao} {squadAtual.ano}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {squadAtual && (
              <div className="rounded-card border border-ink/10 bg-card p-4 shadow-card">
                <p className="mb-2 text-xs font-semibold uppercase text-ink/50">
                  Elenco — clique num jogador
                </p>
                <ul className="max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
                  {[...squadAtual.jogadores]
                    .sort((a, b) => ORDEM_POSICAO_AMPLA[a.posicao] - ORDEM_POSICAO_AMPLA[b.posicao])
                    .map((jogador) => {
                    const categorias = categoriasJogaveis(jogador);
                    const esgotada = categorias.every((cat) => draft.categoriaEsgotada(cat));
                    const usado = draft.usados.has(jogador.id);
                    const bloqueado = esgotada || usado;
                    const ativo = draft.selecionado?.id === jogador.id;
                    const especificas = posicoesJogaveis(jogador);
                    const rotuloPosicao = especificas
                      ? especificas.length > 2
                        ? `${especificas.slice(0, 2).join("/")}+${especificas.length - 2}`
                        : especificas.join("/")
                      : jogador.posicao;
                    return (
                      <li key={jogador.id}>
                        <button
                          onClick={() => draft.selecionarJogador(jogador)}
                          disabled={bloqueado}
                          className={`flex w-full items-center justify-between rounded border px-3 py-2.5 text-base transition ${
                            bloqueado
                              ? "cursor-not-allowed border-ink/5 bg-ink/5 text-ink/25"
                              : ativo
                                ? "border-gold bg-gold/10 font-semibold"
                                : "border-ink/10 bg-paper hover:border-brand"
                          }`}
                        >
                          <span className="truncate">{jogador.nome}</span>
                          <span className="flex shrink-0 items-center gap-2 pl-2">
                            <span className="text-xs font-semibold uppercase text-ink/40">
                              {rotuloPosicao}
                            </span>
                            <span className="font-semibold text-brand">
                              {mostrarOverall ? overallDoJogador(jogador) : "?"}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          <div className="flex flex-col items-center gap-4">
            <Campo
              slots={draft.slots}
              titulares={draft.titulares}
              slotsDestacados={draft.destacados}
              mostrarOverall={mostrarOverall}
              onSlotClick={(slotKey, posicao) => {
                const ocupante = draft.titulares[slotKey];
                if (ocupante) {
                  draft.selecionarJogadorColocado(ocupante, { tipo: "titular", slotKey });
                } else {
                  draft.colocarNoTitular(slotKey, posicao, reiniciarRolagem);
                }
              }}
            />
            <div className="w-full max-w-md">
              <Banco
                reservas={draft.reservas}
                slotsDestacados={draft.destacados}
                mostrarOverall={mostrarOverall}
                onSlotClick={(categoria, indice) => {
                  const ocupante = draft.reservas[categoria][indice];
                  if (ocupante) {
                    draft.selecionarJogadorColocado(ocupante, { tipo: "reserva", categoria, indice });
                  } else {
                    draft.colocarNaReserva(categoria, indice, reiniciarRolagem);
                  }
                }}
              />
            </div>
          </div>

          <BoxScore slots={draft.slots} titulares={draft.titulares} mostrarOverall={mostrarOverall} />
        </div>
      </main>
    );
  }

  const forcaJogador = forcaDoTime([
    ...Object.values(draft.titulares),
    ...Object.values(draft.reservas).flat(),
  ]);

  return (
    <Torneio
      nomeTime="Seu Time"
      slots={draft.slots}
      titulares={draft.titulares}
      reservas={draft.reservas}
      forcaJogador={forcaJogador}
      estilo={estilo}
      elencosDisponiveis={elencos}
      modoTorneio="solo"
      onFimDaCopa={() => {
        setFase("setup");
        setSquadAtual(null);
      }}
    />
  );
}
