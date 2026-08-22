import fs from "node:fs";
import path from "node:path";
import { ELENCOS_REAIS, JogadorReal } from "@/lib/squads";

export type RegistroJogador = JogadorReal & {
  selecao: string;
  sigla: string;
  ano: number;
  playerId: string;
};

type ElencoArquivo = {
  id: string;
  selecao: string;
  sigla: string;
  ano: number;
  jogadores: JogadorReal[];
};

let cache: RegistroJogador[] | null = null;

function carregar() {
  if (cache) return cache;

  const arquivo = path.join(process.cwd(), "public", "data", "squads-full.json");
  let elencos: ElencoArquivo[] = [];

  try {
    if (fs.existsSync(arquivo)) {
      elencos = JSON.parse(fs.readFileSync(arquivo, "utf8"));
    }
  } catch {
    elencos = [];
  }

  if (!elencos.length) elencos = ELENCOS_REAIS as ElencoArquivo[];

  cache = elencos.flatMap((elenco) =>
    (elenco.jogadores ?? []).map((jogador) => ({
      ...jogador,
      selecao: elenco.selecao,
      sigla: elenco.sigla,
      ano: Number(elenco.ano),
      playerId: String(jogador.sourcePlayerId ?? jogador.id),
    })),
  );

  return cache;
}

export function listarJogadoresRegistro() {
  return carregar();
}

export function encontrarJogadorRegistro(ano: number, playerId: string) {
  return carregar().find(
    (jogador) =>
      jogador.ano === ano &&
      (jogador.playerId === playerId || jogador.id === playerId),
  );
}
