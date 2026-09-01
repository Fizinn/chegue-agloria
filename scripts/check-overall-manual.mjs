// Compatibilidade: o sistema antigo de Overall Manual por nome não é mais usado
// pelo jogo. Para importar a lista existente com segurança, use:
//   npm run import:overalls
// ou:
//   node scripts/import-overall-manual.mjs --apply
//
// Este arquivo é mantido para não quebrar comandos antigos.

import { spawnSync } from "node:child_process";

const resultado = spawnSync(process.execPath, ["scripts/import-overall-manual.mjs", ...process.argv.slice(2)], {
  stdio: "inherit",
});
process.exit(resultado.status ?? 1);
