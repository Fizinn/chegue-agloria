"use client";

import { CAPACIDADE_RESERVA, PosicaoAmpla } from "@/types/game";
import { JogadorReal } from "@/lib/squads";
import { overallDoJogador } from "@/lib/simulacao";

const ORDEM: PosicaoAmpla[] = ["GOL", "DEF", "MEI", "ATA"];

interface BancoProps {
  reservas: Record<PosicaoAmpla, (JogadorReal | null)[]>;
  slotsDestacados?: Set<string>;
  mostrarOverall?: boolean;
  onSlotClick?: (categoria: PosicaoAmpla, indice: number) => void;
}

export function Banco({ reservas, slotsDestacados, mostrarOverall, onSlotClick }: BancoProps) {
  return (
    <div className="rounded-card border border-ink/10 bg-card p-4 shadow-card">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink/50">
        Banco de reservas
      </p>
      <div className="grid grid-cols-2 gap-3">
        {ORDEM.map((categoria) => (
          <div key={categoria}>
            <p className="mb-1 text-[10px] font-semibold uppercase text-ink/40">
              {categoria}
            </p>
            <div className="space-y-1">
              {Array.from({ length: CAPACIDADE_RESERVA[categoria] }).map((_, i) => {
                const slotKey = `${categoria}-res-${i}`;
                const jogador = reservas[categoria]?.[i] ?? null;
                const destacado = slotsDestacados?.has(slotKey) ?? false;
                return (
                  <button
                    key={slotKey}
                    disabled={!destacado && !jogador}
                    onClick={() => onSlotClick?.(categoria, i)}
                    className={`flex w-full items-center justify-between rounded border px-2 py-1 text-xs transition ${
                      jogador
                        ? "border-gold bg-gold/10"
                        : destacado
                          ? "animate-pulse border-gold bg-gold/20"
                          : "border-dashed border-ink/15 text-ink/30"
                    }`}
                  >
                    <span className="truncate">
                      {jogador ? jogador.nome : "—"}
                    </span>
                    {jogador && (
                      <span className="text-ink/40">
                        {mostrarOverall ? overallDoJogador(jogador) : "?"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
