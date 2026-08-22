import type { JogadorReal } from "@/lib/squads";
import { getOverallOverride } from "@/lib/overallOverrides";

export type EstiloJogo = "ofensivo" | "equilibrado" | "defensivo";

export type VelocidadeJogo = "lento" | "normal" | "rapido" | "ultra";

export const NOMES_VELOCIDADE: Record<VelocidadeJogo, string> = {
  lento: "Lento",
  normal: "Normal",
  rapido: "Rápido",
  ultra: "Ultra",
};

// Milissegundos por minuto de jogo simulado — continua sendo 90 minutos de
// jogo, só muda a velocidade que eles passam na tela.
export const INTERVALO_MS_POR_VELOCIDADE: Record<VelocidadeJogo, number> = {
  lento: 500,
  normal: 220,
  rapido: 110,
  ultra: 45,
};

export const NOMES_ESTILO: Record<EstiloJogo, string> = {
  ofensivo: "Ofensivo (arrisca mais, sofre mais)",
  equilibrado: "Equilibrado",
  defensivo: "Defensivo (mais seguro, cria menos)",
};

// IMPORTANTE: isto é um rating de JOGABILIDADE (tipo "força" num jogo),
// gerado a partir do id do jogador — não é uma estatística real da carreira
// dele. Serve pra dar números pro modo "clássico" e pra calcular resultado
// das partidas do mata-mata; no modo "almanaque" esse número nunca aparece
// na tela, só é usado por baixo dos panos pra simular o placar.
export type ResultadoEquipe = "campeao" | "vice" | "terceiro" | "quarto" | "outro";

// Nomes muito conhecidos ganham um pequeno empurrão — é curadoria manual de
// craques amplamente reconhecidos, não uma lista exaustiva nem uma nota
// técnica real. O grosso do overall vem do hash + do resultado da campanha
// do time na Copa (fato histórico real), não de "quem é famoso".
const LENDAS: { nome: string; bonus: number }[] = [
  { nome: "pelé", bonus: 14 },
  { nome: "maradona", bonus: 14 },
  { nome: "messi", bonus: 13 },
  { nome: "cristiano ronaldo", bonus: 12 },
  { nome: "zidane", bonus: 12 },
  { nome: "cruyff", bonus: 12 },
  { nome: "beckenbauer", bonus: 11 },
  { nome: "di stéfano", bonus: 11 },
  { nome: "eusébio", bonus: 10 },
  { nome: "garrincha", bonus: 11 },
  { nome: "romário", bonus: 9 },
  { nome: "ronaldinho", bonus: 10 },
  { nome: "ronaldo", bonus: 10 },
  { nome: "neymar", bonus: 9 },
  { nome: "mbappé", bonus: 9 },
  { nome: "iniesta", bonus: 8 },
  { nome: "xavi", bonus: 8 },
  { nome: "modrić", bonus: 8 },
  { nome: "baggio", bonus: 8 },
  { nome: "maldini", bonus: 8 },
  { nome: "baresi", bonus: 8 },
  { nome: "puskás", bonus: 10 },
  { nome: "charlton", bonus: 8 },
  { nome: "kaká", bonus: 8 },
  { nome: "zico", bonus: 9 },
];

const BONUS_RESULTADO: Record<ResultadoEquipe, number> = {
  campeao: 9,
  vice: 6,
  terceiro: 4,
  quarto: 2,
  outro: 0,
};

function hash01(texto: string): number {
  let hash = 0;
  for (let i = 0; i < texto.length; i++) {
    hash = (hash << 5) - hash + texto.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 10000) / 10000; // 0..1
}

