import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const CAMINHO_SQUADS = path.join(process.cwd(), "public", "data", "squads-full.json");
const CAMINHO_MANUAL = path.join(process.cwd(), "src", "lib", "overallManual.ts");
const CAMINHO_OUT = path.join(process.cwd(), "src", "lib", "overallManualById.ts");

function normalizar(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ALIASES = new Map(Object.entries({
  "edson arantes do nascimento": "pele",
  "manuel francisco dos santos": "garrincha",
  "edvaldo izidio neto": "vava",
  "thomaz soares da silva": "zizinho",
  "arthur antunes coimbra": "zico",
  "kepler laveran de lima ferreira": "pepe",
  "carlos caetano bledorn verri": "dunga",
  "marcos evangelista de morais": "cafu",
  "ricardo izecson dos santos leite": "kaka",
  "robson de souza": "robinho",
  "jose paulo bezerra maciel junior": "paulinho",
  "francisco roman alarcon suarez": "isco",
}));

const STOP = new Set(["de","da","do","dos","das","van","der","von","di","e","y","al","bin","el","la","le","del"]);
function tokens(s) {
  return normalizar(s).split(" ").filter(x => x.length > 1 && !STOP.has(x));
}
function score(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.length || !B.length) return 0;
  if (normalizar(a) === normalizar(b)) return 1;
  let sum = 0;
  for (const x of A) {
    let best = 0;
    for (const y of B) {
      if (x === y) best = 1;
      else if (x.length >= 4 && y.length >= 4 && (x.startsWith(y) || y.startsWith(x))) best = Math.max(best, .72);
    }
    sum += best;
  }
  const coverageA = sum / A.length;
  const coverageB = sum / B.length;
  return (coverageA + coverageB) / 2;
}

function parseManual() {
  const src = readFileSync(CAMINHO_MANUAL, "utf8")
    .split("\n").filter(l => !l.trim().startsWith("//")).join("\n");
  const m = src.match(/OVERALL_MANUAL[^=]*=\s*(\{[\s\S]*\});?\s*$/);
  if (!m) throw new Error("Não achei OVERALL_MANUAL em overallManual.ts");
  return Function(`"use strict"; return (${m[1]});`)();
}

function escolher(nome, candidatos) {
  const n = normalizar(nome);
  const alias = ALIASES.get(n);
  if (alias) {
    const hits = candidatos.filter(x => normalizar(x.nome) === alias);
    if (hits.length === 1) return { jogador: hits[0], score: 1, metodo: "alias" };
  }

  const exatos = candidatos.filter(x => normalizar(x.nome) === n);
  if (exatos.length === 1) return { jogador: exatos[0], score: 1, metodo: "normalizado" };
  if (exatos.length > 1) return { ambiguos: exatos, score: 1 };

  const avaliados = candidatos.map(j => ({ jogador:j, score:score(nome,j.nome) }))
    .sort((a,b)=>b.score-a.score);
  const melhor = avaliados[0];
  const segundo = avaliados[1];

  // Só aceita aproximação quando é claramente melhor que o segundo.
  if (melhor && melhor.score >= .78 && (!segundo || melhor.score - segundo.score >= .10)) {
    return { jogador: melhor.jogador, score: melhor.score, metodo: "tokens" };
  }
  if (melhor && melhor.score >= .62 && (!segundo || melhor.score - segundo.score >= .18)) {
    return { jogador: melhor.jogador, score: melhor.score, metodo: "tokens-provavel" };
  }
  if (melhor && melhor.score >= .62) {
    return { ambiguos: avaliados.slice(0,3).map(x=>x.jogador), score: melhor.score };
  }
  return null;
}

let squads;
try {
  squads = JSON.parse(readFileSync(CAMINHO_SQUADS, "utf8"));
} catch {
  console.error("❌ Não achei public/data/squads-full.json. Rode: npm run import:squads");
  process.exit(1);
}

const manual = parseManual();
const porAno = new Map();
for (const elenco of squads) {
  if (!porAno.has(elenco.ano)) porAno.set(elenco.ano, []);
  porAno.get(elenco.ano).push(...(elenco.jogadores ?? []));
}

const byId = {};
const resolvidos = [];
const naoResolvidos = [];
const ambiguos = [];

for (const [anoTexto, jogadores] of Object.entries(manual)) {
  const ano = Number(anoTexto);
  const candidatos = porAno.get(ano) ?? [];

  for (const [nome, valor] of Object.entries(jogadores)) {
    const r = escolher(nome, candidatos);

    if (!r) {
      naoResolvidos.push({ ano, nome, valor });
      continue;
    }
    if (r.ambiguos) {
      ambiguos.push({ ano, nome, valor, candidatos: r.ambiguos });
      continue;
    }

    byId[ano] ??= {};
    // Se o mesmo ID receber duas notas diferentes, não escolhemos silenciosamente.
    if (byId[ano][r.jogador.id] !== undefined && byId[ano][r.jogador.id] !== valor) {
      ambiguos.push({
        ano, nome, valor,
        candidatos: [r.jogador],
        motivo: `ID já recebeu ${byId[ano][r.jogador.id]}`
      });
      continue;
    }

    byId[ano][r.jogador.id] = valor;
    resolvidos.push({ ano, nome, valor, id:r.jogador.id, nomeReal:r.jogador.nome, metodo:r.metodo, score:r.score });
  }
}

const conteudo = `// GERADO AUTOMATICAMENTE. NÃO EDITE.
// Fonte: src/lib/overallManual.ts + public/data/squads-full.json.
// A chave é ANO + ID do jogador. O jogo usa este arquivo como fonte
// determinística do overall manual.
//
// Para alterar notas: edite overallManual.ts e rode:
//   npm run build:overalls

export const OVERALL_MANUAL_BY_ID: Record<number, Record<string, number>> = ${JSON.stringify(byId, null, 2)};
`;
writeFileSync(CAMINHO_OUT, conteudo, "utf8");

console.log(`\n✅ Mapa por ID gerado: ${resolvidos.length} overrides.`);
console.log(`🟡 Não resolvidos: ${naoResolvidos.length}`);
console.log(`🟠 Ambíguos: ${ambiguos.length}`);

if (naoResolvidos.length) {
  console.log("\n❌ MANUAIS SEM JOGADOR CORRESPONDENTE:");
  for (const x of naoResolvidos) console.log(`${x.ano} — "${x.nome}" = ${x.valor}`);
}
if (ambiguos.length) {
  console.log("\n🟠 MANUAIS AMBÍGUOS — NÃO FORAM APLICADOS:");
  for (const x of ambiguos) {
    console.log(`${x.ano} — "${x.nome}" = ${x.valor}`);
    for (const c of (x.candidatos ?? [])) console.log(`      ${c.nome} [${c.id}] score=${Number(x.score ?? 0).toFixed(2)}`);
  }
}

const totalManuais = Object.values(manual).reduce((s, x) => s + Object.keys(x).length, 0);
console.log(`\n📊 Total na lista manual: ${totalManuais}`);
console.log(`🎯 Resolvidos: ${resolvidos.length}/${totalManuais}`);
if (resolvidos.length === totalManuais) console.log("✅ 100% DOS MANUAIS VINCULADOS POR ID.");
else console.log("⚠️ Ainda existem entradas que precisam de alias/dado de elenco.");

