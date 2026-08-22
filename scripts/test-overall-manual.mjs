#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const squads = JSON.parse(readFileSync(path.join(ROOT, "public/data/squads-full.json"), "utf8"));
const manual = JSON.parse(readFileSync(path.join(ROOT, "data/overall-manual-resolved.json"), "utf8"));
const report = JSON.parse(readFileSync(path.join(ROOT, "data/overall-manual-report.json"), "utf8"));

const players = squads.flatMap((e) =>
  e.jogadores.map((j) => ({
    ...j,
    year: Number(e.ano),
    playerId: String(j.sourcePlayerId ?? j.id),
  })),
);

const manualMap = new Map(
  manual.map((row) => [`${row.year}:${row.player_id}`, Number(row.overall)]),
);

function manualLookup(player) {
  return manualMap.get(`${player.year}:${player.playerId}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`PASS: ${message}`);
}

const duplicateKeys = manual.length - new Set(manual.map((r) => `${r.year}:${r.player_id}`)).size;
assert(duplicateKeys === 0, "não existem registros duplicados em (year, player_id)");
assert(report.linked === manual.length, "relatório bate com o arquivo resolvido");
assert(report.ambiguous === 2, "as 2 associações ambíguas continuam bloqueadas");
assert(report.unresolved === 162, "as associações sem correspondência continuam bloqueadas");

const neymar = players.find((p) => p.year === 2026 && p.playerId === "P26-218");
const messi = players.find((p) => p.year === 2026 && p.playerId === "P26-946");
const vinicius = players.find((p) =>
  p.year === 2026 && /vinicius.*junior/i.test(p.nome.normalize("NFD").replace(/\p{Diacritic}/gu, "")),
);

assert(neymar && manualLookup(neymar) === 95, "Neymar 2026 usa o Overall Manual 95 por player_id");
assert(messi && manualLookup(messi) === 99, "Messi 2026 usa o Overall Manual 99 por player_id");
assert(!vinicius, "Vinícius Jr. não é inventado quando a base 2026 não possui o jogador");

const multiCup = manual.reduce((map, row) => {
  const list = map.get(row.player_id) ?? [];
  list.push(row);
  map.set(row.player_id, list);
  return map;
}, new Map());

const example = [...multiCup.entries()].find(([, rows]) => rows.length >= 2 && new Set(rows.map((r) => r.year)).size >= 2);
assert(example, "existe jogador com registros independentes em Copas diferentes");

const [exampleId, exampleRows] = example;
const byCup = new Map(exampleRows.map((r) => [r.year, r.overall]));
assert(byCup.size >= 2, `o player_id ${exampleId} possui notas separadas por Copa`);

const noManual = players.find((p) => !manualMap.has(`${p.year}:${p.playerId}`));
assert(noManual, "há jogador sem Overall Manual disponível para testar o fallback automático");

console.log("\nResumo:");
console.log(`- Jogadores na base: ${players.length}`);
console.log(`- Overalls manuais persistíveis: ${manual.length}`);
console.log(`- Pendências seguras: ${report.ambiguous + report.unresolved}`);
console.log(`- Exemplo multi-Copa: ${exampleId}`);
console.log(`- Exemplo sem manual: ${noManual.nome} (${noManual.year})`);
