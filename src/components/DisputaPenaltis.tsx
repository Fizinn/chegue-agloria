"use client";

import { useEffect, useState } from "react";
import { CobrancaPenalti } from "@/lib/simulacao";

interface DisputaPenaltisProps {
  nomeCasa: string;
  nomeFora: string;
  cobrancas: CobrancaPenalti[];
  golsCasa: number;
  golsFora: number;
  onConcluido: () => void;
}

// posição pseudo-aleatória (mas estável) do chute dentro/fora do gol, a partir do índice da cobrança
function posicaoChute(indice: number, acertou: boolean) {
  const s1 = Math.sin(indice * 12.9898) * 43758.5453;
  const f1 = s1 - Math.floor(s1);
  const s2 = Math.sin(indice * 78.233) * 43758.5453;
  const f2 = s2 - Math.floor(s2);

  if (acertou) {
    // dentro da trave, com folga das bordas
    const x = 28 + f1 * 144;
    const y = 22 + f2 * 66;
    return { x, y };
  }

  // fora: esquerda, direita ou por cima do travessão
  const zona = Math.floor(f1 * 3);
  if (zona === 0) return { x: 4 + f2 * 12, y: 26 + f2 * 56 };
  if (zona === 1) return { x: 184 + f2 * 12, y: 26 + f2 * 56 };
  return { x: 30 + f2 * 140, y: -6 };
}

function GolinhoPenalti({ indice, acertou }: { indice: number; acertou: boolean }) {
  const { x, y } = posicaoChute(indice, acertou);
  const cor = acertou ? "rgb(var(--cor-pitch))" : "rgb(var(--cor-brand))";

  return (
    <div className="mx-auto mb-3 flex justify-center">
      <svg viewBox="0 0 200 100" className="h-16 w-32 overflow-visible">
        {/* trave */}
        <path
          d="M 20 10 L 20 90 M 180 10 L 180 90 M 20 10 L 180 10"
          fill="none"
          stroke="rgb(var(--cor-pitch-line))"
          strokeWidth={4}
          strokeLinecap="round"
        />
        {/* rede (linhas suaves de fundo) */}
        <path
          d="M 20 10 L 180 90 M 180 10 L 20 90"
          fill="none"
          stroke="rgb(var(--cor-pitch-line))"
          strokeOpacity={0.15}
          strokeWidth={1}
        />
        {/* marcação da cobrança */}
        <circle cx={x} cy={y} r={7} fill={cor} fillOpacity={0.25} />
        <circle cx={x} cy={y} r={4} fill={cor} />
      </svg>
    </div>
  );
}

function IconePenalti({ acertou }: { acertou: boolean }) {
  if (acertou) {
    return (
      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-pitch">
        <span className="h-1.5 w-1.5 rounded-full bg-pitch" />
      </span>
    );
  }
  return (
    <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-brand text-[9px] font-bold leading-none text-brand">
      ✕
    </span>
  );
}

export function DisputaPenaltis({
  nomeCasa,
  nomeFora,
  cobrancas,
  golsCasa,
  golsFora,
  onConcluido,
}: DisputaPenaltisProps) {
  const [revelados, setRevelados] = useState(0);

  useEffect(() => {
    if (revelados >= cobrancas.length) {
      const t = setTimeout(onConcluido, 1400);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setRevelados((r) => r + 1), 650);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revelados]);

  const rodadas = Math.ceil(cobrancas.length / 2);
  const indiceAtual = revelados > 0 ? revelados - 1 : -1;
  const cobrancaAtual = indiceAtual >= 0 ? cobrancas[indiceAtual] : undefined;

  return (
    <div className="rounded-card border border-gold/40 bg-card p-4 text-ink shadow-card">
      <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-gold">
        Disputa de pênaltis
      </p>

      {cobrancaAtual && (
        <GolinhoPenalti key={indiceAtual} indice={indiceAtual} acertou={cobrancaAtual.converteu} />
      )}

      <div className="space-y-1.5">
        {Array.from({ length: rodadas }).map((_, r) => {
          const casa = cobrancas[r * 2];
          const fora = cobrancas[r * 2 + 1];
          const casaVisivel = r * 2 < revelados;
          const foraVisivel = r * 2 + 1 < revelados;
          return (
            <div key={r} className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                {casaVisivel && casa ? (
                  <>
                    <IconePenalti acertou={casa.converteu} />
                    <span className="truncate">{casa.jogador ?? nomeCasa}</span>
                  </>
                ) : (
                  <span className="text-ink/20">—</span>
                )}
              </div>
              <div className="flex items-center justify-end gap-2 text-right">
                {foraVisivel && fora ? (
                  <>
                    <span className="truncate">{fora.jogador ?? nomeFora}</span>
                    <IconePenalti acertou={fora.converteu} />
                  </>
                ) : (
                  <span className="text-ink/20">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {revelados >= cobrancas.length && (
        <p className="mt-3 text-center font-display text-lg text-gold">
          {golsCasa}-{golsFora} · {golsCasa > golsFora ? "AVANÇOU" : "ELIMINADO"}
        </p>
      )}
    </div>
  );
}
