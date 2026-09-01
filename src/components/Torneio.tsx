"use client";

import { useEffect, useMemo, useState } from "react";
import { ElencoSelecao, JogadorReal } from "@/lib/squads";
import { SlotFormacao } from "@/lib/formacoes";
import { PosicaoAmpla } from "@/types/game";
import { EstiloJogo, ResultadoPartida, VelocidadeJogo, NOMES_VELOCIDADE, forcaElencoAleatorio } from "@/lib/simulacao";
import { seedDaPartida } from "@/lib/rng";
import { simularPartidaCompletaDeterministica, TipoEventoDeterministico } from "@/lib/simulacaoDeterministica";
import { Evento, EventoResultadoDeterministico, PartidaAoVivo, ResultadoDeterministico } from "@/components/PartidaAoVivo";
import { CardCampeao } from "@/components/CardCampeao";
import { BotaoTema } from "@/components/BotaoTema";
import { ResumoOveralls } from "@/components/ResumoOveralls";

const FASES_MULTIPLAYER = ["Oitavas de Final", "Quartas de Final", "Semifinal", "Final"];
const FASES_MULTI_CURTAS = ["OITAVAS", "QUARTAS", "SEMI", "FINAL"];
const FASES_SOLO = ["Fase de Grupos", "16 avos de Final", "Oitavas de Final", "Quartas de Final", "Semifinal", "Final"];
const FASES_SOLO_CURTAS = ["GRUPOS", "16 AVOS", "OITAVAS", "QUARTAS", "SEMI", "FINAL"];

type ModoTorneio = "solo" | "multiplayer";

interface RivalMultiplayer {
  id: string;
  apelido: string;
  forcaTime: number;
  estilo?: EstiloJogo | null;
  rodadaAtual: number;
  indiceChave: number;
  eliminado: boolean;
  vencedorNome?: string;
  vencedorForca?: number;
  vencedorJogadores?: JogadorReal[];
  vencedorSigla?: string;
  vencedorAno?: number;
}
interface Adversario { nome: string; forca: number; real: boolean; jogadores?: JogadorReal[]; sigla?: string; ano?: number; id?: string; estilo?: EstiloJogo | null; }
interface TorneioProps {
  nomeTime: string;
  slots: SlotFormacao[];
  titulares: Record<string, JogadorReal | null>;
  reservas: Record<PosicaoAmpla, (JogadorReal | null)[]>;
  forcaJogador: number;
  estilo: EstiloJogo;
  elencosDisponiveis: ElencoSelecao[];
  onFimDaCopa: () => void;
  rivaisMultiplayer?: RivalMultiplayer[];
  onMudarRodada?: (rodada: number) => void;
  modoTorneio?: ModoTorneio;
  /** Tamanho da sala (4, 8 ou 16) — define em qual fase o mata-mata do
   * multiplayer começa: 4 = semifinal, 8 = quartas, 16 = oitavas. */
  capacidadeSala?: 4 | 8 | 16;
  souHost?: boolean;
  rodadaLiberadaPeloHost?: number;
  onLiberarRodada?: (rodada: number) => void;
  onEliminarRodada?: (rodada: number, vencedor: { nome: string; forca: number; jogadores?: JogadorReal[]; sigla?: string; ano?: number }) => void;
  indiceChave?: number;
  /** Necessários pra gerar a seed compartilhada da partida quando o
   * adversário é outro jogador real — ver src/lib/rng.ts. */
  meuId?: string;
  codigoSala?: string;
}
interface RodadaHistorico { fase: string; adversario: string; adversarioSigla?: string; adversarioAno?: number; adversarioJogadores?: JogadorReal[]; resultado: ResultadoPartida; eventos: Evento[]; }

