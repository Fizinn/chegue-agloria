"use client";
import { NOMES_ESTILO } from "@/lib/simulacao";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Campo } from "@/components/Campo";
import { Banco } from "@/components/Banco";
import { BoxScore } from "@/components/BoxScore";
import { ResumoOveralls } from "@/components/ResumoOveralls";
import { Torneio } from "@/components/Torneio";
import { useDraft } from "@/hooks/useDraft";
import { useGameStore } from "@/store/useGameStore";
import { ELENCOS_REAIS, ElencoSelecao, JogadorReal, ANOS_VALIDOS_COPA, categoriasJogaveis, posicoesJogaveis } from "@/lib/squads";
import { Formacao } from "@/lib/formacoes";
import { EstiloJogo, forcaDoTime, overallDoJogador } from "@/lib/simulacao";
import { PosicaoAmpla } from "@/types/game";


type Fase = "draft" | "torneio";

// Ordem de exibição da lista do elenco: goleiro, defesa, meio, ataque —
// sem dividir em seções/tópicos, só ordenando os mesmos itens da lista corrida.
const ORDEM_POSICAO_AMPLA: Record<PosicaoAmpla, number> = { GOL: 0, DEF: 1, MEI: 2, ATA: 3 };

function formatarTempo(segundos: number) {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function JogarNaSalaPage() {


  const params = useParams<{ code: string }>();
  const codigo = params.code?.toUpperCase();
  const router = useRouter();

  const sala = useGameStore((s) => s.sala);
const meuId = useGameStore((s) => s.meuId);
const apelido = useGameStore((s) => s.apelido);
const participantes = useGameStore((s) => s.participantes);

const atualizarStatus = useGameStore((s) => s.atualizarStatus);
const concluirDraft = useGameStore((s) => s.concluirDraft);
const resetarProprioDraft = useGameStore((s) => s.resetarProprioDraft);
const eu = participantes.find((p) => p.id === meuId);
const revelarCopa = useGameStore((s) => s.revelarCopa);

const todosTerminaram =
  participantes.length > 0 &&
  participantes.every((p) => p.fase === "aguardando_copa");

const [verMeuTime, setVerMeuTime] = useState(false);

  useEffect(() => {
    // A partida só pode ser acessada depois que o host inicia a sala.
    if (!meuId) {
      router.replace(`/room/${codigo}`);
      return;
    }
    if (sala && sala.status === "lobby") {
      router.replace(`/room/${codigo}`);
    }
  }, [meuId, sala?.status, codigo, router]);

  useEffect(() => {
    if (sala?.status === "em_andamento") setFase("torneio");
  }, [sala?.status]);

  useEffect(() => {
    if (eu?.formacao) setFormacao(eu.formacao);
    if (eu?.estilo) setEstilo(eu.estilo);
  }, [eu?.formacao, eu?.estilo]);

  const mostrarOverall = sala?.config.modo !== "almanaque";

  const [fase, setFase] = useState<Fase>("draft");
  const [formacao, setFormacao] = useState<Formacao>(eu?.formacao ?? "4-3-3");
  const [estilo, setEstilo] = useState<EstiloJogo>(eu?.estilo ?? "equilibrado");

  const [elencos, setElencos] = useState<ElencoSelecao[]>(ELENCOS_REAIS);
  useEffect(() => {
    fetch("/data/squads-full.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((dados: ElencoSelecao[] | null) => {
        if (dados && dados.length > 0) {
          setElencos(dados.filter((e) => ANOS_VALIDOS_COPA.has(e.ano) && e.competicao === "Copa do Mundo" && e.jogadores?.length > 0));
        }
      })
      .catch(() => {});
  }, []);

  // Todo mundo na sala joga a MESMA Copa do Mundo (mesmo ano) — só os
  // adversários/chaves de cada jogador são diferentes. O ano é sorteado
  // uma vez pelo host em "REVELAR COPA" e fica salvo em sala.config.
  const anoCopa = sala?.config.anoCopa;
  const elencosDaCopa = anoCopa ? elencos.filter((e) => e.ano === anoCopa) : elencos;
  const elencosTorneio = elencosDaCopa.length > 0 ? elencosDaCopa : elencos;

  const souHost = Boolean(sala && meuId && sala.hostId === meuId);
  const hostParticipante = participantes.find((p) => p.id === sala?.hostId);
  const rodadaLiberadaPeloHost = hostParticipante?.rodadaLiberada ?? -1;

  const draft = useDraft(formacao);

  const resetouDraftRef = useRef(false);
  useEffect(() => {
    // Assim que a partida vira "draft", cada jogador zera o PRÓPRIO status
    // (que pode ter ficado "pronto"/"aguardando_copa" de trás do "ESTOU
    // PRONTO" da sala de espera). Só faz isso uma vez por partida e nunca
    // depois que o time já está de fato completo, pra não conflitar com o
    // concluirDraft.
    if (!sala || sala.status !== "draft" || !meuId) return;
    if (draft.timeCompleto) return;
    if (resetouDraftRef.current) return;
    if (eu?.pronto || eu?.fase === "aguardando_copa") {
      resetouDraftRef.current = true;
      void resetarProprioDraft();
    }
  }, [sala?.status, meuId, draft.timeCompleto, eu?.pronto, eu?.fase, resetarProprioDraft]);

  useEffect(() => {
    if (!draft.timeCompleto || !meuId || !sala) return;
    if (eu?.pronto) return;
    const forca = forcaDoTime([
      ...Object.values(draft.titulares),
      ...Object.values(draft.reservas).flat(),
    ]);
    void concluirDraft(forca);
  }, [draft.timeCompleto, meuId, sala, eu?.pronto, draft.titulares, draft.reservas, concluirDraft]);
  const [rolando, setRolando] = useState(false);
  const [squadAtual, setSquadAtual] = useState<ElencoSelecao | null>(null);
  const [rerolls, setRerolls] = useState(0);
  const limiteRerolls = sala?.config.modo === "almanaque" ? 1 : 3;
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
    // por jogador escolhido.
  }

  // Barra de tempo do draft: contagem regressiva a partir do tempo
  // configurado pelo host na criação da sala (mesmo valor pra todo mundo).
  const tempoTotalSegundos = sala?.config.tempoDraftSegundos ?? 300;
  const [tempoRestante, setTempoRestante] = useState(tempoTotalSegundos);

  useEffect(() => {
    if (sala?.status !== "draft" || draft.timeCompleto || eu?.pronto) return;
    const inicio = Date.now();
    setTempoRestante(tempoTotalSegundos);
    const intervalo = setInterval(() => {
      const passado = Math.floor((Date.now() - inicio) / 1000);
      setTempoRestante(Math.max(0, tempoTotalSegundos - passado));
    }, 1000);
    return () => clearInterval(intervalo);
  }, [sala?.status, draft.timeCompleto, eu?.pronto, tempoTotalSegundos]);

  // Quando o tempo acaba, o jogador é considerado pronto com o time que
  // conseguiu montar até ali (mesmo incompleto) — sem isso a barra chegava
  // a 0 e ficava lá, sem nunca avançar pra tela de aguardar/revelar a Copa.
  useEffect(() => {
    if (tempoRestante > 0) return;
    if (!meuId || !sala || sala.status !== "draft") return;
    if (eu?.pronto) return;
    const forca = forcaDoTime([
      ...Object.values(draft.titulares),
      ...Object.values(draft.reservas).flat(),
    ]);
    void concluirDraft(forca);
  }, [tempoRestante, meuId, sala, eu?.pronto, draft.titulares, draft.reservas, concluirDraft]);

  if (!sala || !meuId) return null;

  if (fase === "draft") {
    // Mostra a tela de espera tanto quando o time ficou completo quanto
    // quando o tempo acabou e o jogador foi marcado pronto automaticamente
    // (ver efeito acima) — só olhar "draft.timeCompleto" deixava quem não
    // tinha terminado de escalar preso na tela de montar time pra sempre.
    if ((draft.timeCompleto || eu?.pronto) && sala.status !== "em_andamento") {
      const forcaJogador = forcaDoTime([
        ...Object.values(draft.titulares),
        ...Object.values(draft.reservas).flat(),
      ]);
      return (
        <main className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-5 px-6 py-10">
          <div className="w-full max-w-2xl rounded-card border border-ink/10 bg-card p-6 text-center shadow-card">
            <p className="text-5xl">⏳</p>
            <h1 className="mt-3 font-display text-3xl">AGUARDANDO</h1>
            <p className="mt-2 text-sm text-ink/60">Esperando todos os participantes terminarem seus times.</p>

            <div className="mt-6 space-y-2 text-left">
              {participantes.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-ink/10 bg-paper px-3 py-2">
                  <span className="font-semibold">{p.apelido || "JOGADOR"}{p.id === meuId ? " (você)" : ""}</span>
                  <span className={`text-xs font-bold ${p.pronto ? "text-pitch" : "text-ink/40"}`}>
                    {p.pronto ? "✓ PRONTO" : "⏳ MONTANDO"}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setVerMeuTime((v) => !v)}
              className="mt-5 w-full rounded-lg border border-brand bg-brand/5 py-3 font-semibold text-brand"
            >
              {verMeuTime ? "Fechar Meu Time" : "Ver Meu Time"}
            </button>

            {verMeuTime && (
              <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_300px] text-left">
                <div>
                  <Campo
                    slots={draft.slots}
                    titulares={draft.titulares}
                    slotsDestacados={new Set()}
                    mostrarOverall={mostrarOverall}
                    onSlotClick={() => {}}
                  />
                </div>
                <BoxScore slots={draft.slots} titulares={draft.titulares} mostrarOverall={mostrarOverall} />
              </div>
            )}

            {sala.hostId === meuId && todosTerminaram && (
              <button
                onClick={() => void revelarCopa()}
                className="mt-5 w-full rounded-lg bg-brand py-3 font-semibold text-card shadow-card hover:bg-brand-dark"
              >
                🌎 REVELAR COPA
              </button>
            )}

            {sala.hostId === meuId && !todosTerminaram && (
              <p className="mt-4 text-xs text-ink/40">O botão de revelar aparece quando todos terminarem.</p>
            )}
          </div>
        </main>
      );
    }

    return (
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
        <div className="sticky top-0 z-20 -mx-6 mb-2 bg-card/95 px-6 py-2.5 shadow-card backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-ink/50">
              Tempo pra escalar
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink/10">
              <div
                className={`h-full transition-[width] duration-1000 ease-linear ${
                  tempoRestante <= 30 ? "bg-brand" : "bg-pitch"
                }`}
                style={{ width: `${Math.max(0, (tempoRestante / tempoTotalSegundos) * 100)}%` }}
              />
            </div>
            <span
              className={`shrink-0 font-mono text-sm font-bold tabular-nums ${
                tempoRestante <= 30 ? "text-brand" : "text-ink"
              }`}
            >
              {formatarTempo(tempoRestante)}
            </span>
          </div>
        </div>

        <header className="flex items-center justify-between">
          <h1 className="font-display text-3xl">Monte seu time</h1>
          <p className="text-xs uppercase text-ink/40">
            {formacao} · {NOMES_ESTILO[estilo]} · sala {codigo}
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[300px_1fr_300px]">
          <div className="space-y-4">
            <div className="rounded-card border border-ink/10 bg-card p-5 shadow-card">
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
                if (ocupante && draft.selecionado && draft.selecionado.id !== ocupante.id) {
                  // Já tem alguém selecionado (do banco ou outro titular):
                  // tenta colocar ele aqui, trocando de lugar com quem já
                  // está no slot, em vez de só re-selecionar o ocupante.
                  draft.colocarNoTitular(slotKey, posicao, reiniciarRolagem);
                } else if (ocupante) {
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
                  if (ocupante && draft.selecionado && draft.selecionado.id !== ocupante.id) {
                    draft.colocarNaReserva(categoria, indice, reiniciarRolagem);
                  } else if (ocupante) {
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

  // A posição de cada jogador na chave vem do sorteio feito uma vez em
  // "REVELAR COPA" (sala.config.chaveamento) — não da ordem de entrada na
  // sala, senão os confrontos seriam sempre os mesmos toda partida. Se por
  // algum motivo a chave ainda não chegou (config antiga/corrida), cai de
  // volta pra ordem do banco só pra não travar a tela.
  const chaveamento = sala.config.chaveamento;
  const indiceChaveDe = (id: string) => {
    const posicao = chaveamento?.indexOf(id) ?? -1;
    if (posicao >= 0) return posicao;
    return Math.max(0, participantes.findIndex((p) => p.id === id));
  };
  const indiceChave = indiceChaveDe(meuId);
  const rivaisMultiplayer = participantes
    .map((p) => ({
      id: p.id,
      apelido: p.apelido,
      forcaTime: p.forcaTime as number | undefined,
      estilo: p.estilo,
      rodadaAtual: p.rodadaAtual ?? 0,
      indiceChave: indiceChaveDe(p.id),
      eliminado: Boolean(p.eliminado),
      vencedorNome: p.vencedorNome,
      vencedorForca: p.vencedorForca,
      vencedorJogadores: p.vencedorJogadores,
      vencedorSigla: p.vencedorSigla,
      vencedorAno: p.vencedorAno,
    }))
    .filter((p) => p.id !== meuId && p.forcaTime !== undefined);

  return (
    <Torneio
      nomeTime={apelido ?? "Seu Time"}
      slots={draft.slots}
      titulares={draft.titulares}
      reservas={draft.reservas}
      forcaJogador={forcaJogador}
      estilo={estilo}
      elencosDisponiveis={elencosTorneio}
      modoTorneio="multiplayer"
      capacidadeSala={sala.config.capacidade}
      rivaisMultiplayer={rivaisMultiplayer as { id: string; apelido: string; forcaTime: number; estilo?: EstiloJogo | null; rodadaAtual: number; indiceChave: number; eliminado: boolean; vencedorNome?: string; vencedorForca?: number; vencedorJogadores?: JogadorReal[]; vencedorSigla?: string; vencedorAno?: number }[]}
      indiceChave={indiceChave}
      souHost={souHost}
      rodadaLiberadaPeloHost={rodadaLiberadaPeloHost}
      meuId={meuId}
      codigoSala={sala.codigo}
      onLiberarRodada={(rodada) => atualizarStatus({ rodadaLiberada: rodada })}
      onMudarRodada={(rodada) => atualizarStatus({ rodadaAtual: rodada, eliminado: false, vencedorNome: apelido ?? "Seu Time", vencedorForca: forcaJogador, vencedorJogadores: Object.values(draft.titulares).filter(Boolean) as JogadorReal[] })}
      onEliminarRodada={(rodada, vencedor) => atualizarStatus({ eliminado: true, vencedorNome: vencedor.nome, vencedorForca: vencedor.forca, vencedorJogadores: vencedor.jogadores, vencedorSigla: vencedor.sigla, vencedorAno: vencedor.ano })}
      onFimDaCopa={() => {
        atualizarStatus({ fase: "lobby", rodadaAtual: 0 });
        router.push(`/room/${codigo}`);
      }}
    />
  );
}
