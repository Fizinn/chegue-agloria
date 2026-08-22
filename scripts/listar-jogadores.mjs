// Lista todos os jogadores reais de um ano específico da sua base — útil
// pra conferir na mão os nomes que o script de correção automática não
// conseguiu resolver sozinho.
//
// Rode assim (dentro da pasta do projeto):
//   node scripts/listar-jogadores.mjs 1998
//   node scripts/listar-jogadores.mjs 1998 turquia   (filtra por seleção, opcional)

import { readFileSync } from "node:fs";
import path from "node:path";

const ano = Number(process.argv[2]);
const filtroSelecao = (process.argv[3] ?? "").toLowerCase();

if (!ano) {
  console.error("Uso: node scripts/listar-jogadores.mjs <ano> [seleção opcional]");
  process.exit(1);
}

const caminho = path.join(process.cwd(), "public", "data", "squads-full.json");
let squads;
try {
  squads = JSON.parse(readFileSync(caminho, "utf-8"));
} catch {
  console.error("Não achei public/data/squads-full.json — rode `node scripts/import-squads.mjs` primeiro.");
  process.exit(1);
}

const doAno = squads.filter((e) => e.ano === ano);
if (doAno.length === 0) {
  console.log(`Nenhuma seleção encontrada pro ano ${ano}.`);
  process.exit(0);
}

for (const elenco of doAno) {
  if (filtroSelecao && !elenco.selecao.toLowerCase().includes(filtroSelecao)) continue;
  console.log(`\n=== ${elenco.selecao} (${elenco.sigla}) — ${ano} ===`);
  for (const j of elenco.jogadores) {
    console.log(`  ${j.posicao.padEnd(4)} ${j.nome}`);
  }
}
