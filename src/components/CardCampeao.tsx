"use client";

import { useRef, useState } from "react";
import { JogadorReal } from "@/lib/squads";
import { overallDoJogador } from "@/lib/simulacao";

export interface RodadaParaCard {
  fase: string;
  golsCasa: number;
  golsFora: number;
  penaltis?: { casa: number; fora: number };
  adversarioSigla?: string;
  adversarioAno?: number;
  adversarioNome: string;
  adversarioJogadores?: JogadorReal[];
}

interface CardCampeaoProps {
  nomeTime: string;
  campeao: boolean;
  rodadas: RodadaParaCard[];
  overallMedio: number;
  onFechar: () => void;
  onJogarDeNovo: () => void;
}

function jogadorDestaque(jogadores?: JogadorReal[]) {
  if (!jogadores || jogadores.length === 0) return null;
  return [...jogadores].sort((a, b) => overallDoJogador(b) - overallDoJogador(a))[0];
}

function tituloDestaque(campeao: boolean, invictoTotal: boolean, golsPro: number, overallMedio: number) {
  if (!campeao) return "Chegou à final";
  if (invictoTotal) return "Campanha perfeita";
  if (golsPro >= 20) return "Esmagador de recordes";
  if (overallMedio >= 90) return "Elenco dos sonhos";
  return "Campanha histórica";
}

export function CardCampeao({
  nomeTime,
  campeao,
  rodadas,
  overallMedio,
  onFechar,
  onJogarDeNovo,
}: CardCampeaoProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [exportando, setExportando] = useState(false);

  const golsPro = rodadas.reduce((acc, r) => acc + r.golsCasa, 0);
  const golsSofridos = rodadas.reduce((acc, r) => acc + r.golsFora, 0);
  const vitorias = rodadas.filter(
    (r) => r.golsCasa > r.golsFora || (r.penaltis && r.penaltis.casa > r.penaltis.fora),
  ).length;
  const semSofrerGols = golsSofridos === 0;
  const invictoTotal = campeao && semSofrerGols;
  const ultimaRodada = rodadas[rodadas.length - 1];
  const destaqueTitulo = tituloDestaque(campeao, invictoTotal, golsPro, overallMedio);

  async function compartilharImagem() {
    if (!cardRef.current) return;
    setExportando(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(cardRef.current, { backgroundColor: "#f3edde", scale: 2 });
      const link = document.createElement("a");
      link.download = `sete-a-zero-${campeao ? "campeao" : "vice"}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      alert("Não consegui gerar a imagem agora. Tenta de novo.");
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 px-6 py-10">
      <div
        ref={cardRef}
        className="rounded-card border-4 border-double border-gold bg-paper p-6 text-ink shadow-card"
      >
        <div className="mb-5 flex items-center justify-between border-b-2 border-gold/30 pb-3">
          <span className="font-display text-xs font-semibold uppercase tracking-[0.25em] text-gold">
            Sete a Zero
          </span>
          <span className="text-[10px] uppercase tracking-wide text-ink/40">{nomeTime}</span>
        </div>

        <p
          className={`text-center text-xs font-semibold uppercase tracking-[0.3em] ${
            campeao ? "text-gold" : "text-ink/50"
          }`}
        >
          {campeao ? "Campeão" : "Vice-campeão"}
        </p>
        <p className="mb-1 text-center font-display text-6xl font-bold leading-none">
          {golsPro}-{golsSofridos}
        </p>
        <p className="mb-5 text-center text-[11px] uppercase tracking-wide text-ink/50">
          {invictoTotal ? "Campanha perfeita · invicto" : `${vitorias} vitória(s) na campanha`}
        </p>

        <div className="mb-5 grid grid-cols-2 divide-x-2 divide-gold/25 rounded-lg border-2 border-gold/25 text-center">
          <div className="divide-y-2 divide-gold/25">
            <div className="px-3 py-2.5">
              <p className="font-display text-2xl font-bold text-pitch">{golsPro}</p>
              <p className="text-[9px] uppercase tracking-wide text-ink/50">Gols pró</p>
            </div>
            <div className="px-3 py-2.5">
              <p className="font-display text-2xl font-bold text-gold">{overallMedio}</p>
              <p className="text-[9px] uppercase tracking-wide text-ink/50">Overall</p>
            </div>
          </div>
          <div className="divide-y-2 divide-gold/25">
            <div className="px-3 py-2.5">
              <p className="font-display text-2xl font-bold text-brand">{golsSofridos}</p>
              <p className="text-[9px] uppercase tracking-wide text-ink/50">Sofridos</p>
            </div>
            <div className="px-3 py-2.5">
              <p className="font-display text-2xl font-bold text-ink">{semSofrerGols ? "SIM" : "NÃO"}</p>
              <p className="text-[9px] uppercase tracking-wide text-ink/50">Invicto</p>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          {rodadas.map((r, i) => {
            const destaque = jogadorDestaque(r.adversarioJogadores);
            return (
              <div
                key={i}
                className="flex items-center justify-between rounded-md border border-gold/30 bg-card px-3 py-1.5 text-xs"
              >
                <span className="flex min-w-0 items-center gap-2">
                  {destaque?.numero && (
                    <span className="w-5 shrink-0 text-right font-semibold text-ink/40">
                      {destaque.numero}
                    </span>
                  )}
                  <span className="truncate font-semibold text-ink">
                    {destaque ? destaque.nome : r.adversarioNome}
                  </span>
                </span>
                <span className="shrink-0 pl-2 text-[10px] font-semibold uppercase tracking-wide text-gold">
                  {r.adversarioSigla ?? ""} {r.adversarioAno ?? ""}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-5 rounded-lg bg-gold py-2.5 text-center">
          <p className="font-display text-sm font-bold uppercase tracking-[0.15em] text-ink">
            {destaqueTitulo}
          </p>
        </div>

        {ultimaRodada && (
          <p className="mt-4 text-center text-[10px] text-ink/40">
            Final · vs {ultimaRodada.adversarioNome} · {ultimaRodada.golsCasa}-{ultimaRodada.golsFora}
            {ultimaRodada.penaltis && ` (${ultimaRodada.penaltis.casa}-${ultimaRodada.penaltis.fora} pên.)`}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <button
          onClick={compartilharImagem}
          disabled={exportando}
          className="rounded-lg bg-brand py-3 font-semibold text-card shadow-card hover:bg-brand-dark disabled:opacity-60"
        >
          {exportando ? "Gerando…" : "Compartilhar imagem 📤"}
        </button>
        <button
          onClick={onFechar}
          className="rounded-lg border border-ink/10 bg-card py-3 font-semibold text-ink shadow-card"
        >
          ← Voltar
        </button>
        <button onClick={onJogarDeNovo} className="rounded-lg bg-pitch py-3 font-semibold text-card shadow-card">
          Jogar de novo
        </button>
      </div>
    </div>
  );
}
