"use client";

import { Posicao } from "@/types/game";
import { JogadorReal } from "@/lib/squads";
import { SlotFormacao } from "@/lib/formacoes";
import { overallDoJogador } from "@/lib/simulacao";

interface CampoProps {
  slots: SlotFormacao[];
  titulares: Record<string, JogadorReal | null>;
  slotsDestacados?: Set<string>;
  mostrarOverall?: boolean;
  onSlotClick?: (slotKey: string, posicao: Posicao) => void;
}

export function Campo({
  slots,
  titulares,
  slotsDestacados,
  mostrarOverall,
  onSlotClick,
}: CampoProps) {
  return (
    <div className="relative aspect-[3/4] w-full max-w-md overflow-hidden rounded-card border-4 border-pitch-line/60 bg-pitch shadow-card">
      <div className="field-lines absolute inset-0" />
      <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-pitch-line/50" />
      <div className="absolute left-1/2 top-0 h-1/6 w-1/2 -translate-x-1/2 border-2 border-t-0 border-pitch-line/50" />
      <div className="absolute bottom-0 left-1/2 h-1/6 w-1/2 -translate-x-1/2 border-2 border-b-0 border-pitch-line/50" />

      {slots.map((slot) => {
        const jogador = titulares[slot.slotKey];
        const destacado = slotsDestacados?.has(slot.slotKey) ?? false;

        return (
          <button
            key={slot.slotKey}
            disabled={!destacado && !jogador}
            onClick={() => onSlotClick?.(slot.slotKey, slot.posicao)}
            style={{ top: slot.top, left: slot.left }}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
          >
            <span
              className={`flex h-11 w-11 items-center justify-center rounded-full border-2 text-[10px] font-semibold text-white transition ${
                jogador
                  ? "border-solid border-gold bg-ink/80"
                  : destacado
                    ? "animate-pulse border-solid border-gold bg-gold/30"
                    : "border-dashed border-pitch-line/60 bg-pitch-dark/40"
              }`}
            >
              {jogador ? (mostrarOverall ? overallDoJogador(jogador) : "?") : ""}
            </span>
            <span className="rounded bg-ink/70 px-1.5 py-0.5 text-[10px] uppercase tracking-wide field-position-label">
              {jogador ? jogador.nome.split(" ").slice(-1)[0] : slot.posicao}
            </span>
          </button>
        );
      })}
    </div>
  );
}
