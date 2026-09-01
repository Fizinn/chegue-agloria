"use client";

import { JogadorReal } from "@/lib/squads";
import { SlotFormacao } from "@/lib/formacoes";
import { overallDoJogador } from "@/lib/simulacao";

interface BoxScoreProps {
  slots: SlotFormacao[];
  titulares: Record<string, JogadorReal | null>;
  mostrarOverall: boolean;
}

export function BoxScore({ slots, titulares, mostrarOverall }: BoxScoreProps) {
  const preenchidos = slots.filter((s) => titulares[s.slotKey]).length;

  return (
    <aside className="w-full rounded-card border border-ink/10 bg-card p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-ink/50">
          Box Score · {preenchidos}/{slots.length}
        </p>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-2">
        {(["ataque", "defesa"] as const).map((grupo) => {
          const jogadores = slots
            .filter((s) => {
              const categoria = s.posicao === "GOL" || s.posicao === "LD" || s.posicao === "ZAG" || s.posicao === "LE" ? "defesa" : "ataque";
              return categoria === grupo;
            })
            .map((s) => titulares[s.slotKey])
            .filter((j): j is JogadorReal => Boolean(j));
          const valor = jogadores.length
            ? Math.round(jogadores.reduce((s, j) => s + overallDoJogador(j), 0) / jogadores.length)
            : null;
          return (
            <div key={grupo} className="rounded-lg bg-paper px-2 py-2 text-center">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-ink/45">{grupo}</p>
              <p className="font-display text-2xl text-brand">{mostrarOverall && valor !== null ? valor : "?"}</p>
            </div>
          );
        })}
      </div>
      <ul className="space-y-1.5">
        {slots.map((slot) => {
          const jogador = titulares[slot.slotKey];
          return (
            <li
              key={slot.slotKey}
              className="flex items-center justify-between border-b border-dashed border-ink/10 pb-1 text-sm"
            >
              <span className="w-10 shrink-0 text-xs font-semibold text-ink/40">
                {slot.posicao}
              </span>
              <span className="flex-1 truncate px-2">{jogador ? jogador.nome : "—"}</span>
              {jogador && (
                <span className="text-xs font-semibold text-brand">
                  {mostrarOverall ? overallDoJogador(jogador) : "?"}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
