import { readFile } from "node:fs/promises";
import path from "node:path";

const ANOS_VALIDOS = new Set([1930,1934,1938,1950,1954,1958,1962,1966,1970,1974,1978,1982,1986,1990,1994,1998,2002,2006,2010,2014,2018,2022,2026]);
const caminho = path.join(process.cwd(), "public", "data", "squads-full.json");
const raw = await readFile(caminho, "utf8");
const elencos = JSON.parse(raw);
const invalidos = elencos.filter((e) => !ANOS_VALIDOS.has(Number(e.ano)) || e.competicao !== "Copa do Mundo" || !Array.isArray(e.jogadores) || e.jogadores.length === 0);
const anos = [...new Set(elencos.map((e) => Number(e.ano)))].sort((a,b)=>a-b);
const femininos = elencos.filter((e) => /women|feminino|feminina/i.test(`${e.competicao} ${e.selecao}`));
console.log(`Elencos válidos: ${elencos.length}`);
console.log(`Anos encontrados: ${anos.join(", ")}`);
console.log(`Inválidos: ${invalidos.length}`);
console.log(`Possíveis femininos: ${femininos.length}`);
if (invalidos.length || femininos.length) {
  for (const e of [...invalidos, ...femininos]) console.log(`- ${e.ano} ${e.selecao} (${e.competicao})`);
  process.exit(1);
}
console.log("✅ Base limpa: só Copas masculinas válidas.");
