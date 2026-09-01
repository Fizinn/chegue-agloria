export type Posicao =
  | "GOL"
  | "LD"
  | "ZAG"
  | "LE"
  | "VOL"
  | "MC"
  | "MEI"
  | "CA";

// Categoria ampla usada para casar jogador <-> slot e pra travar posição
// esgotada (ex: se os 4 slots de DEF já foram preenchidos, nenhum defensor
// de próximos sorteios pode mais ser escolhido).
export type PosicaoAmpla = "GOL" | "DEF" | "MEI" | "ATA";

// A qual categoria ampla cada slot específico do campo pertence.
export const CATEGORIA_DO_SLOT: Record<Posicao, PosicaoAmpla> = {
  GOL: "GOL",
  LD: "DEF",
  ZAG: "DEF",
  LE: "DEF",
  VOL: "MEI",
  MC: "MEI",
  MEI: "MEI",
  CA: "ATA",
};

// Quantos slots de titular + banco existem por categoria ampla — isso é o
// que trava a categoria quando esgota, independente da seleção sorteada.
export const CAPACIDADE_TITULAR: Record<PosicaoAmpla, number> = {
  GOL: 1,
  DEF: 4,
  MEI: 4,
  ATA: 2,
};
export const CAPACIDADE_RESERVA: Record<PosicaoAmpla, number> = {
  GOL: 1,
  DEF: 2,
  MEI: 2,
  ATA: 2,
};

export interface Jogador {
  id: string;
  nome: string;
  posicao: Posicao;
  overall: number;
  selecaoId: string;
}

export interface Selecao {
  id: string;
  nome: string;
  sigla: string;
  bandeiraUrl?: string;
}

export type ModoSala = "classico" | "almanaque";

export interface ConfiguracaoSala {
  modo: ModoSala;
  capacidade: 4 | 8 | 16;
  senha?: string;
  publica: boolean;
  tempoDraftSegundos: number;
  anoCopa?: number;
  /** Ordem sorteada dos participantes na chave do mata-mata (lista de
   * player_id). Sorteada uma vez em "REVELAR COPA" e igual pra sala
   * inteira — sem isso, os confrontos seguiam sempre a ordem de entrada
   * na sala, então os mesmos dois jogadores quase sempre se enfrentavam
   * na mesma fase toda vez. */
  chaveamento?: string[];
}

export interface Sala {
  id: string;
  codigo: string;
  hostId: string;
  config: ConfiguracaoSala;
  status: "lobby" | "draft" | "em_andamento" | "finalizado";
  jogadores: ParticipanteSala[];
}

export interface ParticipanteSala {
  id: string;
  apelido: string;
  pronto: boolean;
  escalacao: Record<Posicao, Jogador | null>;
}

export const FORMACAO_4_3_3: Posicao[] = [
  "GOL",
  "LD",
  "ZAG",
  "ZAG",
  "LE",
  "VOL",
  "MC",
  "MEI",
  "CA",
  "CA",
];