export function Torneio({
  nomeTime, slots, titulares, reservas, forcaJogador, estilo, elencosDisponiveis,
  onFimDaCopa, rivaisMultiplayer, onMudarRodada, modoTorneio = "multiplayer",
  capacidadeSala, souHost = false, rodadaLiberadaPeloHost = -1, onLiberarRodada, onEliminarRodada, indiceChave = 0,
  meuId, codigoSala,
}: TorneioProps) {
  const solo = modoTorneio === "solo";
  // 4 jogadores na sala = só dá pra ter uma semifinal (2 jogos) + final;
  // 8 = quartas + semi + final; 16 (padrão) = chave completa desde as oitavas.
  const faseInicialMultiplayer = capacidadeSala === 4 ? 2 : capacidadeSala === 8 ? 1 : 0;
  const fases = solo ? FASES_SOLO : FASES_MULTIPLAYER.slice(faseInicialMultiplayer);
  const fasesCurtas = solo ? FASES_SOLO_CURTAS : FASES_MULTI_CURTAS.slice(faseInicialMultiplayer);
  const [rodada, setRodada] = useState(0);
  const [jogoGrupo, setJogoGrupo] = useState(0);
  const [pontosGrupo, setPontosGrupo] = useState(0);
  const [saldoGrupo, setSaldoGrupo] = useState(0);
  const [historico, setHistorico] = useState<RodadaHistorico[]>([]);
  const [status, setStatus] = useState<"aguardando" | "jogando" | "resultado" | "eliminado" | "fim">("aguardando");
  const [campeao, setCampeao] = useState(false);
  const [ultimoResultado, setUltimoResultado] = useState<ResultadoPartida | null>(null);
  const [expandido, setExpandido] = useState<number | null>(null);
  const [velocidade, setVelocidade] = useState<VelocidadeJogo>("normal");
  const [configAberta, setConfigAberta] = useState(false);
  const [mostrarCard, setMostrarCard] = useState(false);
  // Só usado pelo host quando ele é eliminado mas precisa continuar
  // liberando as próximas rodadas pro resto do grupo.
  const [rodadaLiberadaAposEliminacao, setRodadaLiberadaAposEliminacao] = useState(rodada);

  useEffect(() => {
    if (solo || souHost) return;
    if (status !== "aguardando") return;
    if (rodada <= rodadaLiberadaPeloHost) {
      setStatus("jogando");
    }
  }, [rodadaLiberadaPeloHost, rodada, solo, souHost, status]);

  const adversario = useMemo<Adversario>(() => {
    const nomesUsados = new Set(historico.map((h) => h.adversario));

    if (!solo) {
      // Chave fixa: a posição do jogador nunca muda. Na rodada seguinte,
      // enfrentamos o vencedor do bloco paralelo, em vez de sortear outro
      // adversário aleatoriamente.
      const rivais = rivaisMultiplayer ?? [];
      const tamanhoSala = capacidadeSala ?? 16;
      const tamanhoDoBloco = 2 ** (rodada + 1);
      const inicioBloco = Math.floor(indiceChave / tamanhoDoBloco) * tamanhoDoBloco;
      const metade = tamanhoDoBloco / 2;
      const offset = indiceChave - inicioBloco;
      const inicioAdversario = offset < metade ? inicioBloco + metade : inicioBloco;
      const fimAdversario = inicioAdversario + metade;

      const vencedorReal = rivais.find(
        (r) => r.indiceChave >= inicioAdversario && r.indiceChave < fimAdversario && r.rodadaAtual === rodada,
      );
      if (vencedorReal) {
        return { nome: vencedorReal.apelido, forca: vencedorReal.forcaTime, real: true, id: vencedorReal.id, estilo: vencedorReal.estilo };
      }

      // Não deixe o jogador começar a final enquanto alguém do outro lado
      // ainda está na rodada anterior.
      const aguardandoVencedor = rivais.some(
        (r) => r.indiceChave >= inicioAdversario && r.indiceChave < fimAdversario && r.rodadaAtual === rodada - 1 && !r.eliminado,
      );
      if (aguardandoVencedor) {
        return { nome: "Aguardando vencedor da outra partida", forca: 0, real: true };
      }

      // Se um jogador daquele bloco perdeu para uma seleção, ele publica o
      // vencedor da partida. Assim a seleção que eliminou o jogador é levada
      // para a próxima fase (ex.: Argentina 1994), em vez de ser substituída
      // por uma seleção aleatória.
      const vencedorHistorico = rivais.find(
        (r) =>
          r.indiceChave >= inicioAdversario &&
          r.indiceChave < fimAdversario &&
          r.rodadaAtual === rodada - 1 &&
          r.eliminado &&
          r.vencedorNome,
      );
      if (vencedorHistorico?.vencedorNome) {
        return {
          nome: vencedorHistorico.vencedorNome,
          forca: vencedorHistorico.vencedorForca ?? 70,
          real: false,
          jogadores: vencedorHistorico.vencedorJogadores,
          sigla: vencedorHistorico.vencedorSigla,
          ano: vencedorHistorico.vencedorAno,
        };
      }

      // Sem jogador real no bloco adversário, usamos uma seleção histórica
      // estável para representar o vencedor daquela partida. A escolha não
      // muda a cada render.
      const pool = elencosDisponiveis.filter((e) => !nomesUsados.has(`${e.sigla}-${e.ano}`));
      const lista = pool.length > 0 ? pool : elencosDisponiveis;
      if (lista.length > 0) {
        const indice = (tamanhoSala * 97 + rodada * 31 + inicioAdversario * 13) % lista.length;
        const escolhido = lista[indice];
        return {
          nome: `${escolhido.selecao} (${escolhido.ano})`,
          forca: forcaElencoAleatorio(escolhido.jogadores),
          real: false,
          jogadores: escolhido.jogadores,
          sigla: escolhido.sigla,
          ano: escolhido.ano,
        };
      }
    }

    const pool = elencosDisponiveis.filter((e) => !nomesUsados.has(`${e.sigla}-${e.ano}`));
    const lista = pool.length > 0 ? pool : elencosDisponiveis;
    const escolhido = lista[Math.floor(Math.random() * Math.max(1, lista.length))];
    return escolhido
      ? { nome: `${escolhido.selecao} (${escolhido.ano})`, forca: forcaElencoAleatorio(escolhido.jogadores), real: false, jogadores: escolhido.jogadores, sigla: escolhido.sigla, ano: escolhido.ano }
      : { nome: "Seleção adversária", forca: 70, real: false };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rodada, jogoGrupo, solo, indiceChave, capacidadeSala, rivaisMultiplayer, historico, elencosDisponiveis]);

  // Quando o adversário é outro jogador real, o placar tem que sair EXATAMENTE
  // igual nos dois navegadores — cada um simulando localmente, sem conversar
  // em tempo real. Por isso usamos uma seed compartilhada (mesmos dois IDs +
  // sala + rodada, ver src/lib/rng.ts) alimentando o motor determinístico em
  // vez do Math.random() usado nas partidas contra seleções (bots).
  const resultadoDeterministico = useMemo<ResultadoDeterministico | undefined>(() => {
    if (!adversario.real || !adversario.id || !meuId || !codigoSala) return undefined;

    // "casa"/"fora" aqui são papéis CANÔNICOS (por comparação de ID), iguais
    // pros dois navegadores — não tem relação com quem sou "eu" na tela.
    const souCasaCanonico = meuId < adversario.id;
    const seed = seedDaPartida(meuId, adversario.id, codigoSala, rodada);
    const forcaCasaCanonica = souCasaCanonico ? forcaJogador : adversario.forca;
    const forcaForaCanonica = souCasaCanonico ? adversario.forca : forcaJogador;
    const estiloCasaCanonico = souCasaCanonico ? estilo : adversario.estilo ?? "equilibrado";

    const partida = simularPartidaCompletaDeterministica(
      forcaCasaCanonica,
      forcaForaCanonica,
      estiloCasaCanonico,
      rodada,
      seed,
    );

    // Traduz do referencial canônico (casa/fora por ID) pro referencial de
    // quem está vendo a tela — eu sempre apareço como "casa" na minha tela
    // (ver comentário em PartidaAoVivo.tsx), então "mine" é sempre eu.
    const mapaSouCasa: Record<TipoEventoDeterministico, EventoResultadoDeterministico["tipo"]> = {
      "gol-casa": "gol-mine",
      "gol-fora": "gol-rival",
      "amarelo-casa": "amarelo-mine",
      "vermelho-casa": "vermelho-mine",
    };
    const mapaSouFora: Record<TipoEventoDeterministico, EventoResultadoDeterministico["tipo"]> = {
      "gol-casa": "gol-rival",
      "gol-fora": "gol-mine",
      "amarelo-casa": "amarelo-rival",
      "vermelho-casa": "vermelho-rival",
    };
    const mapa = souCasaCanonico ? mapaSouCasa : mapaSouFora;

    const eventos: EventoResultadoDeterministico[] = partida.eventos.map((e) => ({
      minuto: e.minuto,
      tipo: mapa[e.tipo],
      slotIndice: e.slotIndice,
    }));

    const meusGols = souCasaCanonico ? partida.golsCasa : partida.golsFora;
    const golsRival = souCasaCanonico ? partida.golsFora : partida.golsCasa;

    let penaltis: ResultadoDeterministico["penaltis"];
    if (partida.penaltis) {
      penaltis = {
        meusGols: souCasaCanonico ? partida.penaltis.golsCasa : partida.penaltis.golsFora,
        golsRival: souCasaCanonico ? partida.penaltis.golsFora : partida.penaltis.golsCasa,
        cobrancas: partida.penaltis.cobrancas.map((c) => ({
          lado: (c.lado === "casa") === souCasaCanonico ? "mine" : "rival",
          converteu: c.converteu,
          slotIndice: c.slotIndice,
        })),
      };
    }

    return { meusGols, golsRival, eventos, penaltis };
  }, [adversario.real, adversario.id, adversario.forca, adversario.estilo, meuId, codigoSala, rodada, forcaJogador, estilo]);

  function registrarHistorico(resultado: ResultadoPartida, eventos: Evento[]) {
    setHistorico((prev) => [...prev, {
      fase: solo && rodada === 0 ? `Fase de Grupos · Jogo ${jogoGrupo + 1}` : fases[rodada],
      adversario: adversario.nome,
      adversarioSigla: adversario.sigla,
      adversarioAno: adversario.ano,
      adversarioJogadores: adversario.jogadores,
      resultado,
      eventos,
    }]);
  }

  function onFinalPartida(resultado: ResultadoPartida, eventos: Evento[]) {
    setUltimoResultado(resultado);
    registrarHistorico(resultado, eventos);

    if (solo && rodada === 0) {
      const pontos = resultado.golsCasa > resultado.golsFora ? 3 : resultado.golsCasa === resultado.golsFora ? 1 : 0;
      const novoPontos = pontosGrupo + pontos;
      const novoSaldo = saldoGrupo + resultado.golsCasa - resultado.golsFora;
      setPontosGrupo(novoPontos);
      setSaldoGrupo(novoSaldo);
      if (jogoGrupo < 3) {
        setJogoGrupo((v) => v + 1);
        setStatus("resultado");
        return;
      }
      // Quatro jogos: 5+ pontos classifica. Com 4 pontos, saldo não-negativo
      // desempata; isso mantém a fase competitiva sem eliminar por uma derrota isolada.
      const classificou = novoPontos >= 5 || (novoPontos === 4 && novoSaldo >= 0);
      if (!classificou) {
        setCampeao(false);
        setStatus("eliminado");
        return;
      }
      setStatus("resultado");
      return;
    }

    const eraFinal = rodada === fases.length - 1;
    if (eraFinal) {
      setCampeao(resultado.venceuCasa);
      setStatus("fim");
      onMudarRodada?.(rodada + 1);
    } else {
      if (resultado.venceuCasa) {
        setStatus("resultado");
      } else {
        onEliminarRodada?.(rodada, {
          nome: adversario.nome,
          forca: adversario.forca,
          jogadores: adversario.jogadores,
          sigla: adversario.sigla,
          ano: adversario.ano,
        });
        setStatus("eliminado");
      }
    }
  }

  function avancar() {
    if (solo && rodada === 0) {
      setRodada(1);
      setJogoGrupo(0);
      onMudarRodada?.(1);
    } else {
      setRodada((r) => r + 1);
      onMudarRodada?.(rodada + 1);
    }
    setUltimoResultado(null);
    setStatus("aguardando");
  }

  const overallMedio = Math.round(forcaJogador);
  if (mostrarCard) {
    return <CardCampeao nomeTime={nomeTime} campeao={campeao} overallMedio={overallMedio} rodadas={historico.map((h) => ({ fase: h.fase, golsCasa: h.resultado.golsCasa, golsFora: h.resultado.golsFora, penaltis: h.resultado.penaltis, adversarioNome: h.adversario, adversarioSigla: h.adversarioSigla, adversarioAno: h.adversarioAno, adversarioJogadores: h.adversarioJogadores }))} onFechar={() => setMostrarCard(false)} onJogarDeNovo={onFimDaCopa} />;
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 px-6 py-10">
      <header className="relative text-center">
        <div className="absolute left-0 top-0"><BotaoTema /></div>
        <p className="text-xs uppercase tracking-wide text-ink/50">{solo ? "Sua Copa do Mundo" : "Sua Copa do Mundo"}</p>
        <h1 className="font-display text-3xl">{nomeTime}</h1>
        {solo && (
          <button onClick={() => setConfigAberta((v) => !v)} className="absolute right-0 top-0 rounded-lg border border-ink/10 bg-card px-2 py-1 text-xs text-ink/60 hover:border-ink/30">⚙️ {NOMES_VELOCIDADE[velocidade]}</button>
        )}
        {solo && configAberta && <div className="absolute right-0 top-8 z-10 w-40 rounded-lg border border-ink/10 bg-card p-2 text-left shadow-card"><p className="mb-1 px-1 text-[10px] font-semibold uppercase text-ink/40">Velocidade</p>{(Object.keys(NOMES_VELOCIDADE) as VelocidadeJogo[]).map((v) => <button key={v} onClick={() => { setVelocidade(v); setConfigAberta(false); }} className={`block w-full rounded px-2 py-1 text-left text-xs ${velocidade === v ? "bg-brand/10 font-semibold text-brand" : "text-ink/70 hover:bg-ink/5"}`}>{NOMES_VELOCIDADE[v]}</button>)}</div>}
      </header>

      {status === "fim" ? (
        <div>
          <div className="mb-4 rounded-card border border-ink/10 bg-card p-4 shadow-card">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink/50">Overall final do time</p>
            <ResumoOveralls slots={slots} titulares={titulares} mostrarValores />
          </div>
          <div className="mb-3"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink/50">Sua estrada até a final</p><div className="grid grid-cols-3 gap-2">{historico.map((h, i) => <div key={i} className="rounded-lg border border-pitch/40 bg-pitch/10 px-2 py-2 text-center"><p className="text-[9px] font-semibold uppercase text-pitch">{fasesCurtas[i] ?? "FASE"}</p><p className="truncate text-[10px] font-semibold text-ink">vs {h.adversarioSigla ?? h.adversario} {h.adversarioAno ?? ""}</p><p className="text-xs text-ink/60">{h.resultado.golsCasa}-{h.resultado.golsFora}</p></div>)}</div></div>
          <div className="rounded-card border border-ink/10 bg-card p-4 shadow-card">
            <ul className="mb-4 space-y-1">{historico.map((h, i) => <li key={i} className={`flex items-center justify-between rounded px-2 py-2 text-sm ${i === historico.length - 1 ? "border border-gold bg-gold/10" : ""}`}><span className="text-ink/70">{h.fase} vs {h.adversarioSigla ?? ""} {h.adversario}</span><span className="font-semibold">{h.resultado.golsCasa}-{h.resultado.golsFora}{h.resultado.penaltis && ` (${h.resultado.penaltis.casa}-${h.resultado.penaltis.fora})`}</span></li>)}</ul>
            <div className="border-t border-ink/10 pt-3 text-center"><p className={`font-display text-2xl ${campeao ? "text-gold" : "text-ink"}`}>{campeao ? "CAMPEÃO DA COPA" : "VICE-CAMPEÃO"}</p><p className="mb-4 text-xs text-ink/50">{campeao ? "Você levantou a taça" : "Chegou até a final, mas não foi dessa vez"}</p><button onClick={() => setMostrarCard(true)} className="w-full rounded-lg bg-brand py-3 font-semibold text-card shadow-card hover:bg-brand-dark">Ver card →</button><button onClick={onFimDaCopa} className="mt-2 w-full rounded-lg border border-ink/10 bg-paper py-2.5 text-sm text-ink/70">FIM DA SUA COPA</button></div>
          </div>
        </div>
      ) : status === "eliminado" ? (
        <div className="rounded-card border border-ink/10 bg-card p-6 text-center shadow-card">
          <p className="text-5xl">❌</p>
          <h2 className="mt-3 font-display text-2xl">{solo && rodada === 0 ? "Eliminado na fase de grupos" : `Eliminado nas ${fases[rodada]}`}</h2>
          {solo && rodada === 0 && <p className="mt-2 text-sm text-ink/55">Campanha: {pontosGrupo} ponto(s), saldo {saldoGrupo >= 0 ? "+" : ""}{saldoGrupo}.</p>}
          {!solo && souHost && rodadaLiberadaAposEliminacao < fases.length - 1 && (
            <div className="mt-4 rounded-lg border border-brand/30 bg-brand/5 p-3">
              <p className="mb-2 text-xs text-ink/60">Mesmo eliminado, você é o host — os outros jogadores só avançam de rodada quando você liberar.</p>
              <button
                onClick={() => {
                  const proxima = rodadaLiberadaAposEliminacao + 1;
                  setRodadaLiberadaAposEliminacao(proxima);
                  onLiberarRodada?.(proxima);
                }}
                className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-card shadow-card hover:bg-brand-dark"
              >
                Liberar {fases[rodadaLiberadaAposEliminacao + 1]} pro grupo →
              </button>
            </div>
          )}
          <button onClick={onFimDaCopa} className="mt-5 rounded-lg bg-ink px-6 py-3 font-semibold text-card">FIM DA SUA COPA</button>
        </div>
      ) : (
        <>
          <div className={`grid gap-2 ${solo ? "grid-cols-3 sm:grid-cols-6" : "grid-cols-4"}`}>{fases.map((fase, i) => <div key={fase} className={`rounded-lg border px-1 py-2 text-center text-[9px] font-semibold uppercase ${i < rodada ? "border-pitch bg-pitch/10 text-pitch" : i === rodada ? "border-brand bg-brand/10 text-brand" : "border-ink/10 text-ink/30"}`}>{fasesCurtas[i]}</div>)}</div>
          {solo && rodada === 0 && <div className="rounded-lg border border-ink/10 bg-card px-3 py-2 text-center text-xs text-ink/60">Fase de grupos · jogo {jogoGrupo + 1}/4 · <strong>{pontosGrupo} pts</strong> · saldo {saldoGrupo >= 0 ? "+" : ""}{saldoGrupo}</div>}
          <div>
            <p className="mb-2 text-center text-xs uppercase tracking-wide text-ink/50">{solo && rodada === 0 ? `Fase de Grupos · Jogo ${jogoGrupo + 1}` : fases[rodada]} — {nomeTime} <span className="text-ink/40">vs</span> {adversario.nome}{adversario.real && <span className="ml-2 rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-semibold text-brand">jogador real</span>}</p>
            {status === "aguardando" && (
              !solo && adversario.nome === "Aguardando vencedor da outra partida" ? (
                <div className="rounded-card border border-ink/10 bg-card p-6 text-center shadow-card">
                  <p className="text-3xl">⏳</p>
                  <p className="mt-2 font-semibold text-ink/70">Aguardando o vencedor da outra partida...</p>
                  <p className="mt-1 text-xs text-ink/50">A final só aparece depois que a outra partida terminar.</p>
                </div>
              ) : !solo && !souHost && rodada > rodadaLiberadaPeloHost ? (
                <div className="rounded-card border border-ink/10 bg-card p-6 text-center shadow-card">
                  <p className="text-3xl">⏳</p>
                  <p className="mt-2 font-semibold text-ink/70">Aguardando o host iniciar essa rodada...</p>
                </div>
              ) : (
                <div className="rounded-card border border-ink/10 bg-card p-6 text-center shadow-card">
                  <button
                    onClick={() => {
                      if (!solo && souHost) onLiberarRodada?.(rodada);
                      setStatus("jogando");
                    }}
                    className="rounded-lg bg-brand px-6 py-3 font-semibold text-card shadow-card hover:bg-brand-dark"
                  >
                    Jogar partida ⚽
                  </button>
                </div>
              )
            )}
            {status === "jogando" && <PartidaAoVivo nomeCasa={nomeTime} nomeFora={adversario.nome} forcaCasa={forcaJogador} forcaFora={adversario.forca} estilo={estilo} rodada={rodada + jogoGrupo + 1} velocidade={velocidade} slots={slots} titularesIniciais={titulares} reservasIniciais={reservas} jogadoresFora={adversario.jogadores} onFinal={onFinalPartida} resultadoDeterministico={resultadoDeterministico} />}
            {status === "resultado" && ultimoResultado && <div className="rounded-card border border-ink/10 bg-card p-6 text-center shadow-card"><p className="mb-1 font-display text-4xl">{ultimoResultado.golsCasa} - {ultimoResultado.golsFora}</p>{ultimoResultado.penaltis && <p className="mb-2 text-xs text-ink/50">Pênaltis: {ultimoResultado.penaltis.casa} - {ultimoResultado.penaltis.fora}</p>}{solo && rodada === 0 && jogoGrupo < 3 ? <><p className="mb-4 font-semibold text-pitch">Próximo jogo da fase de grupos.</p><button onClick={() => { setUltimoResultado(null); setStatus("aguardando"); }} className="rounded-lg bg-pitch px-6 py-3 font-semibold text-card">Próximo jogo →</button></> : solo && rodada === 0 ? <><p className="mb-2 font-semibold text-pitch">Classificado para os 16 avos!</p><p className="mb-4 text-xs text-ink/50">{pontosGrupo} ponto(s), saldo {saldoGrupo >= 0 ? "+" : ""}{saldoGrupo}.</p><button onClick={avancar} className="rounded-lg bg-brand px-6 py-3 font-semibold text-card">Ir para os 16 avos →</button></> : <><p className="mb-4 font-semibold text-pitch">Você venceu! Avançando de fase.</p><button onClick={avancar} className="rounded-lg bg-pitch px-6 py-3 font-semibold text-card">Próxima fase →</button></>}</div>}
          </div>
        </>
      )}

      {historico.length > 0 && status !== "fim" && <div className="rounded-card border border-ink/10 bg-card p-4 text-sm shadow-card"><p className="mb-2 text-xs font-semibold uppercase text-ink/50">Campanha <span className="normal-case text-ink/30">(clique pra ver o resumo)</span></p><ul className="space-y-1">{historico.map((h, i) => <li key={i}><button onClick={() => setExpandido(expandido === i ? null : i)} className="flex w-full items-center justify-between rounded px-1 py-1 text-left text-ink/70 hover:bg-ink/5"><span>{h.fase} vs {h.adversario}</span><span className="font-semibold">{h.resultado.golsCasa}-{h.resultado.golsFora}</span></button>{expandido === i && <div className="mt-1 max-h-56 space-y-1 overflow-y-auto rounded bg-paper p-2">{h.eventos.length === 0 ? <p className="text-xs text-ink/40">Sem eventos registrados.</p> : [...h.eventos].reverse().map((e, j) => <p key={j} className="text-xs text-ink/60"><span className="mr-2 font-mono text-ink/40">{e.minuto}&apos;</span>{e.texto}</p>)}</div>}</li>)}</ul></div>}
    </div>
  );
}
