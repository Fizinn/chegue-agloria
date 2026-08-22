"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { JogadorReal } from "@/lib/squads";
import { SlotFormacao } from "@/lib/formacoes";
import { CATEGORIA_DO_SLOT, PosicaoAmpla } from "@/types/game";
import { INTERVALO_MS_POR_VELOCIDADE, CobrancaPenalti } from "@/lib/simulacao";
import { DisputaPenaltis } from "@/components/DisputaPenaltis";
import {
  EstiloJogo,
  PESO_CARTAO_POR_CATEGORIA,
  ResultadoPartida,
  VelocidadeJogo,
  expectativaGols,
  overallDoJogador,
  simularPenaltis,
} from "@/lib/simulacao";

export interface Evento {
  minuto: number;
  texto: string;
  tipo: "gol-casa" | "gol-fora" | "amarelo" | "vermelho" | "info";
}

interface PartidaAoVivoProps {
  nomeCasa: string;
  nomeFora: string;
  forcaCasa: number;
  forcaFora: number;
  estilo: EstiloJogo;
  rodada: number;
  velocidade: VelocidadeJogo;
  slots: SlotFormacao[];
  titularesIniciais: Record<string, JogadorReal | null>;
  reservasIniciais: Record<PosicaoAmpla, (JogadorReal | null)[]>;
  jogadoresFora?: JogadorReal[];
  onFinal: (resultado: ResultadoPartida, eventos: Evento[]) => void;
}

type Fase = "jogando" | "intervalo" | "penaltis-ordem" | "penaltis" | "fim";

function escolherJogadorPonderado(
  titulares: Record<string, JogadorReal | null>,
  slots: SlotFormacao[],
  expulsos: Set<string>,
): JogadorReal | null {
  const candidatos: { jogador: JogadorReal; peso: number }[] = [];
  slots.forEach((slot) => {
    const jogador = titulares[slot.slotKey];
    if (jogador && !expulsos.has(jogador.id)) {
      candidatos.push({
        jogador,
        peso: PESO_CARTAO_POR_CATEGORIA[CATEGORIA_DO_SLOT[slot.posicao]] ?? 0.2,
      });
    }
  });
  if (candidatos.length === 0) return null;
  const total = candidatos.reduce((acc, c) => acc + c.peso, 0);
  let r = Math.random() * total;
  for (const c of candidatos) {
    r -= c.peso;
    if (r <= 0) return c.jogador;
  }
  return candidatos[candidatos.length - 1].jogador;
}

