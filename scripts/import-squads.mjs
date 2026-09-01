// Baixa o dataset completo de elencos de Copas do Mundo (Fjelstul World Cup
// Database, CC-BY-SA 4.0, via datahub.io) e converte pro formato que o jogo
// usa, gerando public/data/squads-full.json.
//
// Rode UMA VEZ (precisa de internet, então rode fora deste ambiente de chat,
// ex: no seu computador ou no Claude Code):
//
//   node scripts/import-squads.mjs
//
// Depois disso o app carrega esse arquivo automaticamente (ver
// src/app/solo/page.tsx) e o sorteio passa a cobrir as 22 Copas (1930-2022)
// e todas as seleções que já disputaram um Mundial — não só as 2 que vêm
// pré-carregadas em src/lib/squads.ts.

import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const URL_SQUADS = "https://datahub.io/football/worldcup/_r/-/squads.csv";
const URL_TOURNAMENTS = "https://datahub.io/football/worldcup/_r/-/tournaments.csv";
const URL_TEAMS = "https://datahub.io/football/worldcup/_r/-/teams.csv";
const URL_STANDINGS = "https://datahub.io/football/worldcup/_r/-/tournament_standings.csv";
const URL_AWARDS = "https://datahub.io/football/worldcup/_r/-/award_winners.csv";
const URL_APPEARANCES = "https://datahub.io/football/worldcup/_r/-/player_appearances.csv";
const URL_GOALS = "https://datahub.io/football/worldcup/_r/-/goals.csv";

// 2026 não existe no Fjelstul (que cobre 1930–2022). Para não perder a Copa
// atual, usamos uma fonte separada com as 48 seleções e 1.248 jogadores.
const URL_2026_TEAMS = "https://raw.githubusercontent.com/mominullptr/FIFA-World-Cup-2026-Dataset/main/teams.csv";
const URL_2026_SQUADS = "https://raw.githubusercontent.com/mominullptr/FIFA-World-Cup-2026-Dataset/main/squads_and_players.csv";

// Só esses anos foram Copa do Mundo masculina de verdade — usado como
// segunda trava, além da junção por ID abaixo (que é a trava principal).
const ANOS_VALIDOS_COPA = new Set([
  1930, 1934, 1938, 1950, 1954, 1958, 1962, 1966, 1970, 1974, 1978, 1982,
  1986, 1990, 1994, 1998, 2002, 2006, 2010, 2014, 2018, 2022,
]);

// Bônus de overall por prêmio individual real (Bola de Ouro, Chuteira de
// Ouro, Luva de Ouro, Melhor Jovem) — vem de award_winners.csv, casado por
// player_id + tournament_id, então não depende de eu adivinhar nome nenhum.
function bonusPorPremio(awardName) {
  const nome = awardName.toLowerCase();
  if (nome.includes("golden ball")) return 14;
  if (nome.includes("silver ball")) return 9;
  if (nome.includes("bronze ball")) return 6;
  if (nome.includes("golden boot") || nome.includes("golden shoe")) return 10;
  if (nome.includes("silver boot") || nome.includes("silver shoe")) return 6;
  if (nome.includes("bronze boot") || nome.includes("bronze shoe")) return 4;
  if (nome.includes("golden glove")) return 9;
  if (nome.includes("young player")) return 5;
  return 0;
}

// GK/DF/MF/FW (fonte) -> GOL/DEF/MEI/ATA (categoria do jogo)
const MAPA_POSICAO = {
  GK: "GOL",
  DF: "DEF",
  MF: "MEI",
  FW: "ATA",
};

