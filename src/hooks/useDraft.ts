"use client";

import { useMemo, useState } from "react";
import { Formacao, FORMACOES, capacidadeTitularFormacao } from "@/lib/formacoes";
import { JogadorReal, categoriasJogaveis, posicoesJogaveis } from "@/lib/squads";
import { CAPACIDADE_RESERVA, CATEGORIA_DO_SLOT, Posicao, PosicaoAmpla } from "@/types/game";

const CATEGORIAS: PosicaoAmpla[] = ["GOL", "DEF", "MEI", "ATA"];

type OrigemSelecionado =
  | { tipo: "titular"; slotKey: string }
  | { tipo: "reserva"; categoria: PosicaoAmpla; indice: number }
  | null;

function reservasVazias(): Record<PosicaoAmpla, (JogadorReal | null)[]> {
  return {
    GOL: Array(CAPACIDADE_RESERVA.GOL).fill(null),
    DEF: Array(CAPACIDADE_RESERVA.DEF).fill(null),
    MEI: Array(CAPACIDADE_RESERVA.MEI).fill(null),
    ATA: Array(CAPACIDADE_RESERVA.ATA).fill(null),
  };
}

export function useDraft(formacao: Formacao) {
  const slots = FORMACOES[formacao];
  const capacidadeTitular = useMemo(
    () => capacidadeTitularFormacao(formacao),
    [formacao],
  );

  const [titulares, setTitulares] = useState<Record<string, JogadorReal | null>>({});
  const [reservas, setReservas] =
    useState<Record<PosicaoAmpla, (JogadorReal | null)[]>>(reservasVazias());
  const [usados, setUsados] = useState<Set<string>>(new Set());
  const [selecionado, setSelecionado] = useState<JogadorReal | null>(null);
  const [origemSelecionado, setOrigemSelecionado] = useState<OrigemSelecionado>(null);

  const preenchidosPorCategoria = useMemo(() => {
    const contagem: Record<PosicaoAmpla, number> = { GOL: 0, DEF: 0, MEI: 0, ATA: 0 };
    slots.forEach((slot) => {
      if (titulares[slot.slotKey]) contagem[CATEGORIA_DO_SLOT[slot.posicao]]++;
    });
    CATEGORIAS.forEach((cat) => {
      contagem[cat] += reservas[cat].filter(Boolean).length;
    });
    return contagem;
  }, [titulares, reservas, slots]);

  function categoriaEsgotada(cat: PosicaoAmpla) {
    return (
      preenchidosPorCategoria[cat] >= capacidadeTitular[cat] + CAPACIDADE_RESERVA[cat]
    );
  }

  const timeCompleto = CATEGORIAS.every(categoriaEsgotada);

  // Seleciona um jogador NOVO da lista de sorteio (ainda não está em campo).
  function selecionarJogador(jogador: JogadorReal) {
    const bloqueado = categoriasJogaveis(jogador).every((cat) => categoriaEsgotada(cat));
    if (bloqueado || usados.has(jogador.id)) return;
    setOrigemSelecionado(null);
    setSelecionado((atual) => (atual?.id === jogador.id ? null : jogador));
  }

  // Seleciona um jogador que JÁ ESTÁ em campo, pra poder trocá-lo de lugar
  // (dentro da mesma categoria) e liberar o slot onde ele estava.
  function selecionarJogadorColocado(jogador: JogadorReal, origem: OrigemSelecionado) {
    setSelecionado((atual) => {
      if (atual?.id === jogador.id) {
        setOrigemSelecionado(null);
        return null;
      }
      setOrigemSelecionado(origem);
      return jogador;
    });
  }

  const destacados = useMemo(() => {
    if (!selecionado) return new Set<string>();
    const set = new Set<string>();
    const especificas = posicoesJogaveis(selecionado); // null = joga em qualquer posição da categoria
    const categorias = categoriasJogaveis(selecionado);
    slots.forEach((slot) => {
      const categoriaBate = categorias.includes(CATEGORIA_DO_SLOT[slot.posicao]);
      const posicaoBate = especificas ? especificas.includes(slot.posicao) : categoriaBate;
      if (posicaoBate && !titulares[slot.slotKey]) {
        set.add(slot.slotKey);
      }
    });
    categorias.forEach((categoria) => {
      reservas[categoria].forEach((jogador, i) => {
        if (!jogador) set.add(`${categoria}-res-${i}`);
      });
    });
    return set;
  }, [selecionado, titulares, reservas, slots]);

  function limparOrigem() {
    if (!origemSelecionado) return;
    if (origemSelecionado.tipo === "titular") {
      setTitulares((prev) => ({ ...prev, [origemSelecionado.slotKey]: null }));
    } else {
      setReservas((prev) => {
        const copia = { ...prev, [origemSelecionado.categoria]: [...prev[origemSelecionado.categoria]] };
        copia[origemSelecionado.categoria][origemSelecionado.indice] = null;
        return copia;
      });
    }
  }

  function finalizarEscolha(jogadorId: string, aposEscolher?: () => void) {
    const eraRelocacao = origemSelecionado !== null;
    if (!eraRelocacao) {
      setUsados((prev) => new Set(prev).add(jogadorId));
    }
    setSelecionado(null);
    setOrigemSelecionado(null);
    // Relocação (mover jogador que já estava em campo) não conta como
    // escolher alguém novo — não precisa sortear seleção de novo.
    if (aposEscolher && !eraRelocacao) setTimeout(aposEscolher, 300);
  }

  function colocarNoTitular(
    slotKey: string,
    posicao: Posicao,
    aposEscolher?: () => void,
  ) {
    if (!selecionado) return;
    const especificas = posicoesJogaveis(selecionado);
    const posicaoValida = especificas
      ? especificas.includes(posicao)
      : CATEGORIA_DO_SLOT[posicao] === selecionado.posicao;
    if (!posicaoValida) return;
    if (titulares[slotKey]) return;
    if (origemSelecionado?.tipo === "titular" && origemSelecionado.slotKey === slotKey) return;
    limparOrigem();
    setTitulares((prev) => ({ ...prev, [slotKey]: selecionado }));
    finalizarEscolha(selecionado.id, aposEscolher);
  }

  function colocarNaReserva(
    categoria: PosicaoAmpla,
    indice: number,
    aposEscolher?: () => void,
  ) {
    if (!selecionado) return;
    if (!categoriasJogaveis(selecionado).includes(categoria)) return;
    if (reservas[categoria][indice]) return;
    if (
      origemSelecionado?.tipo === "reserva" &&
      origemSelecionado.categoria === categoria &&
      origemSelecionado.indice === indice
    )
      return;
    limparOrigem();
    setReservas((prev) => {
      const copia = { ...prev, [categoria]: [...prev[categoria]] };
      copia[categoria][indice] = selecionado;
      return copia;
    });
    finalizarEscolha(selecionado.id, aposEscolher);
  }

  return {
    slots,
    capacidadeTitular,
    titulares,
    reservas,
    usados,
    selecionado,
    origemSelecionado,
    destacados,
    categoriaEsgotada,
    timeCompleto,
    selecionarJogador,
    selecionarJogadorColocado,
    colocarNoTitular,
    colocarNaReserva,
  };
}
