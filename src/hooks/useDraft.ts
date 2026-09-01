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

  function jogadorPodeSlot(jogador: JogadorReal, posicao: Posicao) {
    const especificas = posicoesJogaveis(jogador);
    return especificas ? especificas.includes(posicao) : CATEGORIA_DO_SLOT[posicao] === jogador.posicao;
  }

  function jogadorPodeCategoria(jogador: JogadorReal, categoria: PosicaoAmpla) {
    return categoriasJogaveis(jogador).includes(categoria);
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
    if (origemSelecionado?.tipo === "titular" && origemSelecionado.slotKey === slotKey) return;

    const ocupante = titulares[slotKey];

    if (ocupante && ocupante.id !== selecionado.id) {
      // Slot ocupado: troca de lugar em vez de bloquear. O jogador que já
      // estava aqui vai pro lugar de onde o selecionado veio (banco ou
      // outro titular) — só se ele também jogar naquela posição/categoria,
      // pra não deixar ninguém escalado fora de posição.
      if (!origemSelecionado) return; // veio da lista de sorteio: não tem "de onde veio" pra mandar quem já tava aqui
      if (origemSelecionado.tipo === "titular") {
        const slotOrigem = slots.find((s) => s.slotKey === origemSelecionado.slotKey);
        if (!slotOrigem || !jogadorPodeSlot(ocupante, slotOrigem.posicao)) return;
        const slotKeyOrigem = origemSelecionado.slotKey;
        setTitulares((prev) => ({ ...prev, [slotKey]: selecionado, [slotKeyOrigem]: ocupante }));
      } else {
        const { categoria, indice } = origemSelecionado;
        if (!jogadorPodeCategoria(ocupante, categoria)) return;
        setTitulares((prev) => ({ ...prev, [slotKey]: selecionado }));
        setReservas((prev) => {
          const copia = { ...prev, [categoria]: [...prev[categoria]] };
          copia[categoria][indice] = ocupante;
          return copia;
        });
      }
      setSelecionado(null);
      setOrigemSelecionado(null);
      return;
    }

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
    if (
      origemSelecionado?.tipo === "reserva" &&
      origemSelecionado.categoria === categoria &&
      origemSelecionado.indice === indice
    )
      return;

    const ocupante = reservas[categoria][indice];

    if (ocupante && ocupante.id !== selecionado.id) {
      // Mesma ideia da troca no titular: quem já estava aqui vai pro lugar
      // de onde o selecionado veio, se der pra jogar lá.
      if (!origemSelecionado) return;
      if (origemSelecionado.tipo === "reserva") {
        const { categoria: categoriaOrigem, indice: indiceOrigem } = origemSelecionado;
        if (!jogadorPodeCategoria(ocupante, categoriaOrigem)) return;
        setReservas((prev) => {
          const copiaDestino = [...prev[categoria]];
          copiaDestino[indice] = selecionado;
          if (categoriaOrigem === categoria) {
            copiaDestino[indiceOrigem] = ocupante;
            return { ...prev, [categoria]: copiaDestino };
          }
          const copiaOrigem = [...prev[categoriaOrigem]];
          copiaOrigem[indiceOrigem] = ocupante;
          return { ...prev, [categoria]: copiaDestino, [categoriaOrigem]: copiaOrigem };
        });
      } else {
        const slotOrigem = slots.find((s) => s.slotKey === origemSelecionado.slotKey);
        if (!slotOrigem || !jogadorPodeSlot(ocupante, slotOrigem.posicao)) return;
        const slotKeyOrigem = origemSelecionado.slotKey;
        setReservas((prev) => {
          const copia = { ...prev, [categoria]: [...prev[categoria]] };
          copia[categoria][indice] = selecionado;
          return copia;
        });
        setTitulares((prev) => ({ ...prev, [slotKeyOrigem]: ocupante }));
      }
      setSelecionado(null);
      setOrigemSelecionado(null);
      return;
    }

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