// Nome em português pras seleções mais comuns; as demais ficam com o nome
// em inglês da fonte (ainda assim jogável, só não traduzido).
const NOMES_PT = {
  Argentina: "Argentina",
  Brazil: "Brasil",
  Germany: "Alemanha",
  France: "França",
  Spain: "Espanha",
  Italy: "Itália",
  England: "Inglaterra",
  Netherlands: "Holanda",
  Portugal: "Portugal",
  Belgium: "Bélgica",
  Uruguay: "Uruguai",
  Croatia: "Croácia",
  Mexico: "México",
  "United States": "Estados Unidos",
  Czechia: "Tchéquia",
  "IR Iran": "Irã",
  Türkiye: "Turquia",
  "Côte d'Ivoire": "Costa do Marfim",
  "Congo DR": "RD Congo",
  "Cabo Verde": "Cabo Verde",
  Japan: "Japão",
  "South Korea": "Coreia do Sul",
  Morocco: "Marrocos",
  Switzerland: "Suíça",
  Denmark: "Dinamarca",
  Sweden: "Suécia",
  Poland: "Polônia",
  Senegal: "Senegal",
  Ghana: "Gana",
  Cameroon: "Camarões",
  Nigeria: "Nigéria",
  "Saudi Arabia": "Arábia Saudita",
  Australia: "Austrália",
  Canada: "Canadá",
  Serbia: "Sérvia",
  Poland2: "Polônia",
  "Costa Rica": "Costa Rica",
  Ecuador: "Equador",
  Chile: "Chile",
  Colombia: "Colômbia",
  Peru: "Peru",
  Paraguay: "Paraguai",
  Bolivia: "Bolívia",
  Romania: "Romênia",
  Yugoslavia: "Iugoslávia",
  Czechoslovakia: "Tchecoslováquia",
  "Soviet Union": "União Soviética",
  Russia: "Rússia",
  Hungary: "Hungria",
  Austria: "Áustria",
  Scotland: "Escócia",
  "Northern Ireland": "Irlanda do Norte",
  Wales: "País de Gales",
  Ireland: "Irlanda",
  Tunisia: "Tunísia",
  Algeria: "Argélia",
  Egypt: "Egito",
  "Ivory Coast": "Costa do Marfim",
  Iran: "Irã",
  Iraq: "Iraque",
  China: "China",
  "North Korea": "Coreia do Norte",
  "New Zealand": "Nova Zelândia",
  Honduras: "Honduras",
  Jamaica: "Jamaica",
  Panama: "Panamá",
  Trinidad: "Trindade e Tobago",
  Cuba: "Cuba",
  Norway: "Noruega",
  Finland: "Finlândia",
  Iceland: "Islândia",
  Ukraine: "Ucrânia",
  Slovakia: "Eslováquia",
  Slovenia: "Eslovênia",
  Greece: "Grécia",
  Bulgaria: "Bulgária",
  Turkey: "Turquia",
  Israel: "Israel",
  "Bosnia and Herzegovina": "Bósnia e Herzegovina",
  Angola: "Angola",
  Togo: "Togo",
  "Cape Verde": "Cabo Verde",
  "DR Congo": "RD Congo",
  Zaire: "Zaire",
  "South Africa": "África do Sul",
  Kuwait: "Kuwait",
  "United Arab Emirates": "Emirados Árabes Unidos",
  "Dutch East Indies": "Índias Orientais Holandesas",
  "El Salvador": "El Salvador",
  Haiti: "Haiti",
  "East Germany": "Alemanha Oriental",
  "West Germany": "Alemanha Ocidental",
  Qatar: "Catar",
};

function nomePt(nomeIngles) {
  return NOMES_PT[nomeIngles] ?? nomeIngles;
}

// Parser de CSV simples com suporte a campos entre aspas. Cada campo é
// "trimado" (remove espaço e \r sobrando) — isso é o que evita o bug de
// quebra de linha estilo Windows (\r\n) fazer o código de posição virar
// "GK\r" e nunca bater com o mapa de posições (o que jogava todo mundo pra
// "meio-campo" e dava a impressão de jogador "sumido").
function parseCsvLine(linha) {
  const campos = [];
  let atual = "";
  let dentroDeAspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') {
      dentroDeAspas = !dentroDeAspas;
    } else if (c === "," && !dentroDeAspas) {
      campos.push(atual.trim());
      atual = "";
    } else {
      atual += c;
    }
  }
  campos.push(atual.trim());
  return campos;
}