export function PartidaAoVivo({
  nomeCasa,
  nomeFora,
  forcaCasa,
  forcaFora,
  estilo,
  rodada,
  velocidade,
  slots,
  titularesIniciais,
  reservasIniciais,
  jogadoresFora,
  onFinal,
}: PartidaAoVivoProps) {
  const { mediaCasa, mediaFora } = useMemo(
    () => expectativaGols(forcaCasa, forcaFora, estilo, rodada),
    [forcaCasa, forcaFora, estilo, rodada],
  );

  // Cada partida tem uma "intensidade" própria sorteada uma vez — jogos
  // mais tranquilos praticamente não têm cartão, jogos mais pegados têm
  // vários. Não é obrigatório ter cartão em toda partida.
  const [intensidade] = useState(() => 0.3 + Math.random() * 1.6);

  const [fase, setFase] = useState<Fase>("jogando");
  const [minuto, setMinuto] = useState(0);
  const [golsCasa, setGolsCasa] = useState(0);
  const [golsFora, setGolsFora] = useState(0);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [titulares, setTitulares] = useState(titularesIniciais);
  const [reservas, setReservas] = useState(reservasIniciais);
  const [flashCasa, setFlashCasa] = useState(false);
  const [flashFora, setFlashFora] = useState(false);
  const [reservaSelecionada, setReservaSelecionada] = useState<{
    categoria: PosicaoAmpla;
    indice: number;
  } | null>(null);
  const [ordemPenaltis, setOrdemPenaltis] = useState<JogadorReal[]>([]);
  const [cobrancasPenaltis, setCobrancasPenaltis] = useState<CobrancaPenalti[]>([]);
  const [resultadoPenaltis, setResultadoPenaltis] = useState<{
    golsCasa: number;
    golsFora: number;
  } | null>(null);

  // Refs pra evitar efeito colateral dentro de updater de useState (isso é
  // o que causava cartão/evento duplicado: React em modo dev roda a função
  // passada pra setState(prev => ...) DUAS VEZES quando ela tem efeito
  // colateral dentro. Lendo/escrevendo por ref e chamando os setState só
  // com valor pronto (nunca com função) evita a duplicação.
  const minutoRef = useRef(0);
  const golsCasaRef = useRef(0);
  const golsForaRef = useRef(0);
  const amarelosRef = useRef<Record<string, number>>({});
  const expulsosRef = useRef<Set<string>>(new Set());
  const penalidadeCasaRef = useRef(1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const eventosRef = useRef<Evento[]>([]);

  function registrarEvento(evento: Evento) {
    eventosRef.current = [evento, ...eventosRef.current];
    setEventos(eventosRef.current);
  }

  useEffect(() => {
    if (fase !== "jogando") {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => {
      minutoRef.current += 1;
      const novoMinuto = minutoRef.current;
      setMinuto(novoMinuto);

      if (Math.random() < (mediaCasa * penalidadeCasaRef.current) / 90) {
        const artilheiro = escolherJogadorPonderado(titulares, slots, expulsosRef.current);
        golsCasaRef.current += 1;
        setGolsCasa(golsCasaRef.current);
        setFlashCasa(true);
        setTimeout(() => setFlashCasa(false), 900);
        registrarEvento({
          minuto: novoMinuto,
          texto: artilheiro ? `⚽ Gol de ${artilheiro.nome}!` : `⚽ Gol do ${nomeCasa}!`,
          tipo: "gol-casa",
        });
      }

      if (Math.random() < mediaFora / 90) {
        golsForaRef.current += 1;
        setGolsFora(golsForaRef.current);
        setFlashFora(true);
        setTimeout(() => setFlashFora(false), 900);
        registrarEvento({ minuto: novoMinuto, texto: `⚽ Gol do ${nomeFora}.`, tipo: "gol-fora" });
      }

      if (Math.random() < 0.014 * intensidade) {
        const alvo = escolherJogadorPonderado(titulares, slots, expulsosRef.current);
        if (alvo) {
          const atual = (amarelosRef.current[alvo.id] ?? 0) + 1;
          amarelosRef.current = { ...amarelosRef.current, [alvo.id]: atual };
          if (atual >= 2) {
            expulsosRef.current = new Set(expulsosRef.current).add(alvo.id);
            penalidadeCasaRef.current *= 0.8;
            registrarEvento({
              minuto: novoMinuto,
              texto: `🟥 Segundo amarelo, vermelho pra ${alvo.nome}!`,
              tipo: "vermelho",
            });
          } else {
            registrarEvento({
              minuto: novoMinuto,
              texto: `🟨 Cartão amarelo pra ${alvo.nome}.`,
              tipo: "amarelo",
            });
          }
        }
      }
    }, INTERVALO_MS_POR_VELOCIDADE[velocidade]);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, velocidade]);

  useEffect(() => {
    if (fase === "jogando" && minuto === 45) {
      setFase("intervalo");
    }
    if (fase === "jogando" && minuto >= 90) {
      if (timerRef.current) clearInterval(timerRef.current);
      if (golsCasa === golsFora) {
        setFase("penaltis-ordem");
      } else {
        setFase("fim");
        onFinal({ golsCasa, golsFora, venceuCasa: golsCasa > golsFora }, eventosRef.current);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minuto, fase]);

  function trocarJogador(categoria: PosicaoAmpla, slotKey: string) {
    if (!reservaSelecionada || reservaSelecionada.categoria !== categoria) return;
    const reserva = reservas[categoria][reservaSelecionada.indice];
    if (!reserva) return;
    const titularAtual = titulares[slotKey];

    setTitulares((prev) => ({ ...prev, [slotKey]: reserva }));
    setReservas((prev) => {
      const copia = { ...prev, [categoria]: [...prev[categoria]] };
      copia[categoria][reservaSelecionada.indice] = titularAtual ?? null;
      return copia;
    });
    registrarEvento({
      minuto: 45,
      texto: `🔄 Substituição: ${reserva.nome} entra no lugar de ${titularAtual?.nome ?? "—"}.`,
      tipo: "info",
    });
    setReservaSelecionada(null);
  }

  function alternarOrdemPenalti(jogador: JogadorReal) {
    setOrdemPenaltis((prev) =>
      prev.find((j) => j.id === jogador.id)
        ? prev.filter((j) => j.id !== jogador.id)
        : [...prev, jogador],
    );
  }

  function baterPenaltis() {
    const ordemFora = jogadoresFora
      ?.filter((j) => j.posicao !== "GOL")
      .sort(() => Math.random() - 0.5)
      .slice(0, 8);
    const resultado = simularPenaltis(ordemPenaltis, forcaFora, ordemFora);
    setResultadoPenaltis({ golsCasa: resultado.golsCasa, golsFora: resultado.golsFora });
    setCobrancasPenaltis(resultado.cobrancas);
    setFase("penaltis");
  }

  function concluirPenaltis() {
    if (!resultadoPenaltis) return;
    cobrancasPenaltis.forEach((c) => {
      registrarEvento({
        minuto: 120,
        texto: `${c.converteu ? "✅" : "❌"} ${c.jogador ?? (c.lado === "casa" ? nomeCasa : nomeFora)} ${
          c.converteu ? "converteu" : "perdeu"
        } a cobrança.`,
        tipo: "info",
      });
    });
    setFase("fim");
    onFinal(
      {
        golsCasa,
        golsFora,
        penaltis: { casa: resultadoPenaltis.golsCasa, fora: resultadoPenaltis.golsFora },
        venceuCasa: resultadoPenaltis.golsCasa > resultadoPenaltis.golsFora,
      },
      eventosRef.current,
    );
  }

  const jogadoresElegiveisPenalti = slots
    .map((s) => titulares[s.slotKey])
    .filter((j): j is JogadorReal => Boolean(j) && !expulsosRef.current.has(j!.id));

  return (
    <div className="rounded-card border border-ink/10 bg-card p-6 shadow-card">
      <div className="mb-4 flex items-center justify-center gap-6 text-center">
        <div>
          <p className="text-xs uppercase text-ink/50">{nomeCasa}</p>
          <p
            className={`font-display text-4xl transition-colors duration-300 ${
              flashCasa ? "text-pitch" : ""
            }`}
          >
            {golsCasa}
          </p>
        </div>
        <div className="text-xs text-ink/40">
          {fase === "intervalo" ? "Intervalo" : fase === "fim" ? "Fim" : `${Math.min(minuto, 90)}'`}
        </div>
        <div>
          <p className="text-xs uppercase text-ink/50">{nomeFora}</p>
          <p
            className={`font-display text-4xl transition-colors duration-300 ${
              flashFora ? "text-brand" : ""
            }`}
          >
            {golsFora}
          </p>
        </div>
      </div>

      {fase === "jogando" && (
        <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
          <div
            className="h-full bg-brand transition-all"
            style={{ width: `${(Math.min(minuto, 90) / 90) * 100}%` }}
          />
        </div>
      )}

      {fase === "intervalo" && (
        <div className="mb-4 rounded-lg border border-brand/30 bg-brand/5 p-4">
          <p className="mb-2 text-sm font-semibold text-brand">
            Intervalo — quer trocar algum jogador?
          </p>
          <div className="grid grid-cols-2 gap-3 text-xs">
            {(["GOL", "DEF", "MEI", "ATA"] as PosicaoAmpla[]).map((cat) => (
              <div key={cat}>
                <p className="mb-1 font-semibold uppercase text-ink/40">{cat}</p>
                <div className="mb-2 space-y-1">
                  {reservas[cat].map((r, i) =>
                    r ? (
                      <button
                        key={r.id}
                        onClick={() => setReservaSelecionada({ categoria: cat, indice: i })}
                        className={`flex w-full items-center justify-between rounded border px-2 py-1 text-left ${
                          reservaSelecionada?.categoria === cat && reservaSelecionada.indice === i
                            ? "border-gold bg-gold/20 font-semibold"
                            : "border-ink/10 bg-paper"
                        }`}
                      >
                        <span>{r.nome}</span>
                        <span className="text-brand">{overallDoJogador(r)}</span>
                      </button>
                    ) : null,
                  )}
                </div>
                <div className="space-y-1">
                  {slots
                    .filter((s) => CATEGORIA_DO_SLOT[s.posicao] === cat)
                    .map((s) => {
                      const titular = titulares[s.slotKey];
                      return (
                        <button
                          key={s.slotKey}
                          onClick={() => trocarJogador(cat, s.slotKey)}
                          disabled={reservaSelecionada?.categoria !== cat}
                          className="flex w-full items-center justify-between rounded border border-ink/10 bg-ink/5 px-2 py-1 text-left text-ink/60 disabled:opacity-40"
                        >
                          <span>{titular?.nome ?? s.posicao} (titular)</span>
                          {titular && <span className="text-ink/40">{overallDoJogador(titular)}</span>}
                        </button>
                      );
                    })}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => {
              minutoRef.current = 46;
              setMinuto(46);
              setFase("jogando");
            }}
            className="mt-3 w-full rounded-lg bg-pitch py-2.5 font-semibold text-card shadow-card"
          >
            Pronto pro 2º tempo
          </button>
        </div>
      )}

      {fase === "penaltis-ordem" && (
        <div className="mb-4 rounded-lg border border-brand/30 bg-brand/5 p-4">
          <p className="mb-2 text-sm font-semibold text-brand">
            Empate! Vai pra pênaltis — escolha a ordem dos batedores (mínimo 5, na ordem que clicar).
          </p>
          <ul className="mb-3 space-y-1">
            {jogadoresElegiveisPenalti.map((j) => {
              const posicaoNaOrdem = ordemPenaltis.findIndex((o) => o.id === j.id);
              return (
                <li key={j.id}>
                  <button
                    onClick={() => alternarOrdemPenalti(j)}
                    className={`flex w-full items-center justify-between rounded border px-2 py-1.5 text-sm ${
                      posicaoNaOrdem >= 0
                        ? "border-gold bg-gold/10 font-semibold"
                        : "border-ink/10 bg-paper"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {j.nome}
                      <span className="text-xs text-brand">{overallDoJogador(j)}</span>
                    </span>
                    {posicaoNaOrdem >= 0 && <span>{posicaoNaOrdem + 1}º</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          <button
            onClick={baterPenaltis}
            disabled={ordemPenaltis.length < 5}
            className="w-full rounded-lg bg-brand py-2.5 font-semibold text-card shadow-card disabled:opacity-40"
          >
            Confirmar ordem e bater pênaltis
          </button>
        </div>
      )}

      {fase === "penaltis" && resultadoPenaltis && (
        <div className="mb-4">
          <DisputaPenaltis
            nomeCasa={nomeCasa}
            nomeFora={nomeFora}
            cobrancas={cobrancasPenaltis}
            golsCasa={resultadoPenaltis.golsCasa}
            golsFora={resultadoPenaltis.golsFora}
            onConcluido={concluirPenaltis}
          />
        </div>
      )}

      {fase === "fim" && resultadoPenaltis && (
        <div className="mb-4 rounded-lg border border-gold bg-gold/10 p-4 text-center">
          <p className="mb-1 font-display text-2xl">
            Pênaltis: {resultadoPenaltis.golsCasa} - {resultadoPenaltis.golsFora}
          </p>
        </div>
      )}

      <div className="max-h-56 space-y-1 overflow-y-auto text-sm">
        {eventos.map((e, i) => (
          <p
            key={i}
            className={
              e.tipo === "gol-fora"
                ? "font-semibold text-brand"
                : e.tipo === "gol-casa"
                  ? "font-semibold text-pitch"
                  : "text-ink/70"
            }
          >
            <span className="mr-2 font-mono text-xs text-ink/40">{e.minuto}&apos;</span>
            {e.texto}
          </p>
        ))}
      </div>
    </div>
  );
}