// IMPORTANTE: isto é um rating de JOGABILIDADE (tipo "força" num jogo),
// não uma estatística real da carreira do jogador. Combina três coisas:
// 1) uma base pseudo-aleatória mas concentrada perto do meio (média de 3
//    hashes, tipo uma curva normal, pra não ter craque com nota baixa e
//    zagueiro reserva com 90 por puro acaso);
// 2) um bônus real: como o time dele foi naquela Copa específica (campeão,
//    vice, 3º, 4º ou "outro") — dado histórico verdadeiro, não inventado;
// 3) um pequeno bônus de curadoria pra um punhado de craques muito
//    conhecidos (lista curta, manual, não é "nota oficial" de ninguém).
export function overallDoJogador(jogador: {
  id: string;
  nome: string;
  sourcePlayerId?: string;
  ano?: number;
  resultadoEquipe?: ResultadoEquipe;
  premio?: number;
  desempenho?: number;
}): number {
  // A fonte prioritária é o override persistido. O nome nunca é usado como
  // chave de runtime: usamos o ID estável da fonte quando disponível e,
  // somente para o fallback legado embutido em squads.ts, o id interno.
  const playerId = jogador.sourcePlayerId ?? jogador.id;
  const override = getOverallOverride(jogador.ano, playerId);
  if (override !== undefined) return override;

  const h1 = hash01(jogador.id + "|a");
  const h2 = hash01(jogador.id + "|b");
  const h3 = hash01(jogador.id + "|c");
  const media = (h1 + h2 + h3) / 3; // tende a ~0.5, extremos são raros

  let overall = 60 + media * 22; // base ~60-82, concentrada perto de 68-74

  overall += BONUS_RESULTADO[jogador.resultadoEquipe ?? "outro"];
  overall += jogador.premio ?? 0; // Bola/Chuteira/Luva de Ouro, Melhor Jovem — real, por ID
  overall += jogador.desempenho ?? 0; // jogos, titularidade e gols reais naquela Copa

  const nomeLower = jogador.nome.toLowerCase();
  const lenda = LENDAS.find((l) => nomeLower.includes(l.nome));
  if (lenda) overall += lenda.bonus;

  return Math.round(Math.min(99, Math.max(52, overall)));
}

export function forcaDoTime(jogadores: (JogadorReal | null)[]): number {
  const validos = jogadores.filter((j): j is JogadorReal => Boolean(j));
  if (validos.length === 0) return 65;
  const soma = validos.reduce((acc, j) => acc + overallDoJogador(j), 0);
  return soma / validos.length;
}

export function forcaElencoAleatorio(jogadores: JogadorReal[]): number {
  if (jogadores.length === 0) return 65;
  const amostra = jogadores.slice(0, 11);
  const soma = amostra.reduce((acc, j) => acc + overallDoJogador(j), 0);
  return soma / amostra.length;
}

export interface ExpectativaGols {
  mediaCasa: number;
  mediaFora: number;
}

export function expectativaGols(
  forcaCasa: number,
  forcaFora: number,
  estilo: EstiloJogo,
  rodada: number,
): ExpectativaGols {
  const bonusEstiloAtaque =
    estilo === "ofensivo" ? 0.35 : estilo === "defensivo" ? -0.2 : 0.05;
  const bonusEstiloDefesa =
    estilo === "defensivo" ? -0.25 : estilo === "ofensivo" ? 0.25 : 0;

  const diff = (forcaCasa - forcaFora) / 12;
  const mediaCasa = Math.max(0.3, 1.35 + diff + bonusEstiloAtaque);
  const mediaFora = Math.max(0.3, 1.1 - diff + bonusEstiloDefesa + rodada * 0.05);
  return { mediaCasa, mediaFora };
}

// Peso de quem leva cartão por categoria — segue a tendência real do
// futebol (zagueiro comete mais falta de "último homem"), não é dado de
// nenhum jogador específico, é só a distribuição do gerador de eventos.
export const PESO_CARTAO_POR_CATEGORIA: Record<string, number> = {
  DEF: 0.45,
  MEI: 0.3,
  ATA: 0.15,
  GOL: 0.1,
};

export function probabilidadeConversaoPenalti(overallOuForca: number): number {
  const base = 0.76 + (overallOuForca - 75) * 0.006;
  return Math.min(0.92, Math.max(0.55, base));
}

export interface CobrancaPenalti {
  lado: "casa" | "fora";
  jogador?: string;
  converteu: boolean;
}

