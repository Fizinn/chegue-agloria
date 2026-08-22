"use client";

import { JogadorReal } from "@/lib/squads";
import { CATEGORIA_DO_SLOT } from "@/types/game";
import { SlotFormacao } from "@/lib/formacoes";
import { overallDoJogador } from "@/lib/simulacao";

export function calcularOverallsSetores(
  slots: SlotFormacao[],
  titulares: Record<string, JogadorReal | null>,
) {
  const grupos: Record<"ataque" | "defesa", JogadorReal[]> = {
    ataque: [],
    defesa: [],
  };
  slots.forEach((slot) => {
    const jogador = titulares[slot.slotKey];
    if (!jogador) return;
    const categoria = CATEGORIA_DO_SLOT[slot.posicao];
    if (categoria === "ATA" || categoria === "MEI") grupos.ataque.push(jogador);
    if (categoria === "DEF" || categoria === "GOL") grupos.defesa.push(jogador);
  });
  const media = (lista: JogadorReal[]) =>
    lista.length ? Math.round(lista.reduce((s, j) => s + overallDoJogador(j), 0) / lista.length) : null;
  return { ataque: media(grupos.ataque), defesa: media(grupos.defesa) };
}

interface ResumoOverallsProps {
  slots: SlotFormacao[];
  titulares: Record<string, JogadorReal | null>;
  mostrarValores: boolean;
}

export function ResumoOveralls({ slots, titulares, mostrarValores }: ResumoOverallsProps) {
  const { ataque, defesa } = calcularOverallsSetores(slots, titulares);
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-lg border border-brand/20 bg-brand/5 p-3 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-ink/45">Ataque</p>
        <p className="mt-1 font-display text-3xl text-brand">{mostrarValores && ataque !== null ? ataque : "?"}</p>
      </div>
      <div className="rounded-lg border border-pitch/20 bg-pitch/5 p-3 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-ink/45">Defesa</p>
        <p className="mt-1 font-display text-3xl text-pitch">{mostrarValores && defesa !== null ? defesa : "?"}</p>
      </div>
    </div>
  );
}
