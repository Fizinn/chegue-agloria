// PRNG determinístico (mulberry32) + geração de seed simétrica pra
// partidas jogador-contra-jogador. Objetivo: dois clientes diferentes,
// cada um simulando a MESMA partida localmente sem se falar em tempo
// real, tem que chegar exatamente no mesmo placar e no mesmo vencedor.
// Isso só é possível se ambos usarem a mesma sequência de números
// "aleatórios" — daqui vem o PRNG com seed compartilhada.

export type RNG = () => number;

export function mulberry32(seed: number): RNG {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStringToSeed(texto: string): number {
  let hash = 0;
  for (let i = 0; i < texto.length; i++) {
    hash = (hash << 5) - hash + texto.charCodeAt(i);
    hash |= 0;
  }
  return hash >>> 0;
}

// Gera a seed de uma partida entre dois jogadores. IMPORTANTE: a ordem dos
// dois IDs é normalizada (sort) antes do hash, então não importa qual dos
// dois computadores está chamando essa função — os dois calculam a MESMA
// seed pra essa partida.
export function seedDaPartida(
  idJogadorA: string,
  idJogadorB: string,
  codigoSala: string,
  rodada: number,
): number {
  const [x, y] = [idJogadorA, idJogadorB].sort();
  return hashStringToSeed(`${codigoSala}|${rodada}|${x}|${y}`);
}
