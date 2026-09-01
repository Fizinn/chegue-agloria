// Simulação de partida 100% determinística, usada quando um jogador real
// enfrenta outro jogador real. Recebe uma seed compartilhada (ver
// src/lib/rng.ts) e devolve o placar inteiro pronto — minuto a minuto —
// então os dois clientes (o meu navegador e o do adversário), mesmo sem
// trocar nenhuma mensagem em tempo real entre si, calculam exatamente o
// mesmo resultado e o mesmo vencedor.
//
// "casa"/"fora" aqui são papéis CANÔNICOS (decididos comparando os dois IDs
// de jogador, não "eu" e "o outro"), pra garantir que os dois lados
// calculem a mesma coisa. Quem chama essa função depois traduz o
// resultado canônico pra "meus gols" / "gols do adversário".

import { EstiloJogo, expectativaGols } from "@/lib/simulacao";
import { RNG, mulberry32 } from "@/lib/rng";

export type TipoEventoDeterministico =
  | "gol-casa"
  | "gol-fora"
  | "amarelo-casa"
  | "vermelho-casa";

export interface EventoDeterministico {
  minuto: number;
  tipo: TipoEventoDeterministico;
  /** índice 0-10 de um "jogador anônimo" do time da casa — usado só pra
   * decidir qual titular leva o cartão/faz o gol quando quem está montando
   * a tela tem o elenco completo (ou seja, quando o time da casa sou eu). */
  slotIndice: number;
}

export interface CobrancaDeterministica {
  lado: "casa" | "fora";
  converteu: boolean;
  slotIndice: number;
}

export interface PartidaDeterministica {
  golsCasa: number;
  golsFora: number;
  eventos: EventoDeterministico[];
  penaltis?: {
    golsCasa: number;
    golsFora: number;
    cobrancas: CobrancaDeterministica[];
  };
}

function probabilidadeConversaoPenaltiPorForca(forca: number): number {
  const base = 0.76 + (forca - 75) * 0.006;
  return Math.min(0.92, Math.max(0.55, base));
}

function simularPenaltisDeterministico(
  forcaCasa: number,
  forcaFora: number,
  rng: RNG,
): { golsCasa: number; golsFora: number; cobrancas: CobrancaDeterministica[] } {
  const cobrancas: CobrancaDeterministica[] = [];
  let golsCasa = 0;
  let golsFora = 0;
  const minimo = 5;
  let rodada = 0;

  const probCasa = probabilidadeConversaoPenaltiPorForca(forcaCasa);
  const probFora = probabilidadeConversaoPenaltiPorForca(forcaFora);

  while (true) {
    const converteuCasa = rng() < probCasa;
    if (converteuCasa) golsCasa++;
    cobrancas.push({ lado: "casa", converteu: converteuCasa, slotIndice: rodada % 11 });

    const converteuFora = rng() < probFora;
    if (converteuFora) golsFora++;
    cobrancas.push({ lado: "fora", converteu: converteuFora, slotIndice: rodada % 11 });

    rodada++;

    const decidido =
      rodada >= minimo
        ? golsCasa !== golsFora
        : Math.abs(golsCasa - golsFora) > minimo - rodada;

    if (decidido || rodada > 20) break;
  }

  return { golsCasa, golsFora, cobrancas };
}

export function simularPartidaCompletaDeterministica(
  forcaCasa: number,
  forcaFora: number,
  estiloCasa: EstiloJogo,
  rodada: number,
  seed: number,
): PartidaDeterministica {
  const rng = mulberry32(seed);
  const { mediaCasa, mediaFora } = expectativaGols(forcaCasa, forcaFora, estiloCasa, rodada);

  // Mesma "intensidade" de jogo (afeta chance de cartão) usada no modo
  // ao vivo original, só que agora sorteada da seed em vez de Math.random.
  const intensidade = 0.3 + rng() * 1.6;

  let golsCasa = 0;
  let golsFora = 0;
  let penalidadeCasa = 1;
  const amarelosPorSlot: number[] = Array(11).fill(0);
  const eventos: EventoDeterministico[] = [];

  for (let minuto = 1; minuto <= 90; minuto++) {
    if (rng() < (mediaCasa * penalidadeCasa) / 90) {
      golsCasa++;
      eventos.push({ minuto, tipo: "gol-casa", slotIndice: Math.floor(rng() * 11) });
    }

    if (rng() < mediaFora / 90) {
      golsFora++;
      eventos.push({ minuto, tipo: "gol-fora", slotIndice: -1 });
    }

    if (rng() < 0.014 * intensidade) {
      const slotIndice = Math.floor(rng() * 11);
      amarelosPorSlot[slotIndice] += 1;
      if (amarelosPorSlot[slotIndice] >= 2) {
        penalidadeCasa *= 0.8;
        eventos.push({ minuto, tipo: "vermelho-casa", slotIndice });
      } else {
        eventos.push({ minuto, tipo: "amarelo-casa", slotIndice });
      }
    }
  }

  if (golsCasa === golsFora) {
    const penaltis = simularPenaltisDeterministico(forcaCasa, forcaFora, rng);
    return { golsCasa, golsFora, eventos, penaltis };
  }

  return { golsCasa, golsFora, eventos };
}
