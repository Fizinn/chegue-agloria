export type OverallOverride = {
  year: number;
  playerId: string;
  playerName: string;
  overall: number;
  updatedAt?: string;
};

const STORAGE_KEY = "sete-a-zero-overall-overrides-v3";
const EVENT_NAME = "sete-a-zero:overall-overrides";

let cache: Record<string, OverallOverride> = {};
let bancoConfigurado = false;

function key(year: number, playerId: string) {
  return `${year}:${playerId}`;
}

export function getOverallOverride(year?: number, playerId?: string) {
  if (!Number.isInteger(year) || !playerId) return undefined;
  const y = Number(year);
  return cache[key(y, playerId)]?.overall;
}

export function getAllOverallOverrides() {
  return Object.values(cache).sort(
    (a, b) => a.year - b.year || a.playerName.localeCompare(b.playerName),
  );
}

function salvarLocal() {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
    } catch {}
  }
}

function carregarLocal() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === "object") cache = parsed;
  } catch {
    cache = {};
  }
}

export async function loadOverallOverrides() {
  if (typeof window === "undefined") return;

  carregarLocal();

  try {
    const resposta = await fetch("/api/overalls", { cache: "no-store" });
    const dados = await resposta.json();

    if (!resposta.ok) {
      throw new Error(dados?.error ?? "Falha ao carregar overalls.");
    }

    bancoConfigurado = Boolean(dados?.configured);

    if (bancoConfigurado && Array.isArray(dados?.overrides)) {
      const remoto: Record<string, OverallOverride> = {};

      for (const item of dados.overrides) {
        const o: OverallOverride = {
          year: Number(item.year),
          playerId: String(item.player_id),
          playerName: String(item.player_name),
          overall: Number(item.overall),
          updatedAt: item.updated_at ? String(item.updated_at) : undefined,
        };
        if (
          Number.isInteger(o.year) &&
          o.playerId &&
          Number.isInteger(o.overall) &&
          o.overall >= 52 &&
          o.overall <= 99
        ) {
          remoto[key(o.year, o.playerId)] = o;
        }
      }

      // Quando o Supabase está configurado, ele é a fonte de verdade.
      // O localStorage só serve como fallback quando não há banco.
      cache = remoto;
      salvarLocal();
    }
  } catch {
    bancoConfigurado = false;
  }

  window.dispatchEvent(new Event(EVENT_NAME));
}

export async function saveOverallOverride(override: OverallOverride) {
  if (
    !Number.isInteger(override.year) ||
    !override.playerId ||
    !override.playerName ||
    !Number.isInteger(override.overall) ||
    override.overall < 52 ||
    override.overall > 99
  ) {
    throw new Error("Dados de overall inválidos.");
  }

  if (typeof window === "undefined") {
    throw new Error("Salvar overall só pode ser feito no navegador.");
  }

  if (bancoConfigurado) {
    const resposta = await fetch("/api/admin/overalls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(override),
    });
    const dados = await resposta.json().catch(() => null);
    if (!resposta.ok) {
      throw new Error(dados?.error ?? "Não foi possível salvar no Supabase.");
    }
    const salvo = dados?.override;
    if (salvo) {
      cache[key(override.year, override.playerId)] = {
        year: Number(salvo.year),
        playerId: String(salvo.player_id),
        playerName: String(salvo.player_name),
        overall: Number(salvo.overall),
        updatedAt: salvo.updated_at ? String(salvo.updated_at) : undefined,
      };
    }
  } else {
    // Fallback local deliberado para desenvolvimento sem Supabase.
    cache[key(override.year, override.playerId)] = override;
    salvarLocal();
  }

  window.dispatchEvent(new Event(EVENT_NAME));
}

export async function removeOverallOverride(year: number, playerId: string) {
  if (typeof window === "undefined") return;

  if (bancoConfigurado) {
    const resposta = await fetch("/api/admin/overalls", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, playerId }),
    });
    const dados = await resposta.json().catch(() => null);
    if (!resposta.ok) {
      throw new Error(dados?.error ?? "Não foi possível remover o overall.");
    }
  }

  delete cache[key(year, playerId)];
  salvarLocal();
  window.dispatchEvent(new Event(EVENT_NAME));
}

export async function importOverallOverrides(overrides: OverallOverride[]) {
  if (typeof window === "undefined") {
    throw new Error("Importação só pode ser feita no navegador.");
  }

  if (!bancoConfigurado) {
    for (const override of overrides) {
      cache[key(override.year, override.playerId)] = override;
    }
    salvarLocal();
    window.dispatchEvent(new Event(EVENT_NAME));
    return { imported: overrides.length };
  }

  const resposta = await fetch("/api/admin/overalls/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ overrides }),
  });
  const dados = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    throw new Error(dados?.error ?? "Falha na importação.");
  }

  for (const item of dados?.overrides ?? []) {
    const o: OverallOverride = {
      year: Number(item.year),
      playerId: String(item.player_id),
      playerName: String(item.player_name),
      overall: Number(item.overall),
      updatedAt: item.updated_at ? String(item.updated_at) : undefined,
    };
    cache[key(o.year, o.playerId)] = o;
  }

  salvarLocal();
  window.dispatchEvent(new Event(EVENT_NAME));
  return { imported: Number(dados?.imported ?? 0) };
}

export function overallBancoConfigurado() {
  return bancoConfigurado;
}

export const overallOverridesEvent = EVENT_NAME;
