"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BotaoTema } from "@/components/BotaoTema";
import {
  ELENCOS_REAIS,
  ElencoSelecao,
  JogadorReal,
  ANOS_VALIDOS_COPA,
} from "@/lib/squads";
import {
  getAllOverallOverrides,
  getOverallOverride,
  removeOverallOverride,
  saveOverallOverride,
  importOverallOverrides,
  overallBancoConfigurado,
  OverallOverride,
} from "@/lib/overallOverrides";
import { overallDoJogador } from "@/lib/simulacao";

type Pending = {
  year: number;
  name: string;
  overall: number;
  reason: string;
  candidates?: Array<{ player_id: string; player_name: string; team?: string }>;
};

function playerKey(jogador: JogadorReal) {
  return String(jogador.sourcePlayerId ?? jogador.id);
}

function normalizarNome(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCsv(texto: string) {
  const linhas = texto
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter(Boolean);

  if (!linhas.length) return [];

  const parseLinha = (linha: string) => {
    const campos: string[] = [];
    let atual = "";
    let aspas = false;

    for (let i = 0; i < linha.length; i++) {
      const c = linha[i];
      if (c === '"') {
        if (aspas && linha[i + 1] === '"') {
          atual += '"';
          i++;
        } else {
          aspas = !aspas;
        }
      } else if (c === "," && !aspas) {
        campos.push(atual.trim());
        atual = "";
      } else {
        atual += c;
      }
    }

    campos.push(atual.trim());
    return campos;
  };

  const cabecalho = parseLinha(linhas[0]).map((x) => x.toLowerCase());
  const temCabecalho = cabecalho.some((x) =>
    ["ano", "year", "player_id", "playerid", "nome", "name", "overall"].includes(x),
  );

  const inicio = temCabecalho ? 1 : 0;
  const indice = (nomes: string[], fallback: number) => {
    const idx = cabecalho.findIndex((x) => nomes.includes(x));
    return idx >= 0 ? idx : fallback;
  };

  const iAno = indice(["ano", "year", "copa"], 0);
  const iPlayerId = temCabecalho ? indice(["player_id", "playerid", "id"], -1) : -1;
  const iNome = indice(["nome", "name", "player_name", "playername"], 1);
  const iOverall = indice(["overall", "nota", "rating"], 2);

  return linhas.slice(inicio).map((linha) => {
    const c = parseLinha(linha);
    return {
      year: Number(c[iAno]),
      playerId: iPlayerId >= 0 ? String(c[iPlayerId] ?? "").trim() : "",
      playerName: String(c[iNome] ?? "").trim(),
      overall: Number(c[iOverall]),
    };
  });
}

export default function AdminOverallsPage() {
  const [autenticado, setAutenticado] = useState(false);
  const [pin, setPin] = useState("");
  const [erroLogin, setErroLogin] = useState("");
  const [elencos, setElencos] = useState<ElencoSelecao[]>(ELENCOS_REAIS);
  const [ano, setAno] = useState(2022);
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<JogadorReal | null>(null);
  const [valor, setValor] = useState("");
  const [overrides, setOverrides] = useState<OverallOverride[]>(getAllOverallOverrides());
  const [salvando, setSalvando] = useState(false);
  const [statusBanco, setStatusBanco] = useState("carregando banco…");
  const [pendencias, setPendencias] = useState<Pending[]>([]);
  const [mensagemImportacao, setMensagemImportacao] = useState("");
  const [valorPendente, setValorPendente] = useState<number | null>(null);

  const anos = useMemo(() => {
    const encontrados = new Set(elencos.map((e) => e.ano));
    return [...new Set([...ANOS_VALIDOS_COPA, ...encontrados])].sort((a, b) => a - b);
  }, [elencos]);

  useEffect(() => {
    fetch("/data/squads-full.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((dados: ElencoSelecao[] | null) => {
        if (dados?.length) {
          setElencos(
            dados.filter(
              (e) =>
                ANOS_VALIDOS_COPA.has(e.ano) &&
                e.competicao === "Copa do Mundo" &&
                e.jogadores?.length > 0,
            ),
          );
        }
      })
      .catch(() => {});

    fetch("/data/overall-manual-report.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.unresolved) {
          setPendencias([
            ...(d.ambiguous ?? []).map((x: Pending) => ({
              ...x,
              reason: "ambíguo: existem dois ou mais candidatos",
            })),
            ...(d.unresolved ?? []),
          ]);
        }
      })
      .catch(() => {});

    fetch("/api/admin/session")
      .then((r) => r.json())
      .then((d) => setAutenticado(Boolean(d.ok)))
      .catch(() => {});

    const atualizar = () => {
      setOverrides(getAllOverallOverrides());
      setStatusBanco(
        overallBancoConfigurado()
          ? "☁️ Supabase — fonte persistente"
          : "💾 navegador — fallback de desenvolvimento",
      );
    };

    atualizar();
    window.addEventListener("sete-a-zero:overall-overrides", atualizar);
    return () => window.removeEventListener("sete-a-zero:overall-overrides", atualizar);
  }, []);

  const jogadores = useMemo(() => {
    const todos = elencos
      .filter((e) => e.ano === ano)
      .flatMap((e) => e.jogadores);
    const vistos = new Set<string>();
    const termo = normalizarNome(busca);

    return todos.filter((j) => {
      const id = playerKey(j);
      if (vistos.has(id)) return false;
      vistos.add(id);
      return !termo || normalizarNome(j.nome).includes(termo);
    });
  }, [elencos, ano, busca]);

  function escolher(jogador: JogadorReal) {
    setSelecionado(jogador);
    const manual = getOverallOverride(ano, playerKey(jogador));
    setValor(
      manual !== undefined
        ? String(manual)
        : valorPendente !== null
          ? String(valorPendente)
          : "",
    );
    setValorPendente(null);
  }

  async function entrar() {
    setErroLogin("");
    const resposta = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });

    if (!resposta.ok) {
      setErroLogin("PIN incorreto.");
      return;
    }

    setAutenticado(true);
    setPin("");
  }

  async function salvar() {
    if (!selecionado) return;

    const numero = Number(valor);
    if (!Number.isInteger(numero) || numero < 52 || numero > 99) {
      alert("Coloque um overall inteiro entre 52 e 99.");
      return;
    }

    setSalvando(true);
    try {
      await saveOverallOverride({
        year: ano,
        playerId: playerKey(selecionado),
        playerName: selecionado.nome,
        overall: numero,
      });
      setOverrides(getAllOverallOverrides());
      setStatusBanco(
        overallBancoConfigurado()
          ? "☁️ Supabase — fonte persistente"
          : "💾 navegador — fallback de desenvolvimento",
      );
    } catch (e) {
      alert(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function usarAutomatico() {
    if (!selecionado) return;

    setSalvando(true);
    try {
      await removeOverallOverride(ano, playerKey(selecionado));
      setValor("");
      setOverrides(getAllOverallOverrides());
    } catch (e) {
      alert(e instanceof Error ? e.message : "Não foi possível remover.");
    } finally {
      setSalvando(false);
    }
  }

  async function importarArquivo(file: File) {
    setMensagemImportacao("Lendo arquivo…");

    try {
      const rows = parseCsv(await file.text());
      const preparados: OverallOverride[] = [];
      const erros: string[] = [];

      for (const row of rows) {
        if (
          !Number.isInteger(row.year) ||
          !Number.isInteger(row.overall) ||
          row.overall < 52 ||
          row.overall > 99
        ) {
          erros.push(`Linha inválida: ${JSON.stringify(row)}`);
          continue;
        }

        let playerId = row.playerId;
        let playerName = row.playerName;

        if (!playerId) {
          const candidatos = elencos
            .filter((e) => e.ano === row.year)
            .flatMap((e) => e.jogadores)
            .filter((j) => normalizarNome(j.nome) === normalizarNome(row.playerName));

          if (candidatos.length !== 1) {
            erros.push(
              `${row.year},${row.playerName}: ${candidatos.length === 0 ? "sem correspondência" : "ambíguo"}`,
            );
            continue;
          }

          playerId = playerKey(candidatos[0]);
          playerName = candidatos[0].nome;
        }

        preparados.push({
          year: row.year,
          playerId,
          playerName: playerName || playerId,
          overall: row.overall,
        });
      }

      if (!preparados.length) {
        setMensagemImportacao(`Nenhum registro seguro para importar. ${erros.length} pendência(s).`);
        return;
      }

      const resultado = await importOverallOverrides(preparados);
      setOverrides(getAllOverallOverrides());
      setMensagemImportacao(
        `${resultado.imported} importados com segurança.${erros.length ? ` ${erros.length} ficaram de fora por falta de correspondência segura.` : ""}`,
      );
    } catch (e) {
      setMensagemImportacao(e instanceof Error ? e.message : "Falha na importação.");
    }
  }

  function abrirPendencia(p: Pending) {
    setAno(p.year);
    setBusca(p.name);
    setSelecionado(null);
    setValorPendente(p.overall);
    setValor(String(p.overall));
  }

  if (!autenticado) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
        <div className="fixed right-4 top-4">
          <BotaoTema />
        </div>
        <div className="rounded-card border border-ink/10 bg-card p-7 shadow-card">
          <Link href="/" className="text-sm text-ink/50 hover:text-ink">← voltar</Link>
          <div className="mt-7 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand/10 text-2xl">🔐</div>
            <h1 className="mt-4 font-display text-3xl">Área administrativa</h1>
            <p className="mt-2 text-sm text-ink/55">Digite o PIN para editar os overalls.</p>
          </div>
          <input
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") entrar(); }}
            placeholder="PIN"
            className="mt-6 w-full rounded-lg border border-ink/15 bg-paper px-4 py-3 outline-none focus:border-brand"
          />
          {erroLogin && <p className="mt-2 text-xs text-brand">{erroLogin}</p>}
          <button onClick={entrar} className="mt-4 w-full rounded-lg bg-brand px-4 py-3 font-semibold text-white transition hover:opacity-90">Entrar</button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6">
      <div className="fixed right-4 top-4"><BotaoTema /></div>

      <header className="mb-6">
        <Link href="/" className="text-sm text-ink/50 hover:text-ink">← voltar ao jogo</Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand">admin</p>
            <h1 className="font-display text-4xl">Overalls manuais</h1>
            <p className="mt-1 text-sm text-ink/55">
              A nota é ligada ao <strong>player_id + Copa</strong>. O nome é só informação visual.
            </p>
            <p className="mt-1 text-xs text-ink/40">{statusBanco}</p>
          </div>
          <select
            value={ano}
            onChange={(e) => { setAno(Number(e.target.value)); setSelecionado(null); setBusca(""); }}
            className="rounded-lg border border-ink/15 bg-card px-3 py-2"
          >
            {anos.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </header>

      <section className="mb-5 rounded-card border border-ink/10 bg-card p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl">Importação em massa</h2>
            <p className="mt-1 text-sm text-ink/50">
              Prefira CSV com <code>year,player_id,overall</code>. CSV com nome só aceita correspondência única e segura.
            </p>
          </div>
          <label className="cursor-pointer rounded-lg bg-brand px-4 py-2 font-semibold text-white hover:opacity-90">
            Importar CSV
            <input
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importarArquivo(file);
                e.currentTarget.value = "";
              }}
            />
          </label>
        </div>
        {mensagemImportacao && <p className="mt-3 text-sm text-ink/60">{mensagemImportacao}</p>}
        <p className="mt-3 text-xs text-ink/40">
          Exemplo: <code>year,player_id,overall</code> → <code>2026,P26-946,99</code>.
        </p>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <section className="rounded-card border border-ink/10 bg-card p-5 shadow-card">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={`Buscar jogador em ${ano}...`}
            className="w-full rounded-lg border border-ink/15 bg-paper px-4 py-3 outline-none focus:border-brand"
          />

          <div className="mt-4 max-h-[58vh] space-y-1 overflow-auto pr-1">
            {jogadores.slice(0, 300).map((j) => {
              const manual = getOverallOverride(ano, playerKey(j));
              return (
                <button
                  key={playerKey(j)}
                  onClick={() => escolher(j)}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition ${
                    selecionado && playerKey(selecionado) === playerKey(j)
                      ? "border-brand bg-brand/10"
                      : "border-ink/10 hover:border-ink/25"
                  }`}
                >
                  <span>
                    <span className="font-medium">{j.nome}</span>
                    <span className="ml-2 text-xs text-ink/40">{j.posicao}</span>
                  </span>
                  <span className={`text-sm font-semibold ${manual === undefined ? "text-ink/45" : "text-brand"}`}>
                    {manual ?? overallDoJogador(j)}
                  </span>
                </button>
              );
            })}
            {jogadores.length === 0 && <p className="py-10 text-center text-sm text-ink/45">Nenhum jogador encontrado.</p>}
          </div>
        </section>

        <aside className="h-fit rounded-card border border-ink/10 bg-card p-5 shadow-card lg:sticky lg:top-6">
          <h2 className="font-display text-2xl">Editar jogador</h2>
          {!selecionado ? (
            <p className="mt-3 text-sm text-ink/50">Selecione um jogador na lista.</p>
          ) : (
            <>
              <div className="mt-4 rounded-lg bg-paper p-4">
                <p className="font-semibold">{selecionado.nome}</p>
                <p className="mt-1 break-all text-xs text-ink/45">player_id: {playerKey(selecionado)}</p>
                <p className="text-xs text-ink/45">Copa: {ano}</p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-ink/10 p-3">
                  <p className="text-xs text-ink/45">Automático</p>
                  <p className="mt-1 text-2xl font-bold">{overallDoJogador(selecionado)}</p>
                </div>
                <div className="rounded-lg border border-brand/30 bg-brand/5 p-3">
                  <p className="text-xs text-ink/45">Manual</p>
                  <input
                    type="number"
                    min={52}
                    max={99}
                    value={valor}
                    onChange={(e) => setValor(e.target.value)}
                    placeholder="—"
                    className="mt-1 w-full bg-transparent text-2xl font-bold outline-none"
                  />
                </div>
              </div>

              <button onClick={salvar} disabled={salvando} className="mt-4 w-full rounded-lg bg-brand px-4 py-3 font-semibold text-white hover:opacity-90 disabled:opacity-50">
                {salvando ? "Salvando…" : "💾 Salvar overall"}
              </button>
              <button onClick={usarAutomatico} disabled={salvando} className="mt-2 w-full rounded-lg border border-ink/15 px-4 py-2 text-sm text-ink/70 hover:bg-paper disabled:opacity-50">
                ↩ Usar automático
              </button>
            </>
          )}
        </aside>
      </div>

      <section className="mt-5 rounded-card border border-ink/10 bg-card p-5 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl">Pendências da importação antiga</h2>
            <p className="mt-1 text-xs text-ink/45">
              Nenhuma dessas entradas é aplicada automaticamente. Clique em uma para procurar o jogador correto e fazer a associação por ID.
            </p>
          </div>
          <span className="text-xs text-ink/45">{pendencias.length} pendências</span>
        </div>

        <div className="mt-3 max-h-72 space-y-1 overflow-auto">
          {pendencias.map((p, i) => (
            <button
              key={`${p.year}:${p.name}:${i}`}
              onClick={() => abrirPendencia(p)}
              className="flex w-full items-center justify-between rounded-lg border border-ink/10 px-3 py-2 text-left hover:border-brand/40"
            >
              <span>
                <span className="font-medium">{p.name}</span>
                <span className="ml-2 text-xs text-ink/40">{p.year}</span>
              </span>
              <span className="text-sm font-bold text-brand">{p.overall}</span>
            </button>
          ))}
          {!pendencias.length && <p className="py-6 text-sm text-ink/45">Nenhuma pendência registrada.</p>}
        </div>
      </section>

      <section className="mt-5 rounded-card border border-ink/10 bg-card p-5 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl">Overalls salvos</h2>
          <span className="text-xs text-ink/45">{overrides.length} registros</span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {overrides.map((o) => (
            <div key={`${o.year}:${o.playerId}`} className="flex items-center justify-between rounded-lg border border-ink/10 p-3">
              <div>
                <p className="text-sm font-medium">{o.playerName}</p>
                <p className="break-all text-xs text-ink/40">{o.year} · {o.playerId}</p>
              </div>
              <span className="font-bold text-brand">{o.overall}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
