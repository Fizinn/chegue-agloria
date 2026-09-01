#!/usr/bin/env node
/**
 * Importador DEFINITIVO de Overall Manual.
 *
 * Regras de segurança:
 * - o runtime nunca procura overall por nome;
 * - o registro definitivo usa player_id + year;
 * - a lista antiga (overallManual.ts) é apenas uma fonte de importação;
 * - correspondência automática só acontece quando é inequívoca;
 * - ambíguos e ausentes ficam no relatório e NÃO são importados;
 * - associações duvidosas só entram quando o Admin/arquivo de associações
 *   informar explicitamente o player_id real.
 *
 * Uso:
 *   node scripts/import-overall-manual.mjs
 *   node scripts/import-overall-manual.mjs --apply
 *   node scripts/import-overall-manual.mjs --file data/meus-overalls.csv
 *
 * CSV aceito:
 *   year,player_id,overall
 * ou:
 *   year,player_name,overall
 *
 * JSON aceito:
 *   [{"year":2026,"player_id":"P26-946","overall":99}]
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SQUADS_PATH = path.join(ROOT, "public", "data", "squads-full.json");
const LEGACY_PATH = path.join(ROOT, "src", "lib", "overallManual.ts");
const ASSOCIATIONS_PATH = path.join(ROOT, "data", "overall-manual-associations.json");
const OUTPUT_PATH = path.join(ROOT, "data", "overall-manual-resolved.json");
const REPORT_PATH = path.join(ROOT, "data", "overall-manual-report.json");
const REPORT_MD_PATH = path.join(ROOT, "data", "overall-manual-report.md");
const SQL_PATH = path.join(ROOT, "supabase", "seed-overall-manual.sql");

function normalizar(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseLegacy() {
  const source = readFileSync(LEGACY_PATH, "utf8")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");

  const match = source.match(/OVERALL_MANUAL[^=]*=\s*(\{[\s\S]*\});?\s*$/);
  if (!match) throw new Error("Não consegui ler OVERALL_MANUAL.");

  return eval(`(${match[1]})`);
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((x) => x.trim());
  if (!lines.length) return [];

  function lineToFields(line) {
    const out = [];
    let current = "";
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (quoted && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          quoted = !quoted;
        }
      } else if (c === "," && !quoted) {
        out.push(current.trim());
        current = "";
      } else {
        current += c;
      }
    }
    out.push(current.trim());
    return out;
  }

  const header = lineToFields(lines[0]).map((x) => x.toLowerCase());
  const hasHeader = header.some((x) =>
    ["year", "ano", "player_id", "playerid", "player_name", "name", "overall"].includes(x),
  );
  const start = hasHeader ? 1 : 0;

  const index = (names, fallback) => {
    const i = header.findIndex((x) => names.includes(x));
    return i >= 0 ? i : fallback;
  };

  const iYear = index(["year", "ano", "copa"], 0);
  const iPlayerId = hasHeader ? index(["player_id", "playerid", "id"], -1) : -1;
  const iName = index(["player_name", "playername", "name", "nome"], 1);
  const iOverall = index(["overall", "rating", "nota"], 2);

  return lines.slice(start).map((line) => {
    const fields = lineToFields(line);
    return {
      year: Number(fields[iYear]),
      playerId: iPlayerId >= 0 ? String(fields[iPlayerId] ?? "").trim() : "",
      playerName: String(fields[iName] ?? "").trim(),
      overall: Number(fields[iOverall]),
    };
  });
}

function parseInput(filePath) {
  const raw = readFileSync(filePath, "utf8");
  if (filePath.endsWith(".json")) {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("O JSON precisa ser um array.");
    return parsed.map((row) => ({
      year: Number(row.year ?? row.ano),
      playerId: String(row.player_id ?? row.playerId ?? row.id ?? "").trim(),
      playerName: String(row.player_name ?? row.playerName ?? row.name ?? row.nome ?? "").trim(),
      overall: Number(row.overall ?? row.rating ?? row.nota),
    }));
  }
  return parseCsv(raw);
}

function legadoParaLinhas() {
  const manual = parseLegacy();
  return Object.entries(manual).flatMap(([year, players]) =>
    Object.entries(players).map(([playerName, overall]) => ({
      year: Number(year),
      playerId: "",
      playerName,
      overall: Number(overall),
    })),
  );
}

function carregarAssociacoes() {
  if (!existsSync(ASSOCIATIONS_PATH)) return {};
  const parsed = JSON.parse(readFileSync(ASSOCIATIONS_PATH, "utf8"));
  return parsed && typeof parsed === "object" ? parsed : {};
}

function chaveAssociacao(year, name) {
  return `${year}::${normalizar(name)}`;
}

function carregarJogadores() {
  if (!existsSync(SQUADS_PATH)) {
    throw new Error("Não achei public/data/squads-full.json. Rode npm run import:squads primeiro.");
  }

  const elencos = JSON.parse(readFileSync(SQUADS_PATH, "utf8"));
  return elencos.flatMap((elenco) =>
    (elenco.jogadores ?? []).map((jogador) => ({
      ...jogador,
      year: Number(elenco.ano),
      team: elenco.selecao,
      playerId: String(jogador.sourcePlayerId ?? jogador.id),
    })),
  );
}

function resolver(linhas, jogadores, associations) {
  const byYearName = new Map();

  for (const jogador of jogadores) {
    const key = `${jogador.year}::${normalizar(jogador.nome)}`;
    const list = byYearName.get(key) ?? [];
    list.push(jogador);
    byYearName.set(key, list);
  }

  const linked = [];
  const ambiguous = [];
  const unresolved = [];
  const invalid = [];

  for (let index = 0; index < linhas.length; index++) {
    const linha = linhas[index];
    if (
      !Number.isInteger(linha.year) ||
      !Number.isInteger(linha.overall) ||
      linha.overall < 52 ||
      linha.overall > 99
    ) {
      invalid.push({ index, linha, reason: "ano/overall inválido" });
      continue;
    }

    let jogador = null;

    if (linha.playerId) {
      jogador = jogadores.find(
        (j) => j.year === linha.year && j.playerId === linha.playerId,
      );

      if (!jogador) {
        invalid.push({
          index,
          linha,
          reason: `player_id ${linha.playerId} não pertence à Copa ${linha.year}`,
        });
        continue;
      }
    } else {
      const explicitId = associations[chaveAssociacao(linha.year, linha.playerName)];
      if (explicitId) {
        jogador = jogadores.find(
          (j) => j.year === linha.year && j.playerId === String(explicitId),
        );
        if (!jogador) {
          invalid.push({
            index,
            linha,
            reason: `associação explícita aponta para player_id inexistente na Copa ${linha.year}`,
          });
          continue;
        }
      } else {
        // 2026 usa uma fonte separada e tem divergências de nomes/identidades.
        // Sem player_id explícito, não presumimos o jogador.
        if (linha.year === 2026) {
          unresolved.push({
            year: linha.year,
            name: linha.playerName,
            overall: linha.overall,
            reason: "2026 requer associação explícita por player_id.",
          });
          continue;
        }

        const candidatos = byYearName.get(
          `${linha.year}::${normalizar(linha.playerName)}`,
        ) ?? [];

        if (candidatos.length === 1) {
          jogador = candidatos[0];
        } else if (candidatos.length > 1) {
          ambiguous.push({
            year: linha.year,
            name: linha.playerName,
            overall: linha.overall,
            candidates: candidatos.map((j) => ({
              player_id: j.playerId,
              player_name: j.nome,
              team: j.team,
            })),
          });
          continue;
        } else {
          unresolved.push({
            year: linha.year,
            name: linha.playerName,
            overall: linha.overall,
            reason: "nenhuma correspondência exata e segura na mesma Copa.",
          });
          continue;
        }
      }
    }

    linked.push({
      year: linha.year,
      player_id: jogador.playerId,
      player_name: jogador.nome,
      overall: linha.overall,
    });
  }

  const unique = new Map();
  for (const row of linked) unique.set(`${row.year}:${row.player_id}`, row);

  return {
    linked: [...unique.values()].sort((a, b) =>
      a.year - b.year || a.player_name.localeCompare(b.player_name),
    ),
    ambiguous,
    unresolved,
    invalid,
  };
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function gerarSql(linked) {
  const values = linked.map(
    (row) =>
      `(${row.year}, ${sqlLiteral(row.player_id)}, ${sqlLiteral(row.player_name)}, ${row.overall}, now())`,
  );

  const chunks = [];
  for (let i = 0; i < values.length; i += 250) {
    chunks.push(values.slice(i, i + 250).join(",\n"));
  }

  return `-- Gerado por scripts/import-overall-manual.mjs
-- Somente correspondências seguras/inequívocas entram aqui.
-- O runtime consulta overall_overrides por (year, player_id).
begin;

${chunks
  .map(
    (chunk) =>
      `insert into public.overall_overrides (year, player_id, player_name, overall, updated_at)
values
${chunk}
on conflict (year, player_id) do update
set player_name = excluded.player_name,
    overall = excluded.overall,
    updated_at = now();`,
  )
  .join("\n\n")}

commit;
`;
}

async function aplicarSupabase(linked) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Para --apply, defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let total = 0;
  for (let i = 0; i < linked.length; i += 500) {
    const chunk = linked.slice(i, i + 500).map((row) => ({
      ...row,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("overall_overrides")
      .upsert(chunk, { onConflict: "year,player_id" });

    if (error) throw new Error(`Falha no lote ${i / 500 + 1}: ${error.message}`);
    total += chunk.length;
  }

  return total;
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const fileArgIndex = args.indexOf("--file");
  const inputPath =
    fileArgIndex >= 0
      ? path.resolve(args[fileArgIndex + 1])
      : LEGACY_PATH;

  const linhas =
    inputPath === LEGACY_PATH ? legadoParaLinhas() : parseInput(inputPath);

  const jogadores = carregarJogadores();
  const associations = carregarAssociacoes();
  const resultado = resolver(linhas, jogadores, associations);

  writeFileSync(OUTPUT_PATH, JSON.stringify(resultado.linked, null, 2), "utf8");

  const report = {
    generated_at: new Date().toISOString(),
    source: inputPath === LEGACY_PATH ? "src/lib/overallManual.ts" : inputPath,
    total_entries: linhas.length,
    linked: resultado.linked.length,
    ambiguous: resultado.ambiguous.length,
    unresolved: resultado.unresolved.length,
    invalid: resultado.invalid.length,
    ambiguous_entries: resultado.ambiguous,
    unresolved_entries: resultado.unresolved,
    invalid_entries: resultado.invalid,
  };

  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");
  writeFileSync(
    SQL_PATH,
    gerarSql(resultado.linked),
    "utf8",
  );

  const md = `# Relatório de Overall Manual

Gerado em: ${report.generated_at}

| Status | Quantidade |
|---|---:|
| Entradas recebidas | ${report.total_entries} |
| Vinculadas com segurança | ${report.linked} |
| Ambíguas | ${report.ambiguous} |
| Sem correspondência segura | ${report.unresolved} |
| Inválidas | ${report.invalid} |

## Regra de importação

Nenhuma entrada ambígua ou sem correspondência segura é importada automaticamente.
O registro definitivo usa \`year + player_id\`.

## Ambíguas

${resultado.ambiguous.length ? resultado.ambiguous.map((x) =>
  `- **${x.year} — ${x.name} (${x.overall})**: ${x.candidates.map((c) => `${c.player_id} — ${c.player_name} — ${c.team}`).join(" | ")}`,
).join("\n") : "Nenhuma."}

## Sem correspondência segura

${resultado.unresolved.length ? resultado.unresolved.map((x) =>
  `- **${x.year} — ${x.name} (${x.overall})** — ${x.reason}`,
).join("\n") : "Nenhuma."}

## Inválidas

${resultado.invalid.length ? resultado.invalid.map((x) =>
  `- Linha ${x.index}: ${x.reason}`,
).join("\n") : "Nenhuma."}
`;

  writeFileSync(REPORT_MD_PATH, md, "utf8");

  let applied = 0;
  if (apply) applied = await aplicarSupabase(resultado.linked);

  console.log(`Entradas: ${report.total_entries}`);
  console.log(`Vinculadas com segurança: ${report.linked}`);
  console.log(`Ambíguas: ${report.ambiguous}`);
  console.log(`Sem correspondência segura: ${report.unresolved}`);
  console.log(`Inválidas: ${report.invalid}`);
  if (apply) console.log(`Gravadas no Supabase: ${applied}`);
  console.log(`Relatório: ${REPORT_MD_PATH}`);
  console.log(`Seed SQL: ${SQL_PATH}`);
}

main().catch((error) => {
  console.error(`Erro: ${error.message}`);
  process.exit(1);
});
