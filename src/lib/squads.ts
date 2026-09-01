import { Posicao, PosicaoAmpla, CATEGORIA_DO_SLOT } from "@/types/game";
import type { ResultadoEquipe } from "@/lib/simulacao";

export interface JogadorReal {
  id: string;
  /** ID estável da fonte de dados (usado como chave do Overall Manual). */
  sourcePlayerId?: string;
  nome: string;
  posicao: PosicaoAmpla; // categoria ampla: GOL, DEF, MEI, ATA
  numero: number; // 0 quando a fonte não registra número de camisa (comum antes de 1954)
  clube: string;
  ano?: number; // ano da Copa que ele disputou (usado pelo override manual de overall)
  resultadoEquipe?: ResultadoEquipe; // como o time terminou aquela Copa (fato real)
  premio?: number; // bônus por prêmio individual real (Bola de Ouro etc.) — 0 se nenhum
  desempenho?: number; // bônus/penalidade por jogos, titularidade e gols reais naquela Copa
}

// A fonte de dados (Fjelstul World Cup Database, assim como a própria
// Wikipédia de onde ela deriva) só registra a posição em 4 categorias
// amplas — GK/DF/MF/FW — pra TODOS os +10 mil jogadores do banco. Não
// existe, em nenhuma fonte pública verificável, a posição específica
// (lateral-direito vs zagueiro, ponta vs centroavante etc.) de cada
// jogador de cada ano de Copa. Pesquisado e confirmado; não dá pra
// preencher isso sem inventar.
//
// Por isso, curamos manualmente a posição específica só de um grupo de
// craques bem conhecidos (uma pequena lista, sem pretensão de ser
// completa). Todo o resto do elenco continua podendo jogar em qualquer
// posição específica dentro da própria categoria ampla, como já era.
//
// Chave = nome exatamente como aparece na fonte de dados.
const POSICOES_ESPECIFICAS_CONHECIDAS: Record<string, Posicao[]> = {
  // Laterais/zagueiros com posição real bem fixa
  "Cafu": ["LD"],
  "Roberto Carlos": ["LE"],
  "Franz Beckenbauer": ["ZAG"],
  "Virgil Van Dijk": ["ZAG"],
  "Virgil van Dijk": ["ZAG"],

  // Meio-campistas (posição específica dentro do meio, e alguns que
  // também atuavam avançados o suficiente pra jogar no ataque)
  "Xavi": ["MC"],
  "Xabi Alonso": ["VOL"],
  "Toni Kroos": ["MC", "VOL"],
  "Michael Ballack": ["MC", "VOL"],
  "Andrés Iniesta": ["MEI", "MC"],
  "Zinedine Zidane": ["MEI", "MC"],
  "Zinédine Zidane": ["MEI", "MC"],
  "Kaká": ["MEI"],
  "Luka Modrić": ["MC", "MEI"],
  "Kevin De Bruyne": ["MEI", "MC"],
  "Ronaldinho": ["MEI", "CA"],
  "Franck Ribéry": ["MEI", "CA"],
  "Arjen Robben": ["MEI", "CA"],
  "Johan Cruyff": ["MEI", "CA"],
  "Diego Maradona": ["MEI", "CA"],
  "Francesco Totti": ["MEI", "CA"],

  // Atacantes que também armam jogo (por isso valem MEI, não só CA —
  // atacante "puro" não ganha nada de específico, já que o jogo só tem
  // uma posição de ataque, CA)
  "Lionel Messi": ["MEI", "CA"],
  "Lionel Andrés Messi": ["MEI", "CA"],
  "Neymar": ["MEI", "CA"],
  "Neymar Neymar Jr": ["MEI", "CA"],
  "Antoine Griezmann": ["MEI", "CA"],
};

/**
 * Posições específicas jogáveis por um jogador. Se ele estiver na tabela
 * curada E a curadoria bater com a categoria ampla real daquele registro
 * (pra não contradizer a fonte de dados em anos com classificação
 * diferente), retorna a lista curada. Senão, retorna null — o chamador
 * deve tratar null como "joga em qualquer posição específica da própria
 * categoria ampla" (comportamento padrão, igual já era antes).
 */
export function posicoesJogaveis(jogador: JogadorReal): Posicao[] | null {
  const lista = POSICOES_ESPECIFICAS_CONHECIDAS[jogador.nome];
  if (!lista) return null;
  const categoriasCobertas = new Set(lista.map((p) => CATEGORIA_DO_SLOT[p]));
  if (!categoriasCobertas.has(jogador.posicao)) return null;
  return lista;
}

/** Categorias amplas em que o jogador pode ser escalado (normalmente só
 * a dele própria; craques versáteis curados podem ter mais de uma). */
export function categoriasJogaveis(jogador: JogadorReal): PosicaoAmpla[] {
  const especificas = posicoesJogaveis(jogador);
  if (!especificas) return [jogador.posicao];
  return Array.from(new Set(especificas.map((p) => CATEGORIA_DO_SLOT[p])));
}

export interface ElencoSelecao {
  id: string;
  selecao: string;
  sigla: string;
  ano: number;
  competicao: string;
  jogadores: JogadorReal[];
}