export function simularPenaltis(
  ordemCasa: {
    id: string;
    nome: string;
    resultadoEquipe?: ResultadoEquipe;
    premio?: number;
    desempenho?: number;
  }[],
  forcaFora: number,
  ordemFora?: {
    id: string;
    nome: string;
    resultadoEquipe?: ResultadoEquipe;
    premio?: number;
    desempenho?: number;
  }[],
): { golsCasa: number; golsFora: number; cobrancas: CobrancaPenalti[] } {
  const cobrancas: CobrancaPenalti[] = [];
  let golsCasa = 0;
  let golsFora = 0;
  const minimo = 5;
  let rodada = 0;

  while (true) {
    const kickerCasa = ordemCasa[rodada % ordemCasa.length];
    const probCasa = probabilidadeConversaoPenalti(overallDoJogador(kickerCasa));
    const converteuCasa = Math.random() < probCasa;
    if (converteuCasa) golsCasa++;
    cobrancas.push({ lado: "casa", jogador: kickerCasa.nome, converteu: converteuCasa });

    const kickerFora = ordemFora && ordemFora.length > 0 ? ordemFora[rodada % ordemFora.length] : null;
    const probFora = kickerFora
      ? probabilidadeConversaoPenalti(overallDoJogador(kickerFora))
      : probabilidadeConversaoPenalti(forcaFora);
    const converteuFora = Math.random() < probFora;
    if (converteuFora) golsFora++;
    cobrancas.push({ lado: "fora", jogador: kickerFora?.nome, converteu: converteuFora });

    rodada++;

    const decidido =
      rodada >= minimo
        ? golsCasa !== golsFora
        : Math.abs(golsCasa - golsFora) > (minimo - rodada);

    if (decidido || rodada > 20) break;
  }

  return { golsCasa, golsFora, cobrancas };
}

export interface ResultadoPartida {
  golsCasa: number;
  golsFora: number;
  penaltis?: { casa: number; fora: number };
  venceuCasa: boolean;
}

function poissonAproximado(media: number): number {
  // aproximação simples (não é Poisson exato, mas dá uma distribuição de
  // placar de futebol plausível sem precisar de biblioteca externa)
  const r = Math.random() * Math.random(); // enviesa pra baixo, como gols reais
  return Math.max(0, Math.round(media * (0.4 + r * 1.6) - 0.3));
}

export function simularPartida(
  forcaCasa: number,
  forcaFora: number,
  estilo: EstiloJogo,
  rodada: number, // 1=oitavas .. 4=final, deixa o adversário mais forte
): ResultadoPartida {
  const bonusEstiloAtaque =
    estilo === "ofensivo" ? 0.35 : estilo === "defensivo" ? -0.2 : 0.05;
  const bonusEstiloDefesa =
    estilo === "defensivo" ? -0.25 : estilo === "ofensivo" ? 0.25 : 0;

  const diff = (forcaCasa - forcaFora) / 12; // normaliza a diferença de força
  const mediaCasa = Math.max(0.3, 1.35 + diff + bonusEstiloAtaque);
  const mediaFora = Math.max(
    0.3,
    1.1 - diff + bonusEstiloDefesa + rodada * 0.05,
  );

  let golsCasa = poissonAproximado(mediaCasa);
  let golsFora = poissonAproximado(mediaFora);

  if (golsCasa === golsFora) {
    // disputa de pênaltis
    const penaltisCasa = 3 + Math.floor(Math.random() * 3);
    const penaltisFora = 3 + Math.floor(Math.random() * 3);
    const venceuCasa =
      penaltisCasa !== penaltisFora
        ? penaltisCasa > penaltisFora
        : Math.random() > 0.5;
    return {
      golsCasa,
      golsFora,
      penaltis: {
        casa: venceuCasa ? Math.max(penaltisCasa, penaltisFora + 1) : penaltisCasa,
        fora: !venceuCasa ? Math.max(penaltisFora, penaltisCasa + 1) : penaltisFora,
      },
      venceuCasa,
    };
  }

  return { golsCasa, golsFora, venceuCasa: golsCasa > golsFora };
}