async function baixarCsv(url, nomeArquivo) {
  console.log(`Baixando ${nomeArquivo}...`);
  const resposta = await fetch(url);
  if (!resposta.ok) {
    throw new Error(`Falha ao baixar ${nomeArquivo}: HTTP ${resposta.status}`);
  }
  const texto = await resposta.text();
  // Split robusto: aceita tanto \n quanto \r\n, e ignora linha vazia final.
  const linhas = texto.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0);
  const cabecalho = parseCsvLine(linhas[0]);
  const idx = Object.fromEntries(cabecalho.map((nome, i) => [nome, i]));
  const linhasDados = linhas.slice(1).map((l) => parseCsvLine(l));
  return { idx, linhasDados };
}

async function main() {
  // 1) tournaments.csv → mapa tournament_id -> ano (fonte de verdade pro
  //    ano, não depende de interpretar o texto do nome do torneio).
  const { idx: idxTorneios, linhasDados: linhasTorneios } = await baixarCsv(
    URL_TOURNAMENTS,
    "tournaments.csv",
  );
  const anoPorTorneio = new Map();
  for (const campos of linhasTorneios) {
    const tournamentId = campos[idxTorneios.tournament_id];
    const ano = Number(campos[idxTorneios.year]);
    anoPorTorneio.set(tournamentId, ano);
  }

  // 2) teams.csv → só aceita team_id marcado como mens_team=1. Essa é a
  //    trava principal contra seleção feminina (mais confiável que ler o
  //    nome do torneio, que pode variar de formatação).
  const { idx: idxTimes, linhasDados: linhasTimes } = await baixarCsv(URL_TEAMS, "teams.csv");
  const timeEhMasculino = new Map();
  for (const campos of linhasTimes) {
    const teamId = campos[idxTimes.team_id];
    const mensTeam = campos[idxTimes.mens_team] === "1";
    timeEhMasculino.set(teamId, mensTeam);
  }

  // 3) tournament_standings.csv → campeão/vice/3º/4º de cada Copa, casado
  //    por tournament_id + team_id (ID real do dataset, não nome em
  //    inglês digitado por mim — isso é o que estava fazendo o bônus de
  //    "time bem colocado" quase nunca bater e o overall parecer solto).
  const { idx: idxStandings, linhasDados: linhasStandings } = await baixarCsv(
    URL_STANDINGS,
    "tournament_standings.csv",
  );
  const resultadoPorTimeNoTorneio = new Map(); // `${tournament_id}__${team_id}` -> "campeao"|"vice"|...
  const ROTULO_POSICAO = { 1: "campeao", 2: "vice", 3: "terceiro", 4: "quarto" };
  for (const campos of linhasStandings) {
    const tournamentId = campos[idxStandings.tournament_id];
    const teamId = campos[idxStandings.team_id];
    const posicao = Number(campos[idxStandings.position]);
    const rotulo = ROTULO_POSICAO[posicao];
    if (rotulo) {
      resultadoPorTimeNoTorneio.set(`${tournamentId}__${teamId}`, rotulo);
    }
  }

  // 4) award_winners.csv → Bola de Ouro/Prata/Bronze, Chuteira de
  //    Ouro/Prata/Bronze, Luva de Ouro, Melhor Jovem — casado por
  //    tournament_id + player_id (também por ID, não por nome).
  const { idx: idxAwards, linhasDados: linhasAwards } = await baixarCsv(URL_AWARDS, "award_winners.csv");
  const premioPorJogadorNoTorneio = new Map(); // `${tournament_id}__${player_id}` -> bonus (number)
  for (const campos of linhasAwards) {
    const tournamentId = campos[idxAwards.tournament_id];
    const playerId = campos[idxAwards.player_id];
    const awardName = campos[idxAwards.award_name] ?? "";
    if (!playerId) continue; // prêmios de time (ex: Fair Play) não têm player_id
    const bonus = bonusPorPremio(awardName);
    if (bonus === 0) continue;
    const chave = `${tournamentId}__${playerId}`;
    const atual = premioPorJogadorNoTorneio.get(chave) ?? 0;
    if (bonus > atual) premioPorJogadorNoTorneio.set(chave, bonus);
  }

  // 5) player_appearances.csv → quantos jogos cada jogador fez naquela
  //    Copa e quantos como titular. Quem nem jogou (só foi convocado)
  //    recebe uma penalidade real; quem foi titular fixo, um bônus real.
  const { idx: idxAparicoes, linhasDados: linhasAparicoes } = await baixarCsv(
    URL_APPEARANCES,
    "player_appearances.csv",
  );
  const aparicoesPorJogadorNoTorneio = new Map(); // `${tournament_id}__${player_id}` -> { jogos, titular }
  for (const campos of linhasAparicoes) {
    const tournamentId = campos[idxAparicoes.tournament_id];
    const playerId = campos[idxAparicoes.player_id];
    const titular = campos[idxAparicoes.starter] === "1";
    const chave = `${tournamentId}__${playerId}`;
    const atual = aparicoesPorJogadorNoTorneio.get(chave) ?? { jogos: 0, titular: 0 };
    atual.jogos += 1;
    if (titular) atual.titular += 1;
    aparicoesPorJogadorNoTorneio.set(chave, atual);
  }

  // 6) goals.csv → quantos gols cada jogador fez naquela Copa (gol contra
  //    não conta a favor de quem marcou).
  const { idx: idxGols, linhasDados: linhasGols } = await baixarCsv(URL_GOALS, "goals.csv");
  const golsPorJogadorNoTorneio = new Map(); // `${tournament_id}__${player_id}` -> gols
  for (const campos of linhasGols) {
    const tournamentId = campos[idxGols.tournament_id];
    const playerId = campos[idxGols.player_id];
    const golContra = campos[idxGols.own_goal] === "1";
    if (golContra || !playerId) continue;
    const chave = `${tournamentId}__${playerId}`;
    golsPorJogadorNoTorneio.set(chave, (golsPorJogadorNoTorneio.get(chave) ?? 0) + 1);
  }

  // Combina jogos+titularidade+gols num único bônus de "desempenho real
  // naquela Copa" — tudo casado por player_id, jogador por jogador.
  function desempenhoReal(tournamentId, playerId) {
    const apar = aparicoesPorJogadorNoTorneio.get(`${tournamentId}__${playerId}`) ?? {
      jogos: 0,
      titular: 0,
    };
    const gols = golsPorJogadorNoTorneio.get(`${tournamentId}__${playerId}`) ?? 0;
    let bonus = 0;
    if (apar.jogos === 0) {
      bonus -= 5; // foi convocado mas não entrou em campo nenhuma vez
    } else {
      bonus += Math.min(apar.titular * 1.5, 6); // titular fixo pesa mais que reserva
    }
    bonus += Math.min(gols * 1.5, 8); // artilheiro daquela Copa pesa ainda mais
    return Math.round(bonus);
  }

  // 7) squads.csv → o elenco propriamente dito, filtrado pelos mapas acima
  //    (ano do torneio + time masculino), com o overall alimentado por
  //    resultado real da campanha + prêmio real + desempenho real em
  //    campo — tudo por ID, jogador por jogador.
  const { idx, linhasDados } = await baixarCsv(URL_SQUADS, "squads.csv");

  const grupos = new Map();

  for (const campos of linhasDados) {
    const tournamentId = campos[idx.tournament_id];
    const teamId = campos[idx.team_id];
    const teamName = campos[idx.team_name];
    const teamCode = campos[idx.team_code];
    const playerId = campos[idx.player_id];
    const familyName = campos[idx.family_name];
    const givenName = campos[idx.given_name];
    const shirtNumber = Number(campos[idx.shirt_number] || 0);
    const positionCode = campos[idx.position_code];

    const ano = anoPorTorneio.get(tournamentId);
    const ehMasculino = timeEhMasculino.get(teamId);

    if (!ANOS_VALIDOS_COPA.has(ano) || ehMasculino !== true) {
      continue;
    }

    const chave = `${tournamentId}__${teamId}`;
    if (!grupos.has(chave)) {
      grupos.set(chave, {
        id: chave.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        selecao: nomePt(teamName),
        sigla: teamCode,
        ano,
        competicao: "Copa do Mundo",
        jogadores: [],
      });
    }

    const nome =
      givenName && givenName !== "not applicable"
        ? `${givenName} ${familyName}`
        : familyName;

    grupos.get(chave).jogadores.push({
      id: `${chave}-${grupos.get(chave).jogadores.length + 1}`,
      // ID estável da fonte histórica. O `id` acima continua existindo para
      // preservar a identidade interna do jogo, mas Overall Manual usa
      // exclusivamente este identificador estável.
      sourcePlayerId: playerId,
      nome,
      posicao: MAPA_POSICAO[positionCode] ?? "MEI",
      numero: shirtNumber,
      clube: "",
      ano,
      resultadoEquipe: resultadoPorTimeNoTorneio.get(chave) ?? "outro",
      premio: premioPorJogadorNoTorneio.get(`${tournamentId}__${playerId}`) ?? 0,
      desempenho: desempenhoReal(tournamentId, playerId),
    });
  }

  // 8) 2026 — fonte separada, porque o banco histórico acima termina em 2022.
  // A fonte tem exatamente as 48 seleções masculinas da Copa de 2026.
  const { idx: idxTimes26, linhasDados: linhasTimes26 } = await baixarCsv(URL_2026_TEAMS, "teams-2026.csv");
  const times26 = new Map();
  for (const campos of linhasTimes26) {
    times26.set(campos[idxTimes26.team_id], {
      nome: nomePt(campos[idxTimes26.team_name]),
      sigla: campos[idxTimes26.fifa_code],
    });
  }
  const { idx: idxSquads26, linhasDados: linhasSquads26 } = await baixarCsv(URL_2026_SQUADS, "squads-2026.csv");
  const grupos26 = new Map();
  for (const campos of linhasSquads26) {
    const teamId = campos[idxSquads26.team_id];
    const time = times26.get(teamId);
    if (!time) continue;
    const chave = `WC-2026__${teamId}`;
    if (!grupos26.has(chave)) {
      grupos26.set(chave, {
        id: chave.toLowerCase(),
        selecao: time.nome,
        sigla: time.sigla,
        ano: 2026,
        competicao: "Copa do Mundo",
        jogadores: [],
      });
    }
    const nome = campos[idxSquads26.player_name];
    const posicao = campos[idxSquads26.position];
    const mapa26 = { GK: "GOL", DEF: "DEF", MID: "MEI", FWD: "ATA" };
    grupos26.get(chave).jogadores.push({
      id: `wc26-${teamId}-${campos[idxSquads26.player_id]}`,
      // A fonte 2026 usa IDs numéricos próprios; prefixamos para manter o
      // namespace separado do histórico.
      sourcePlayerId: `P26-${campos[idxSquads26.player_id]}`,
      nome,
      posicao: mapa26[posicao] ?? "MEI",
      numero: 0,
      clube: campos[idxSquads26.club_team] ?? "",
      ano: 2026,
      resultadoEquipe: "outro",
      premio: 0,
      desempenho: 0,
    });
  }
  for (const elenco of grupos26.values()) grupos.set(elenco.id, elenco);

  const elencos = Array.from(grupos.values())
    .filter((e) => ANOS_VALIDOS_COPA.has(e.ano) && e.competicao === "Copa do Mundo" && e.jogadores.length > 0)
    .sort((a, b) => a.ano === b.ano ? a.selecao.localeCompare(b.selecao) : a.ano - b.ano);

  const outDir = path.join(process.cwd(), "public", "data");
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "squads-full.json");
  await writeFile(outPath, JSON.stringify(elencos), "utf-8");

  console.log(
    `Pronto! ${elencos.length} elencos (seleção x Copa) gravados em ${outPath}`,
  );
}

main().catch((erro) => {
  console.error("Erro ao importar elencos:", erro);
  process.exit(1);
});