// Fonte: Fjelstul World Cup Database (jfjelstul/worldcup, CC-BY-SA 4.0),
// coletado via datahub.io/football/worldcup — dado de posição (GK/DF/MF/FW)
// checado contra relatórios oficiais da FIFA e Wikipédia. Não é dado
// inventado pelo chat: veio de um dataset público, verificável e citável.
export const ELENCOS_REAIS: ElencoSelecao[] = [
  {
    id: "kr-2022",
    selecao: "Coreia do Sul",
    sigla: "KR",
    ano: 2022,
    competicao: "Copa do Mundo",
    jogadores: [
      { id: "kr22-1", nome: "Kim Seung-gyu", posicao: "GOL", numero: 1, clube: "Al-Shabab", ano: 2022 },
      { id: "kr22-12", sourcePlayerId: "P-49090", nome: "Song Bum-keun", posicao: "GOL", numero: 12, clube: "Jeonbuk Hyundai Motors", ano: 2022 },
      { id: "kr22-21", nome: "Jo Hyeon-woo", posicao: "GOL", numero: 21, clube: "Ulsan Hyundai", ano: 2022 },
      { id: "kr22-2", sourcePlayerId: "P-88529", nome: "Yoon Jong-gyu", posicao: "DEF", numero: 2, clube: "FC Seoul", ano: 2022 },
      { id: "kr22-3", sourcePlayerId: "P-82889", nome: "Kim Jin-su", posicao: "DEF", numero: 3, clube: "Jeonbuk Hyundai Motors", ano: 2022 },
      { id: "kr22-4", sourcePlayerId: "P-14360", nome: "Kim Min-jae", posicao: "DEF", numero: 4, clube: "Napoli", ano: 2022 },
      { id: "kr22-14", nome: "Hong Chul", posicao: "DEF", numero: 14, clube: "Daegu FC", ano: 2022 },
      { id: "kr22-15", sourcePlayerId: "P-07233", nome: "Kim Moon-hwan", posicao: "DEF", numero: 15, clube: "Jeonbuk Hyundai Motors", ano: 2022 },
      { id: "kr22-19", nome: "Kim Young-gwon", posicao: "DEF", numero: 19, clube: "Ulsan Hyundai", ano: 2022 },
      { id: "kr22-20", sourcePlayerId: "P-57511", nome: "Kwon Kyung-won", posicao: "DEF", numero: 20, clube: "Gamba Osaka", ano: 2022 },
      { id: "kr22-23", sourcePlayerId: "P-66969", nome: "Kim Tae-hwan", posicao: "DEF", numero: 23, clube: "Ulsan Hyundai", ano: 2022 },
      { id: "kr22-24", sourcePlayerId: "P-05917", nome: "Cho Yu-min", posicao: "DEF", numero: 24, clube: "Daejeon Hana Citizen", ano: 2022 },
      { id: "kr22-5", nome: "Jung Woo-young", posicao: "MEI", numero: 5, clube: "Al-Sadd", ano: 2022 },
      { id: "kr22-6", sourcePlayerId: "P-67516", nome: "Hwang In-beom", posicao: "MEI", numero: 6, clube: "Olympiacos", ano: 2022 },
      { id: "kr22-7", nome: "Son Heung-min", posicao: "MEI", numero: 7, clube: "Tottenham Hotspur", ano: 2022 },
      { id: "kr22-8", sourcePlayerId: "P-32599", nome: "Paik Seung-ho", posicao: "MEI", numero: 8, clube: "Jeonbuk Hyundai Motors", ano: 2022 },
      { id: "kr22-10", nome: "Lee Jae-sung", posicao: "MEI", numero: 10, clube: "Mainz 05", ano: 2022 },
      { id: "kr22-11", nome: "Hwang Hee-chan", posicao: "MEI", numero: 11, clube: "Wolverhampton Wanderers", ano: 2022 },
      { id: "kr22-13", sourcePlayerId: "P-61172", nome: "Son Jun-ho", posicao: "MEI", numero: 13, clube: "Shandong Taishan", ano: 2022 },
      { id: "kr22-17", sourcePlayerId: "P-10357", nome: "Na Sang-ho", posicao: "MEI", numero: 17, clube: "FC Seoul", ano: 2022 },
      { id: "kr22-18", sourcePlayerId: "P-87514", nome: "Lee Kang-in", posicao: "MEI", numero: 18, clube: "Mallorca", ano: 2022 },
      { id: "kr22-22", sourcePlayerId: "P-88360", nome: "Kwon Chang-hoon", posicao: "MEI", numero: 22, clube: "Gimcheon Sangmu", ano: 2022 },
      { id: "kr22-25", sourcePlayerId: "P-94500", nome: "Jeong Woo-yeong", posicao: "MEI", numero: 25, clube: "SC Freiburg", ano: 2022 },
      { id: "kr22-26", sourcePlayerId: "P-97485", nome: "Song Min-kyu", posicao: "MEI", numero: 26, clube: "Jeonbuk Hyundai Motors", ano: 2022 },
      { id: "kr22-9", sourcePlayerId: "P-87169", nome: "Cho Gue-sung", posicao: "ATA", numero: 9, clube: "Jeonbuk Hyundai Motors", ano: 2022 },
      { id: "kr22-16", sourcePlayerId: "P-92710", nome: "Hwang Ui-jo", posicao: "ATA", numero: 16, clube: "Olympiacos", ano: 2022 },
    ],
  },
  {
    id: "arg-1930", selecao: "Argentina", sigla: "ARG", ano: 1930, competicao: "Copa do Mundo",
    jogadores: [
      { id: "arg30-1", sourcePlayerId: "P-69244", nome: "Ángel Bossio", posicao: "GOL", numero: 0, clube: "", resultadoEquipe: "vice", ano: 1930 },
      { id: "arg30-2", sourcePlayerId: "P-23160", nome: "Juan Botasso", posicao: "GOL", numero: 0, clube: "", resultadoEquipe: "vice", ano: 1930 },
      { id: "arg30-3", sourcePlayerId: "P-99230", nome: "Roberto Cherro", posicao: "ATA", numero: 0, clube: "", resultadoEquipe: "vice", ano: 1930 },
      { id: "arg30-4", sourcePlayerId: "P-41921", nome: "Alberto Chividini", posicao: "DEF", numero: 0, clube: "", resultadoEquipe: "vice", ano: 1930 },
      { id: "arg30-5", sourcePlayerId: "P-22739", nome: "José Della Torre", posicao: "DEF", numero: 0, clube: "", resultadoEquipe: "vice", ano: 1930 },
      { id: "arg30-6", sourcePlayerId: "P-30720", nome: "Attilio Demaría", posicao: "ATA", numero: 0, clube: "", resultadoEquipe: "vice", ano: 1930 },
      { id: "arg30-7", sourcePlayerId: "P-30543", nome: "Juan Evaristo", posicao: "MEI", numero: 0, clube: "", resultadoEquipe: "vice", ano: 1930 },
      { id: "arg30-8", sourcePlayerId: "P-23897", nome: "Mario Evaristo", posicao: "ATA", numero: 0, clube: "", resultadoEquipe: "vice", ano: 1930 },
      { id: "arg30-9", sourcePlayerId: "P-60505", nome: "Manuel Ferreira", posicao: "ATA", numero: 0, clube: "", resultadoEquipe: "vice", ano: 1930 },
      { id: "arg30-10", sourcePlayerId: "P-25760", nome: "Luis Monti", posicao: "MEI", numero: 0, clube: "", resultadoEquipe: "vice", ano: 1930 },
      { id: "arg30-11", sourcePlayerId: "P-49556", nome: "Ramón Muttis", posicao: "DEF", numero: 0, clube: "", resultadoEquipe: "vice", ano: 1930 },
      { id: "arg30-12", sourcePlayerId: "P-91238", nome: "Rodolfo Orlandini", posicao: "MEI", numero: 0, clube: "", resultadoEquipe: "vice", ano: 1930 },
      { id: "arg30-13", sourcePlayerId: "P-58537", nome: "Fernando Paternoster", posicao: "DEF", numero: 0, clube: "", resultadoEquipe: "vice", ano: 1930 },
      { id: "arg30-14", sourcePlayerId: "P-24312", nome: "Natalio Perinetti", posicao: "ATA", numero: 0, clube: "", resultadoEquipe: "vice", ano: 1930 },
      { id: "arg30-15", sourcePlayerId: "P-70166", nome: "Carlos Peucelle", posicao: "ATA", numero: 0, clube: "", resultadoEquipe: "vice", ano: 1930 },
      { id: "arg30-16", sourcePlayerId: "P-49151", nome: "Edmundo Piaggio", posicao: "DEF", numero: 0, clube: "", resultadoEquipe: "vice", ano: 1930 },
      { id: "arg30-17", sourcePlayerId: "P-44916", nome: "Alejandro Scopelli", posicao: "ATA", numero: 0, clube: "", resultadoEquipe: "vice", ano: 1930 },
      { id: "arg30-18", sourcePlayerId: "P-21441", nome: "Carlos Spadaro", posicao: "ATA", numero: 0, clube: "", resultadoEquipe: "vice", ano: 1930 },
      { id: "arg30-19", sourcePlayerId: "P-56486", nome: "Guillermo Stábile", posicao: "ATA", numero: 0, clube: "", resultadoEquipe: "vice", ano: 1930 },
      { id: "arg30-20", sourcePlayerId: "P-56908", nome: "Arico Suárez", posicao: "MEI", numero: 0, clube: "", resultadoEquipe: "vice", ano: 1930 },
      { id: "arg30-21", sourcePlayerId: "P-37326", nome: "Francisco Varallo", posicao: "ATA", numero: 0, clube: "", resultadoEquipe: "vice", ano: 1930 },
      { id: "arg30-22", sourcePlayerId: "P-76546", nome: "Adolfo Zumelzú", posicao: "MEI", numero: 0, clube: "", resultadoEquipe: "vice", ano: 1930 },
    ],
  },
  {
    id: "bel-1930", selecao: "Bélgica", sigla: "BEL", ano: 1930, competicao: "Copa do Mundo",
    jogadores: [
      { id: "bel30-1", sourcePlayerId: "P-92795", nome: "Ferdinand Adams", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "bel30-2", sourcePlayerId: "P-20690", nome: "Arnold Badjou", posicao: "GOL", numero: 0, clube: "", ano: 1930 },
      { id: "bel30-3", sourcePlayerId: "P-40714", nome: "Pierre Braine", posicao: "MEI", numero: 0, clube: "", ano: 1930 },
      { id: "bel30-4", sourcePlayerId: "P-41990", nome: "Alexis Chantraine", posicao: "MEI", numero: 0, clube: "", ano: 1930 },
      { id: "bel30-5", sourcePlayerId: "P-97126", nome: "Jean De Bie", posicao: "GOL", numero: 0, clube: "", ano: 1930 },
      { id: "bel30-6", sourcePlayerId: "P-93713", nome: "Jean De Clercq", posicao: "MEI", numero: 0, clube: "", ano: 1930 },
      { id: "bel30-7", sourcePlayerId: "P-41710", nome: "Henri De Deken", posicao: "DEF", numero: 0, clube: "", ano: 1930 },
      { id: "bel30-8", sourcePlayerId: "P-45315", nome: "Gérard Delbeke", posicao: "MEI", numero: 0, clube: "", ano: 1930 },
      { id: "bel30-9", sourcePlayerId: "P-16891", nome: "Jan Diddens", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "bel30-10", sourcePlayerId: "P-61253", nome: "August Hellemans", posicao: "MEI", numero: 0, clube: "", ano: 1930 },
      { id: "bel30-11", sourcePlayerId: "P-44475", nome: "Nic Hoydonckx", posicao: "DEF", numero: 0, clube: "", ano: 1930 },
      { id: "bel30-12", sourcePlayerId: "P-74839", nome: "Jacques Moeschal", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "bel30-13", sourcePlayerId: "P-46390", nome: "Theodore Nouwens", posicao: "DEF", numero: 0, clube: "", ano: 1930 },
      { id: "bel30-14", sourcePlayerId: "P-28503", nome: "André Saeys", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "bel30-15", sourcePlayerId: "P-69286", nome: "Louis Versyp", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "bel30-16", sourcePlayerId: "P-85443", nome: "Bernard Voorhoof", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
    ],
  },
  {
    id: "bol-1930", selecao: "Bolívia", sigla: "BOL", ano: 1930, competicao: "Copa do Mundo",
    jogadores: [
      { id: "bol30-1", sourcePlayerId: "P-43807", nome: "Mario Alborta", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "bol30-2", sourcePlayerId: "P-62751", nome: "Juan Argote", posicao: "MEI", numero: 0, clube: "", ano: 1930 },
      { id: "bol30-3", sourcePlayerId: "P-95008", nome: "Jesús Bermúdez", posicao: "GOL", numero: 0, clube: "", ano: 1930 },
      { id: "bol30-4", sourcePlayerId: "P-97354", nome: "Miguel Brito", posicao: "MEI", numero: 0, clube: "", ano: 1930 },
      { id: "bol30-5", sourcePlayerId: "P-16019", nome: "José Bustamante", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "bol30-6", sourcePlayerId: "P-36835", nome: "Casiano Chavarría", posicao: "DEF", numero: 0, clube: "", ano: 1930 },
      { id: "bol30-7", sourcePlayerId: "P-69877", nome: "Segundo Durandal", posicao: "DEF", numero: 0, clube: "", ano: 1930 },
      { id: "bol30-8", sourcePlayerId: "P-61667", nome: "René Fernández", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "bol30-9", sourcePlayerId: "P-48216", nome: "Gumercindo Gómez", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "bol30-10", sourcePlayerId: "P-92600", nome: "Diógenes Lara", posicao: "MEI", numero: 0, clube: "", ano: 1930 },
      { id: "bol30-11", sourcePlayerId: "P-84833", nome: "Rafael Méndez", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "bol30-12", sourcePlayerId: "P-92838", nome: "Miguel Murillo", posicao: "GOL", numero: 0, clube: "", ano: 1930 },
      { id: "bol30-13", sourcePlayerId: "P-93364", nome: "Constantino Noya", posicao: "MEI", numero: 0, clube: "", ano: 1930 },
      { id: "bol30-14", sourcePlayerId: "P-56114", nome: "Eduardo Reyes Ortiz", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "bol30-15", sourcePlayerId: "P-35684", nome: "Luis Reyes Peñaranda", posicao: "DEF", numero: 0, clube: "", ano: 1930 },
      { id: "bol30-16", sourcePlayerId: "P-00369", nome: "Renato Sáinz", posicao: "MEI", numero: 0, clube: "", ano: 1930 },
      { id: "bol30-17", sourcePlayerId: "P-67934", nome: "Jorge Valderrama", posicao: "MEI", numero: 0, clube: "", ano: 1930 },
    ],
  },
  {
    id: "bra-1930", selecao: "Brasil", sigla: "BRA", ano: 1930, competicao: "Copa do Mundo",
    jogadores: [
      { id: "bra30-1", sourcePlayerId: "P-13299", nome: "Araken", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "bra30-2", sourcePlayerId: "P-70170", nome: "Benedicto", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "bra30-3", sourcePlayerId: "P-11648", nome: "Benvenuto", posicao: "MEI", numero: 0, clube: "", ano: 1930 },
      { id: "bra30-4", sourcePlayerId: "P-81166", nome: "Brilhante", posicao: "DEF", numero: 0, clube: "", ano: 1930 },
      { id: "bra30-5", sourcePlayerId: "P-58460", nome: "Doca", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "bra30-6", sourcePlayerId: "P-52323", nome: "Fausto", posicao: "DEF", numero: 0, clube: "", ano: 1930 },
      { id: "bra30-7", sourcePlayerId: "P-00708", nome: "Fernando", posicao: "MEI", numero: 0, clube: "", ano: 1930 },
      { id: "bra30-8", sourcePlayerId: "P-49818", nome: "Fortes", posicao: "MEI", numero: 0, clube: "", ano: 1930 },
      { id: "bra30-9", sourcePlayerId: "P-29865", nome: "Hermógenes", posicao: "DEF", numero: 0, clube: "", ano: 1930 },
      { id: "bra30-10", sourcePlayerId: "P-92427", nome: "Itália", posicao: "DEF", numero: 0, clube: "", ano: 1930 },
      { id: "bra30-11", sourcePlayerId: "P-16656", nome: "Joel", posicao: "GOL", numero: 0, clube: "", ano: 1930 },
      { id: "bra30-12", sourcePlayerId: "P-72889", nome: "Carvalho Leite", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "bra30-13", sourcePlayerId: "P-30679", nome: "Manoelzinho", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "bra30-14", sourcePlayerId: "P-49633", nome: "Ivan Mariz", posicao: "MEI", numero: 0, clube: "", ano: 1930 },
      { id: "bra30-15", sourcePlayerId: "P-83987", nome: "Moderato", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "bra30-16", sourcePlayerId: "P-10526", nome: "Nilo", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "bra30-17", sourcePlayerId: "P-52064", nome: "Oscarino", posicao: "MEI", numero: 0, clube: "", ano: 1930 },
      { id: "bra30-18", sourcePlayerId: "P-32535", nome: "Pamplona", posicao: "MEI", numero: 0, clube: "", ano: 1930 },
      { id: "bra30-19", sourcePlayerId: "P-38379", nome: "Poly", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "bra30-20", sourcePlayerId: "P-91171", nome: "Preguinho", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "bra30-21", sourcePlayerId: "P-82422", nome: "Russinho", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "bra30-22", sourcePlayerId: "P-26796", nome: "Teóphilo", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "bra30-23", sourcePlayerId: "P-28745", nome: "Velloso", posicao: "GOL", numero: 0, clube: "", ano: 1930 },
      { id: "bra30-24", sourcePlayerId: "P-22493", nome: "Zé Luiz", posicao: "DEF", numero: 0, clube: "", ano: 1930 },
    ],
  },
  {
    id: "chl-1930", selecao: "Chile", sigla: "CHL", ano: 1930, competicao: "Copa do Mundo",
    jogadores: [
      { id: "chl30-1", sourcePlayerId: "P-95800", nome: "Juan Aguilera", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "chl30-2", sourcePlayerId: "P-33635", nome: "Guillermo Arellano", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "chl30-3", sourcePlayerId: "P-54301", nome: "Ernesto Chaparro", posicao: "DEF", numero: 0, clube: "", ano: 1930 },
      { id: "chl30-4", sourcePlayerId: "P-88235", nome: "Arturo Coddou", posicao: "MEI", numero: 0, clube: "", ano: 1930 },
      { id: "chl30-5", sourcePlayerId: "P-01278", nome: "Roberto Cortés", posicao: "GOL", numero: 0, clube: "", ano: 1930 },
      { id: "chl30-6", sourcePlayerId: "P-41928", nome: "Humberto Elgueta", posicao: "MEI", numero: 0, clube: "", ano: 1930 },
      { id: "chl30-7", sourcePlayerId: "P-32614", nome: "César Espinoza", posicao: "GOL", numero: 0, clube: "", ano: 1930 },
      { id: "chl30-8", sourcePlayerId: "P-07122", nome: "Víctor Morales", posicao: "DEF", numero: 0, clube: "", ano: 1930 },
      { id: "chl30-9", sourcePlayerId: "P-66860", nome: "Horacio Muñoz", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "chl30-10", sourcePlayerId: "P-19195", nome: "Tomás Ojeda", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "chl30-11", sourcePlayerId: "P-97943", nome: "Ulises Poirier", posicao: "DEF", numero: 0, clube: "", ano: 1930 },
      { id: "chl30-12", sourcePlayerId: "P-85142", nome: "Guillermo Riveros", posicao: "DEF", numero: 0, clube: "", ano: 1930 },
      { id: "chl30-13", sourcePlayerId: "P-49261", nome: "Guillermo Saavedra", posicao: "MEI", numero: 0, clube: "", ano: 1930 },
      { id: "chl30-14", sourcePlayerId: "P-89829", nome: "Carlos Schneeberger", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "chl30-15", sourcePlayerId: "P-08459", nome: "Guillermo Subiabre", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "chl30-16", sourcePlayerId: "P-10927", nome: "Arturo Torres", posicao: "MEI", numero: 0, clube: "", ano: 1930 },
      { id: "chl30-17", sourcePlayerId: "P-28795", nome: "Casimiro Torres", posicao: "MEI", numero: 0, clube: "", ano: 1930 },
      { id: "chl30-18", sourcePlayerId: "P-61338", nome: "Carlos Vidal", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "chl30-19", sourcePlayerId: "P-65664", nome: "Eberardo Villalobos", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
    ],
  },
  {
    id: "fra-1930", selecao: "França", sigla: "FRA", ano: 1930, competicao: "Copa do Mundo",
    jogadores: [
      { id: "fra30-1", sourcePlayerId: "P-68817", nome: "Numa Andoire", posicao: "DEF", numero: 0, clube: "", ano: 1930 },
      { id: "fra30-2", sourcePlayerId: "P-77318", nome: "Marcel Capelle", posicao: "DEF", numero: 0, clube: "", ano: 1930 },
      { id: "fra30-3", sourcePlayerId: "P-83054", nome: "Augustin Chantrel", posicao: "MEI", numero: 0, clube: "", ano: 1930 },
      { id: "fra30-4", sourcePlayerId: "P-10604", nome: "Edmond Delfour", posicao: "MEI", numero: 0, clube: "", ano: 1930 },
      { id: "fra30-5", sourcePlayerId: "P-53878", nome: "Célestin Delmer", posicao: "MEI", numero: 0, clube: "", ano: 1930 },
      { id: "fra30-6", sourcePlayerId: "P-99087", nome: "Marcel Langiller", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "fra30-7", sourcePlayerId: "P-73308", nome: "Jean Laurent", posicao: "DEF", numero: 0, clube: "", ano: 1930 },
      { id: "fra30-8", sourcePlayerId: "P-05470", nome: "Lucien Laurent", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "fra30-9", sourcePlayerId: "P-89688", nome: "Ernest Libérati", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "fra30-10", sourcePlayerId: "P-60620", nome: "André Maschinot", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "fra30-11", sourcePlayerId: "P-67332", nome: "Étienne Mattler", posicao: "DEF", numero: 0, clube: "", ano: 1930 },
      { id: "fra30-12", sourcePlayerId: "P-58728", nome: "Marcel Pinel", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "fra30-13", sourcePlayerId: "P-62322", nome: "André Tassin", posicao: "GOL", numero: 0, clube: "", ano: 1930 },
      { id: "fra30-14", sourcePlayerId: "P-50248", nome: "Alex Thépot", posicao: "GOL", numero: 0, clube: "", ano: 1930 },
      { id: "fra30-15", sourcePlayerId: "P-02281", nome: "Émile Veinante", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "fra30-16", sourcePlayerId: "P-48345", nome: "Alexandre Villaplane", posicao: "MEI", numero: 0, clube: "", ano: 1930 },
    ],
  },
  {
    id: "mex-1930", selecao: "México", sigla: "MEX", ano: 1930, competicao: "Copa do Mundo",
    jogadores: [
      { id: "mex30-1", sourcePlayerId: "P-36379", nome: "Efraín Amézcua", posicao: "MEI", numero: 0, clube: "", ano: 1930 },
      { id: "mex30-2", sourcePlayerId: "P-33560", nome: "Oscar Bonfiglio", posicao: "GOL", numero: 0, clube: "", ano: 1930 },
      { id: "mex30-3", sourcePlayerId: "P-94135", nome: "Juan Carreño", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "mex30-4", sourcePlayerId: "P-33321", nome: "Jesús Castro", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "mex30-5", sourcePlayerId: "P-43777", nome: "Rafael Garza Gutiérrez", posicao: "DEF", numero: 0, clube: "", ano: 1930 },
      { id: "mex30-6", sourcePlayerId: "P-41910", nome: "Francisco Garza Gutiérrez", posicao: "DEF", numero: 0, clube: "", ano: 1930 },
      { id: "mex30-7", sourcePlayerId: "P-31066", nome: "Roberto Gayón", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "mex30-8", sourcePlayerId: "P-84297", nome: "Hilario López", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "mex30-9", sourcePlayerId: "P-21313", nome: "Dionisio Mejía", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "mex30-10", sourcePlayerId: "P-27734", nome: "Felipe Olivares", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "mex30-11", sourcePlayerId: "P-31687", nome: "Luis Pérez", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "mex30-12", sourcePlayerId: "P-58196", nome: "Raymundo Rodríguez", posicao: "MEI", numero: 0, clube: "", ano: 1930 },
      { id: "mex30-13", sourcePlayerId: "P-08566", nome: "Felipe Rosas", posicao: "MEI", numero: 0, clube: "", ano: 1930 },
      { id: "mex30-14", sourcePlayerId: "P-89481", nome: "Manuel Rosas", posicao: "DEF", numero: 0, clube: "", ano: 1930 },
      { id: "mex30-15", sourcePlayerId: "P-17565", nome: "José Ruíz", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "mex30-16", sourcePlayerId: "P-83291", nome: "Alfredo Viejo Sánchez", posicao: "MEI", numero: 0, clube: "", ano: 1930 },
      { id: "mex30-17", sourcePlayerId: "P-65099", nome: "Isidoro Sota", posicao: "GOL", numero: 0, clube: "", ano: 1930 },
    ],
  },
  {
    id: "pry-1930", selecao: "Paraguai", sigla: "PRY", ano: 1930, competicao: "Copa do Mundo",
    jogadores: [
      { id: "pry30-1", sourcePlayerId: "P-33814", nome: "Francisco Aguirre", posicao: "MEI", numero: 0, clube: "", ano: 1930 },
      { id: "pry30-2", sourcePlayerId: "P-35834", nome: "Pedro Benítez", posicao: "GOL", numero: 0, clube: "", ano: 1930 },
      { id: "pry30-3", sourcePlayerId: "P-30741", nome: "Santiago Benítez", posicao: "MEI", numero: 0, clube: "", ano: 1930 },
      { id: "pry30-4", sourcePlayerId: "P-78377", nome: "Delfín Benítez Cáceres", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "pry30-5", sourcePlayerId: "P-61392", nome: "Saguier Carreras", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "pry30-6", sourcePlayerId: "P-51301", nome: "Eustacio Chamorro", posicao: "DEF", numero: 0, clube: "", ano: 1930 },
      { id: "pry30-7", sourcePlayerId: "P-68567", nome: "Modesto Denis", posicao: "GOL", numero: 0, clube: "", ano: 1930 },
      { id: "pry30-8", sourcePlayerId: "P-37309", nome: "Eusebio Díaz", posicao: "MEI", numero: 0, clube: "", ano: 1930 },
      { id: "pry30-9", sourcePlayerId: "P-21707", nome: "Diógenes Domínguez", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "pry30-10", sourcePlayerId: "P-08814", nome: "Romildo Etcheverry", posicao: "MEI", numero: 0, clube: "", ano: 1930 },
      { id: "pry30-11", sourcePlayerId: "P-54557", nome: "Diego Florentín", posicao: "MEI", numero: 0, clube: "", ano: 1930 },
      { id: "pry30-12", sourcePlayerId: "P-86082", nome: "Salvador Flores", posicao: "DEF", numero: 0, clube: "", ano: 1930 },
      { id: "pry30-13", sourcePlayerId: "P-65504", nome: "Tranquilino Garcete", posicao: "MEI", numero: 0, clube: "", ano: 1930 },
      { id: "pry30-14", sourcePlayerId: "P-64697", nome: "Aurelio González", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "pry30-15", sourcePlayerId: "P-04623", nome: "José Miracca", posicao: "DEF", numero: 0, clube: "", ano: 1930 },
      { id: "pry30-16", sourcePlayerId: "P-98075", nome: "Lino Nessi", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "pry30-17", sourcePlayerId: "P-11035", nome: "Quiterio Olmedo", posicao: "DEF", numero: 0, clube: "", ano: 1930 },
      { id: "pry30-18", sourcePlayerId: "P-09057", nome: "Amadeo Ortega", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "pry30-19", sourcePlayerId: "P-04417", nome: "Bernabé Rivera", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "pry30-20", sourcePlayerId: "P-51624", nome: "Gerardo Romero", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "pry30-21", sourcePlayerId: "P-06201", nome: "Luis Vargas Peña", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "pry30-22", sourcePlayerId: "P-51390", nome: "Jacinto Villalba", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
    ],
  },
  {
    id: "per-1930", selecao: "Peru", sigla: "PER", ano: 1930, competicao: "Copa do Mundo",
    jogadores: [
      { id: "per30-1", sourcePlayerId: "P-35875", nome: "Eduardo Astengo", posicao: "MEI", numero: 0, clube: "", ano: 1930 },
      { id: "per30-2", sourcePlayerId: "P-45407", nome: "Carlos Cillóniz", posicao: "MEI", numero: 0, clube: "", ano: 1930 },
      { id: "per30-3", sourcePlayerId: "P-79515", nome: "Mario de las Casas", posicao: "DEF", numero: 0, clube: "", ano: 1930 },
      { id: "per30-4", sourcePlayerId: "P-07526", nome: "Alberto Denegri", posicao: "MEI", numero: 0, clube: "", ano: 1930 },
      { id: "per30-5", sourcePlayerId: "P-45649", nome: "Arturo Fernández", posicao: "DEF", numero: 0, clube: "", ano: 1930 },
      { id: "per30-6", sourcePlayerId: "P-64036", nome: "Plácido Galindo", posicao: "MEI", numero: 0, clube: "", ano: 1930 },
      { id: "per30-7", sourcePlayerId: "P-38495", nome: "Domingo García", posicao: "MEI", numero: 0, clube: "", ano: 1930 },
      { id: "per30-8", sourcePlayerId: "P-29687", nome: "Jorge Góngora", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "per30-9", sourcePlayerId: "P-93477", nome: "José María Lavalle", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "per30-10", sourcePlayerId: "P-44526", nome: "Julio Lores", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "per30-11", sourcePlayerId: "P-57115", nome: "Antonio Maquilón", posicao: "DEF", numero: 0, clube: "", ano: 1930 },
      { id: "per30-12", sourcePlayerId: "P-71799", nome: "Demetrio Neyra", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "per30-13", sourcePlayerId: "P-19170", nome: "Pablo Pacheco", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "per30-14", sourcePlayerId: "P-06866", nome: "Jorge Pardon", posicao: "GOL", numero: 0, clube: "", ano: 1930 },
      { id: "per30-15", sourcePlayerId: "P-08526", nome: "Julio Quintana", posicao: "MEI", numero: 0, clube: "", ano: 1930 },
      { id: "per30-16", sourcePlayerId: "P-27561", nome: "Lizardo Rodríguez Nue", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "per30-17", sourcePlayerId: "P-36167", nome: "Jorge Sarmiento", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "per30-18", sourcePlayerId: "P-66691", nome: "Alberto Soria", posicao: "DEF", numero: 0, clube: "", ano: 1930 },
      { id: "per30-19", sourcePlayerId: "P-44010", nome: "Luis Souza Ferreira", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "per30-20", sourcePlayerId: "P-89076", nome: "Juan Valdivieso", posicao: "GOL", numero: 0, clube: "", ano: 1930 },
      { id: "per30-21", sourcePlayerId: "P-41536", nome: "Juan Alfonso Valle", posicao: "MEI", numero: 0, clube: "", ano: 1930 },
      { id: "per30-22", sourcePlayerId: "P-36243", nome: "Alejandro Villanueva", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
    ],
  },
  {
    id: "rou-1930", selecao: "Romênia", sigla: "ROU", ano: 1930, competicao: "Copa do Mundo",
    jogadores: [
      { id: "rou30-1", sourcePlayerId: "P-99417", nome: "Ştefan Barbu", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "rou30-2", sourcePlayerId: "P-62376", nome: "Rudolf Bürger", posicao: "DEF", numero: 0, clube: "", ano: 1930 },
      { id: "rou30-3", sourcePlayerId: "P-27752", nome: "Iosif Czako", posicao: "DEF", numero: 0, clube: "", ano: 1930 },
      { id: "rou30-4", sourcePlayerId: "P-91295", nome: "Adalbert Deşu", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "rou30-5", sourcePlayerId: "P-20672", nome: "Alfred Eisenbeisser", posicao: "MEI", numero: 0, clube: "", ano: 1930 },
      { id: "rou30-6", sourcePlayerId: "P-70294", nome: "Miklós Kovács", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "rou30-7", sourcePlayerId: "P-09282", nome: "Ion Lǎpuşneanu", posicao: "GOL", numero: 0, clube: "", ano: 1930 },
      { id: "rou30-8", sourcePlayerId: "P-07972", nome: "László Raffinsky", posicao: "MEI", numero: 0, clube: "", ano: 1930 },
      { id: "rou30-9", sourcePlayerId: "P-02455", nome: "Corneliu Robe", posicao: "MEI", numero: 0, clube: "", ano: 1930 },
      { id: "rou30-10", sourcePlayerId: "P-18615", nome: "Constantin Stanciu", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "rou30-11", sourcePlayerId: "P-51872", nome: "Adalbert Steiner", posicao: "DEF", numero: 0, clube: "", ano: 1930 },
      { id: "rou30-12", sourcePlayerId: "P-81554", nome: "Ilie Subăşeanu", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "rou30-13", sourcePlayerId: "P-22907", nome: "Emerich Vogl", posicao: "DEF", numero: 0, clube: "", ano: 1930 },
      { id: "rou30-14", sourcePlayerId: "P-85622", nome: "Rudolf Wetzer", posicao: "ATA", numero: 0, clube: "", ano: 1930 },
      { id: "rou30-15", sourcePlayerId: "P-22304", nome: "Samuel Zauber", posicao: "GOL", numero: 0, clube: "", ano: 1930 },
    ],
  },
  {
    id: "usa-1930", selecao: "Estados Unidos", sigla: "USA", ano: 1930, competicao: "Copa do Mundo",
    jogadores: [
      { id: "usa30-1", sourcePlayerId: "P-58795", nome: "Andy Auld", posicao: "MEI", numero: 0, clube: "", resultadoEquipe: "terceiro", ano: 1930 },
      { id: "usa30-2", sourcePlayerId: "P-94425", nome: "Mike Bookie", posicao: "ATA", numero: 0, clube: "", resultadoEquipe: "terceiro", ano: 1930 },
      { id: "usa30-3", sourcePlayerId: "P-06424", nome: "Jim Brown", posicao: "ATA", numero: 0, clube: "", resultadoEquipe: "terceiro", ano: 1930 },
      { id: "usa30-4", sourcePlayerId: "P-12437", nome: "Jimmy Douglas", posicao: "GOL", numero: 0, clube: "", resultadoEquipe: "terceiro", ano: 1930 },
      { id: "usa30-5", sourcePlayerId: "P-37361", nome: "Tom Florie", posicao: "ATA", numero: 0, clube: "", resultadoEquipe: "terceiro", ano: 1930 },
      { id: "usa30-6", sourcePlayerId: "P-99522", nome: "Jimmy Gallagher", posicao: "MEI", numero: 0, clube: "", resultadoEquipe: "terceiro", ano: 1930 },
      { id: "usa30-7", sourcePlayerId: "P-00733", nome: "James Gentle", posicao: "ATA", numero: 0, clube: "", resultadoEquipe: "terceiro", ano: 1930 },
      { id: "usa30-8", sourcePlayerId: "P-85569", nome: "Billy Gonsalves", posicao: "ATA", numero: 0, clube: "", resultadoEquipe: "terceiro", ano: 1930 },
      { id: "usa30-9", sourcePlayerId: "P-65185", nome: "Bart McGhee", posicao: "ATA", numero: 0, clube: "", resultadoEquipe: "terceiro", ano: 1930 },
      { id: "usa30-10", sourcePlayerId: "P-25155", nome: "George Moorhouse", posicao: "DEF", numero: 0, clube: "", resultadoEquipe: "terceiro", ano: 1930 },
      { id: "usa30-11", sourcePlayerId: "P-46121", nome: "Arnie Oliver", posicao: "ATA", numero: 0, clube: "", resultadoEquipe: "terceiro", ano: 1930 },
      { id: "usa30-12", sourcePlayerId: "P-71973", nome: "Bert Patenaude", posicao: "ATA", numero: 0, clube: "", resultadoEquipe: "terceiro", ano: 1930 },
      { id: "usa30-13", sourcePlayerId: "P-47437", nome: "Philip Slone", posicao: "MEI", numero: 0, clube: "", resultadoEquipe: "terceiro", ano: 1930 },
      { id: "usa30-14", sourcePlayerId: "P-04110", nome: "Raphael Tracey", posicao: "ATA", numero: 0, clube: "", resultadoEquipe: "terceiro", ano: 1930 },
      { id: "usa30-15", sourcePlayerId: "P-49855", nome: "Frank Vaughn", posicao: "DEF", numero: 0, clube: "", resultadoEquipe: "terceiro", ano: 1930 },
      { id: "usa30-16", sourcePlayerId: "P-56459", nome: "Alexander Wood", posicao: "DEF", numero: 0, clube: "", resultadoEquipe: "terceiro", ano: 1930 },
    ],
  },
  {
    id: "ury-1930", selecao: "Uruguai", sigla: "URY", ano: 1930, competicao: "Copa do Mundo",
    jogadores: [
      { id: "ury30-1", sourcePlayerId: "P-63826", nome: "José Leandro Andrade", posicao: "MEI", numero: 0, clube: "", resultadoEquipe: "campeao", ano: 1930 },
      { id: "ury30-2", sourcePlayerId: "P-57352", nome: "Peregrino Anselmo", posicao: "ATA", numero: 0, clube: "", resultadoEquipe: "campeao", ano: 1930 },
      { id: "ury30-3", sourcePlayerId: "P-63987", nome: "Enrique Ballesteros", posicao: "GOL", numero: 0, clube: "", resultadoEquipe: "campeao", ano: 1930 },
      { id: "ury30-4", sourcePlayerId: "P-47453", nome: "Juan Carlos Calvo", posicao: "ATA", numero: 0, clube: "", resultadoEquipe: "campeao", ano: 1930 },
      { id: "ury30-5", sourcePlayerId: "P-76186", nome: "Miguel Capuccini", posicao: "GOL", numero: 0, clube: "", resultadoEquipe: "campeao", ano: 1930 },
      { id: "ury30-6", sourcePlayerId: "P-54697", nome: "Héctor Castro", posicao: "ATA", numero: 0, clube: "", resultadoEquipe: "campeao", ano: 1930 },
      { id: "ury30-7", sourcePlayerId: "P-18628", nome: "Pedro Cea", posicao: "ATA", numero: 0, clube: "", resultadoEquipe: "campeao", ano: 1930 },
      { id: "ury30-8", sourcePlayerId: "P-38674", nome: "Pablo Dorado", posicao: "ATA", numero: 0, clube: "", resultadoEquipe: "campeao", ano: 1930 },
      { id: "ury30-9", sourcePlayerId: "P-53856", nome: "Lorenzo Fernández", posicao: "MEI", numero: 0, clube: "", resultadoEquipe: "campeao", ano: 1930 },
      { id: "ury30-10", sourcePlayerId: "P-39785", nome: "Álvaro Gestido", posicao: "MEI", numero: 0, clube: "", resultadoEquipe: "campeao", ano: 1930 },
      { id: "ury30-11", sourcePlayerId: "P-31959", nome: "Santos Iriarte", posicao: "ATA", numero: 0, clube: "", resultadoEquipe: "campeao", ano: 1930 },
      { id: "ury30-12", sourcePlayerId: "P-49150", nome: "Ernesto Mascheroni", posicao: "DEF", numero: 0, clube: "", resultadoEquipe: "campeao", ano: 1930 },
      { id: "ury30-13", sourcePlayerId: "P-55304", nome: "Ángel Melogno", posicao: "MEI", numero: 0, clube: "", resultadoEquipe: "campeao", ano: 1930 },
      { id: "ury30-14", sourcePlayerId: "P-76270", nome: "José Nasazzi", posicao: "DEF", numero: 0, clube: "", resultadoEquipe: "campeao", ano: 1930 },
      { id: "ury30-15", sourcePlayerId: "P-93278", nome: "Pedro Petrone", posicao: "ATA", numero: 0, clube: "", resultadoEquipe: "campeao", ano: 1930 },
      { id: "ury30-16", sourcePlayerId: "P-41238", nome: "Conduelo Píriz", posicao: "MEI", numero: 0, clube: "", resultadoEquipe: "campeao", ano: 1930 },
      { id: "ury30-17", sourcePlayerId: "P-63026", nome: "Emilio Recoba", posicao: "DEF", numero: 0, clube: "", resultadoEquipe: "campeao", ano: 1930 },
      { id: "ury30-18", sourcePlayerId: "P-98216", nome: "Carlos Riolfo", posicao: "MEI", numero: 0, clube: "", resultadoEquipe: "campeao", ano: 1930 },
      { id: "ury30-19", sourcePlayerId: "P-93344", nome: "Zoilo Saldombide", posicao: "ATA", numero: 0, clube: "", resultadoEquipe: "campeao", ano: 1930 },
      { id: "ury30-20", sourcePlayerId: "P-44201", nome: "Héctor Scarone", posicao: "ATA", numero: 0, clube: "", resultadoEquipe: "campeao", ano: 1930 },
      { id: "ury30-21", sourcePlayerId: "P-86932", nome: "Domingo Tejera", posicao: "DEF", numero: 0, clube: "", resultadoEquipe: "campeao", ano: 1930 },
      { id: "ury30-22", sourcePlayerId: "P-17569", nome: "Santos Urdinarán", posicao: "ATA", numero: 0, clube: "", resultadoEquipe: "campeao", ano: 1930 },
    ],
  },
  {
    id: "yug-1930", selecao: "Iugoslávia", sigla: "YUG", ano: 1930, competicao: "Copa do Mundo",
    jogadores: [
      { id: "yug30-1", sourcePlayerId: "P-72808", nome: "Milorad Arsenijević", posicao: "MEI", numero: 0, clube: "", resultadoEquipe: "quarto", ano: 1930 },
      { id: "yug30-2", sourcePlayerId: "P-43734", nome: "Ivan Bek", posicao: "ATA", numero: 0, clube: "", resultadoEquipe: "quarto", ano: 1930 },
      { id: "yug30-3", sourcePlayerId: "P-13261", nome: "Momčilo Đokić", posicao: "MEI", numero: 0, clube: "", resultadoEquipe: "quarto", ano: 1930 },
      { id: "yug30-4", sourcePlayerId: "P-15059", nome: "Branislav Hrnjiček", posicao: "MEI", numero: 0, clube: "", resultadoEquipe: "quarto", ano: 1930 },
      { id: "yug30-5", sourcePlayerId: "P-44887", nome: "Milutin Ivković", posicao: "DEF", numero: 0, clube: "", resultadoEquipe: "quarto", ano: 1930 },
      { id: "yug30-6", sourcePlayerId: "P-24808", nome: "Milovan Jakšić", posicao: "GOL", numero: 0, clube: "", resultadoEquipe: "quarto", ano: 1930 },
      { id: "yug30-7", sourcePlayerId: "P-75929", nome: "Blagoje Marjanović", posicao: "ATA", numero: 0, clube: "", resultadoEquipe: "quarto", ano: 1930 },
      { id: "yug30-8", sourcePlayerId: "P-10671", nome: "Bozidar Marković", posicao: "ATA", numero: 0, clube: "", resultadoEquipe: "quarto", ano: 1930 },
      { id: "yug30-9", sourcePlayerId: "P-19712", nome: "Dragoslav Mihajlović", posicao: "DEF", numero: 0, clube: "", resultadoEquipe: "quarto", ano: 1930 },
      { id: "yug30-10", sourcePlayerId: "P-91900", nome: "Dragutin Najdanović", posicao: "ATA", numero: 0, clube: "", resultadoEquipe: "quarto", ano: 1930 },
      { id: "yug30-11", sourcePlayerId: "P-94965", nome: "Branislav Sekulić", posicao: "ATA", numero: 0, clube: "", resultadoEquipe: "quarto", ano: 1930 },
      { id: "yug30-12", sourcePlayerId: "P-74878", nome: "Teofilo Spasojević", posicao: "MEI", numero: 0, clube: "", resultadoEquipe: "quarto", ano: 1930 },
      { id: "yug30-13", sourcePlayerId: "P-62267", nome: "Ljubiša Stefanović", posicao: "DEF", numero: 0, clube: "", resultadoEquipe: "quarto", ano: 1930 },
      { id: "yug30-14", sourcePlayerId: "P-55273", nome: "Milan Stojanović", posicao: "GOL", numero: 0, clube: "", resultadoEquipe: "quarto", ano: 1930 },
      { id: "yug30-15", sourcePlayerId: "P-43349", nome: "Aleksandar Tirnanić", posicao: "ATA", numero: 0, clube: "", resultadoEquipe: "quarto", ano: 1930 },
      { id: "yug30-16", sourcePlayerId: "P-59061", nome: "Dragomir Tošić", posicao: "DEF", numero: 0, clube: "", resultadoEquipe: "quarto", ano: 1930 },
      { id: "yug30-17", sourcePlayerId: "P-33565", nome: "Đorđe Vujadinović", posicao: "ATA", numero: 0, clube: "", resultadoEquipe: "quarto", ano: 1930 },
    ],
  },
];

// Se o script scripts/import-squads.mjs já foi rodado, ele gera
// public/data/squads-full.json com TODAS as 22 Copas (1930–2022) e TODAS as
// seleções que já jogaram um Mundial. O app tenta carregar esse arquivo em
// runtime (ver src/app/solo/page.tsx) e, se existir, usa ele — cobrindo as
// 84 seleções pedidas — caindo de volta pra este arquivo curado (2 Copas)
// caso o script ainda não tenha sido executado.

// Anos que realmente foram Copa do Mundo masculina — trava de segurança
// extra ao carregar o arquivo gerado pelo importador. Mesmo que esse
// arquivo tenha sido gerado antes de alguma correção no script (ou esteja
// desatualizado), o app nunca deixa passar um ano fora dessa lista.
export const ANOS_VALIDOS_COPA = new Set([
  1930, 1934, 1938, 1950, 1954, 1958, 1962, 1966, 1970, 1974, 1978, 1982,
  1986, 1990, 1994, 1998, 2002, 2006, 2010, 2014, 2018, 2022, 2026,
]);
