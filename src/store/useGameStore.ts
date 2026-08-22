import { create } from "zustand";
import { RealtimeChannel } from "@supabase/supabase-js";
import { canalDaSala, supabase, supabaseConfigurado, testarConexaoSupabase } from "@/lib/supabase";
import { ConfiguracaoSala, Sala } from "@/types/game";
import { Formacao } from "@/lib/formacoes";
import { EstiloJogo } from "@/lib/simulacao";
import { JogadorReal, ANOS_VALIDOS_COPA } from "@/lib/squads";

export interface EscalacaoParticipante {
  titulares: Record<string, JogadorReal | null>;
  reservas: Record<string, (JogadorReal | null)[]>;
}

export interface ParticipantePresenca {
  id: string;
  apelido: string;
  formacao: Formacao | null;
  estilo: EstiloJogo | null;
  pronto: boolean;
  escalacao: EscalacaoParticipante;
  fase?:
    | "lobby"
    | "montando_time"
    | "aguardando_copa"
    | "draft"
    | "em_partida"
    | "substituicao"
    | "aguardando_proximo_jogo"
    | "torneio";
  forcaTime?: number;
  rodadaAtual?: number;
  rodadaLiberada?: number;
  eliminado?: boolean;
  vencedorNome?: string;
  vencedorForca?: number;
  vencedorJogadores?: JogadorReal[];
  vencedorSigla?: string;
  vencedorAno?: number;
  escalacaoPronta?: boolean;
}

interface ConfigurarJogadorInput {
  apelido: string;
  formacao: Formacao;
  estilo: EstiloJogo;
}

interface GameState {
  sala: Sala | null;
  meuId: string | null;
  apelido: string | null;
  participantes: ParticipantePresenca[];
  conectando: boolean;
  erro: string | null;

  criarSala: (config: ConfiguracaoSala) => Promise<string | null>;
  carregarSala: (codigo: string) => Promise<boolean>;
  entrarNaSala: (codigo: string, apelido?: string) => Promise<void>;
  configurarJogador: (config: ConfigurarJogadorInput) => Promise<boolean>;
  marcarPronto: (pronto: boolean) => Promise<boolean>;
  iniciarPartida: () => Promise<boolean>;
  concluirDraft: (forcaTime: number) => Promise<boolean>;
  resetarProprioDraft: () => Promise<boolean>;
  revelarCopa: () => Promise<boolean>;
  atualizarStatus: (patch: Partial<ParticipantePresenca>) => void;
  sair: () => Promise<void>;
}

let canal: RealtimeChannel | null = null;
let codigoDoCanal: string | null = null;

function gerarCodigoSala(tamanho = 6): string {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let codigo = "";
  for (let i = 0; i < tamanho; i++) {
    codigo += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  }
  return codigo;
}

function idDaSessao(codigo: string): string {
  if (typeof window === "undefined") return crypto.randomUUID();
  const chave = `sete-a-zero:player:${codigo}`;
  const salvo = window.sessionStorage.getItem(chave);
  if (salvo) return salvo;
  const novo = crypto.randomUUID();
  window.sessionStorage.setItem(chave, novo);
  return novo;
}

function salaParaEstado(data: any): Sala {
  return {
    id: data.id ?? data.codigo,
    codigo: data.codigo,
    hostId: data.host_id,
    config: data.config as ConfiguracaoSala,
    status: data.status,
    jogadores: [],
  };
}

function linhaParaParticipante(row: any): ParticipantePresenca {
  return {
    id: row.player_id,
    apelido: row.nome ?? "Jogador",
    formacao: (row.formacao ?? null) as Formacao | null,
    estilo: (row.estilo ?? null) as EstiloJogo | null,
    pronto: Boolean(row.pronto),
    escalacao: { titulares: {}, reservas: {} },
    fase: (row.fase ?? "montando_time") as ParticipantePresenca["fase"],
    escalacaoPronta: Boolean(row.escalacao_pronta),
  };
}

function mergePresencaComBanco(
  banco: ParticipantePresenca[],
  presenca: ParticipantePresenca[],
): ParticipantePresenca[] {
  const bancoPorId = new Map(banco.map((p) => [p.id, p]));
  const presencaPorId = new Map(presenca.map((p) => [p.id, p]));

  const ids =
    presenca.length > 0
      ? new Set([...bancoPorId.keys(), ...presencaPorId.keys()])
      : new Set(bancoPorId.keys());

  return Array.from(ids).map((id) => {
    const db = bancoPorId.get(id);
    const online = presencaPorId.get(id);

    return {
      // Base é sempre o banco
      ...(db ?? online!),

      // Só pega da Presence os dados temporários
      escalacao: online?.escalacao ?? db?.escalacao ?? { titulares: {}, reservas: {} },
      fase: db?.fase ?? online?.fase ?? "montando_time",
      forcaTime: online?.forcaTime ?? db?.forcaTime,
      rodadaAtual: online?.rodadaAtual ?? db?.rodadaAtual,
      rodadaLiberada: online?.rodadaLiberada,
      eliminado: online?.eliminado ?? db?.eliminado ?? false,
      vencedorNome: online?.vencedorNome ?? db?.vencedorNome,
      vencedorForca: online?.vencedorForca ?? db?.vencedorForca,
      vencedorJogadores: online?.vencedorJogadores ?? db?.vencedorJogadores,
      vencedorSigla: online?.vencedorSigla ?? db?.vencedorSigla,
      vencedorAno: online?.vencedorAno ?? db?.vencedorAno,

      // O banco manda nesses campos
      apelido: db?.apelido ?? online?.apelido ?? "Jogador",
      formacao: db?.formacao ?? online?.formacao ?? null,
      estilo: db?.estilo ?? online?.estilo ?? null,
      pronto: db?.pronto ?? online?.pronto ?? false,
      escalacaoPronta: db?.escalacaoPronta ?? online?.escalacaoPronta ?? false,
    };
  });
}

export const useGameStore = create<GameState>((set, get) => ({
  sala: null,
  meuId: null,
  apelido: null,
  participantes: [],
  conectando: false,
  erro: null,

  criarSala: async (config) => {
    if (!supabaseConfigurado) {
      set({ erro: "Multiplayer ainda não configurado: preencha .env.local com as chaves do seu Supabase." });
      return null;
    }

    set({ conectando: true, erro: null });

    let codigo = gerarCodigoSala();
    let data: any = null;
    let error: any = null;

    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const hostId = crypto.randomUUID();
      const resposta = await supabase
        .from("salas")
        .insert({ codigo, host_id: hostId, config, status: "lobby" })
        .select("*")
        .single();
      data = resposta.data;
      error = resposta.error;
      if (!error) break;
      if (!String(error.message ?? "").toLowerCase().includes("duplicate")) break;
      codigo = gerarCodigoSala();
    }

    if (error || !data) {
      set({ erro: error?.message ?? "Não foi possível criar a sala.", conectando: false });
      return null;
    }

    const sala = salaParaEstado(data);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(`sete-a-zero:host:${sala.codigo}`, sala.hostId);
    }
    set({ sala, conectando: false, erro: null });
    return sala.codigo;
  },

  carregarSala: async (codigoDigitado) => {
    if (!supabaseConfigurado) {
      set({ erro: "Multiplayer ainda não configurado: preencha .env.local com as chaves do seu Supabase." });
      return false;
    }

    set({ conectando: true, erro: null });
    const codigo = codigoDigitado.trim().toUpperCase();
    const { data, error } = await supabase.from("salas").select("*").eq("codigo", codigo).maybeSingle();

    if (error || !data) {
      set({ erro: "Sala não encontrada. Confira o código e tente de novo.", conectando: false });
      return false;
    }

    set({ sala: salaParaEstado(data), conectando: false, erro: null });
    return true;
  },

  entrarNaSala: async (codigoDigitado, apelidoInicial) => {
    const salaAtual = get().sala;
    const codigo = codigoDigitado.trim().toUpperCase();

    if (!supabaseConfigurado) {
      set({ erro: "Multiplayer ainda não configurado: preencha .env.local com as chaves do seu Supabase." });
      return;
    }

    set({ conectando: true, erro: null });

    let sala = salaAtual;
    if (!sala || sala.codigo !== codigo) {
      const { data, error } = await supabase.from("salas").select("*").eq("codigo", codigo).maybeSingle();
      if (error || !data) {
        set({ erro: "Sala não encontrada. Confira o código e tente de novo.", conectando: false });
        return;
      }
      sala = salaParaEstado(data);
      set({ sala });
    }

    const hostSessao = typeof window !== "undefined"
      ? window.sessionStorage.getItem(`sete-a-zero:host:${codigo}`)
      : null;
    const meuId = get().meuId ?? (hostSessao === sala.hostId ? sala.hostId : idDaSessao(codigo));
    const apelidoExistente = get().apelido ?? apelidoInicial?.trim() ?? "";

    if (canal && codigoDoCanal !== codigo) {
      await canal.unsubscribe();
      canal = null;
      codigoDoCanal = null;
    }

    const { data: jogadorExistente, error: erroBusca } = await supabase
      .from("sala_jogadores")
      .select("*")
      .eq("sala_id", sala.id)
      .eq("player_id", meuId)
      .limit(1)
      .maybeSingle();

    if (erroBusca) {
      set({ erro: `Não foi possível carregar seu jogador: ${erroBusca.message}`, conectando: false });
      return;
    }

    if (sala.status !== "lobby" && !jogadorExistente) {
      set({ erro: "A partida já começou. Não é possível entrar nesta sala agora.", conectando: false });
      return;
    }

    if (!jogadorExistente) {
      const { count, error: erroContagem } = await supabase
        .from("sala_jogadores")
        .select("player_id", { count: "exact", head: true })
        .eq("sala_id", sala.id);
      if (!erroContagem && (count ?? 0) >= sala.config.capacidade) {
        set({ erro: "A sala está cheia.", conectando: false });
        return;
      }
    }

   const dadosJogador = {
  sala_id: sala.id,
  player_id: meuId,
  nome: jogadorExistente?.nome ?? (apelidoExistente || "Jogador"),
  formacao: jogadorExistente?.formacao ?? "4-3-3",
  estilo: jogadorExistente?.estilo ?? "equilibrado",
  pronto: false,
  fase: "montando_time",
};

    if (jogadorExistente) {
      const { error } = await supabase.from("sala_jogadores").update(dadosJogador).eq("sala_id", sala.id).eq("player_id", meuId);
      if (error) {
        set({ erro: `Não foi possível entrar na sala: ${error.message}`, conectando: false });
        return;
      }
    } else {
      const { error } = await supabase.from("sala_jogadores").insert(dadosJogador);
      if (error) {
        set({ erro: `Não foi possível entrar na sala: ${error.message}`, conectando: false });
        return;
      }
    }

    set({
      sala,
      meuId,
      apelido: dadosJogador.nome,
      conectando: false,
      erro: null,
    });

    await conectarCanal(codigo, sala.id, meuId, set, get);
    await recarregarJogadores(sala.id, set, get);
  },

  configurarJogador: async ({ apelido, formacao, estilo }) => {
    const { sala, meuId } = get();
    if (!sala || !meuId) return false;

    const nome = apelido.trim();
    if (!nome || !formacao || !estilo) {
      set({ erro: "Preencha nome, formação e estilo antes de continuar." });
      return false;
    }

    const { error } = await supabase
      .from("sala_jogadores")
      .update({ nome, formacao, estilo, pronto: false, fase: "montando_time" })
      .eq("sala_id", sala.id)
      .eq("player_id", meuId);

    if (error) {
      set({ erro: `Não foi possível salvar suas configurações: ${error.message}` });
      return false;
    }

    set({ apelido, erro: null });
    await anunciarAtualizacao(sala.codigo);
    await recarregarJogadores(sala.id, set, get);
    return true;
  },

marcarPronto: async (pronto) => {
  const { sala, meuId, participantes } = get();
  if (!sala || !meuId) return false;

  const { error } = await supabase
  .from("sala_jogadores")
  .update({
    pronto,
    fase: pronto ? "aguardando_copa" : "montando_time",
  })
  .eq("sala_id", sala.id)
  .eq("player_id", meuId);

  if (error) {
    set({ erro: `Não foi possível atualizar seu status: ${error.message}` });
    return false;
  }

  // Atualiza imediatamente a Presence para não voltar para "Não pronto"
get().atualizarStatus({ pronto, fase: pronto ? "aguardando_copa" : "montando_time" });

  // Atualiza imediatamente a tela (sem esperar o Realtime)
  set({
    participantes: participantes.map((p) =>
      p.id === meuId ? { ...p, pronto, fase: pronto ? "aguardando_copa" : "montando_time" } : p
    ),
    erro: null,
  });

  // Sincroniza em segundo plano
  anunciarAtualizacao(sala.codigo).catch(() => {});
  recarregarJogadores(sala.id, set, get).catch(() => {});

  return true;
},
  iniciarPartida: async () => {
    const { sala, meuId, participantes } = get();
    if (!sala || !meuId) return false;
    if (sala.hostId !== meuId) {
      set({ erro: "Somente o host pode começar a partida." });
      return false;
    }

    const onlineIds = participantes.map((p) => p.id);
    const bancoAntesDaLimpeza = await supabase
      .from("sala_jogadores")
      .select("player_id")
      .eq("sala_id", sala.id);

    if (!bancoAntesDaLimpeza.error && onlineIds.length > 0) {
      for (const jogador of bancoAntesDaLimpeza.data ?? []) {
        if (!onlineIds.includes(jogador.player_id)) {
          await supabase
            .from("sala_jogadores")
            .delete()
            .eq("sala_id", sala.id)
            .eq("player_id", jogador.player_id);
        }
      }
    }

    const { data: banco, error: erroJogadores } = await supabase
      .from("sala_jogadores")
      .select("player_id, pronto, fase, nome, formacao, estilo")
      .eq("sala_id", sala.id);

    if (erroJogadores) {
      set({ erro: `Não foi possível verificar os jogadores: ${erroJogadores.message}` });
      return false;
    }

    if (!banco?.length || banco.some((p: any) => p.fase !== "aguardando_copa" || !p.nome || !p.formacao || !p.estilo)) {
      set({ erro: "Ainda existe jogador não pronto. O host não pode começar." });
      await recarregarJogadores(sala.id, set, get);
      return false;
    }

    const { data: resultado, error } = await supabase.rpc("iniciar_sala", {
      p_codigo: sala.codigo,
      p_host_id: sala.hostId,
    });

    if (error) {
      // Compatibilidade com instalações que ainda não aplicaram o SQL da
      // função. A validação acima continua impedindo o início pelo cliente.
      if (error.message.toLowerCase().includes("iniciar_sala") || error.message.toLowerCase().includes("function")) {
        const fallback = await supabase
          .from("salas")
          .update({ status: "draft" })
          .eq("codigo", sala.codigo)
          .eq("host_id", sala.hostId);
        if (fallback.error) {
          set({ erro: `Não foi possível iniciar a partida: ${fallback.error.message}` });
          return false;
        }
      } else {
        set({ erro: error.message });
        return false;
      }
    }

    if (resultado && typeof resultado === "object" && "ok" in resultado && resultado.ok === false) {
      set({ erro: "Não foi possível iniciar a partida." });
      return false;
    }

    // "pronto"/"fase" aqui em cima eram usados só pra prontidão da sala de
    // espera (todo mundo com fase = "aguardando_copa"). Esses mesmos campos
    // são reaproveitados no draft pra indicar quem já terminou de montar o
    // time — sem resetar, o valor antigo "vazava" e todo mundo já entrava
    // no draft marcado como pronto, mesmo sem ter escalado ninguém.
    await supabase
      .from("sala_jogadores")
      .update({ pronto: false, fase: "montando_time" })
      .eq("sala_id", sala.id);

    set({ sala: { ...sala, status: "draft" }, erro: null });
    await anunciarAtualizacao(sala.codigo);
    return true;
  },

  resetarProprioDraft: async () => {
    // Cada jogador zera o PRÓPRIO status (pronto/fase) ao entrar na tela de
    // montar o time. É uma escrita na própria linha (mesmo tipo de escrita
    // que o "ESTOU PRONTO" já faz), então funciona mesmo que o RLS do
    // Supabase não deixe um jogador alterar a linha de outro — diferente do
    // reset em massa que o host tentava fazer antes, que podia falhar
    // silenciosamente pra linha dos outros jogadores.
    const { sala, meuId, participantes } = get();
    if (!sala || !meuId) return false;

    const { error } = await supabase
      .from("sala_jogadores")
      .update({ pronto: false, fase: "montando_time" })
      .eq("sala_id", sala.id)
      .eq("player_id", meuId);

    if (error) return false;

    set({
      participantes: participantes.map((p) =>
        p.id === meuId ? { ...p, pronto: false, fase: "montando_time" } : p,
      ),
    });
    get().atualizarStatus({ pronto: false, fase: "montando_time" });
    anunciarAtualizacao(sala.codigo).catch(() => {});
    return true;
  },

  concluirDraft: async (forcaTime) => {
    const { sala, meuId, participantes } = get();
    if (!sala || !meuId) return false;

    const { error } = await supabase
      .from("sala_jogadores")
      .update({ pronto: true, fase: "aguardando_copa" })
      .eq("sala_id", sala.id)
      .eq("player_id", meuId);

    if (error) {
      set({ erro: `Não foi possível salvar seu time: ${error.message}` });
      return false;
    }

    // Atualiza a Presence e a tela local imediatamente (sem esperar o
    // Realtime), igual ao marcarPronto do lobby.
    get().atualizarStatus({
      pronto: true,
      fase: "aguardando_copa",
      forcaTime,
      rodadaAtual: 0,
      eliminado: false,
      vencedorNome: undefined,
      vencedorForca: undefined,
      vencedorJogadores: undefined,
      vencedorSigla: undefined,
      vencedorAno: undefined,
    });
    set({
      participantes: participantes.map((p) =>
        p.id === meuId
          ? {
              ...p,
              pronto: true,
              fase: "aguardando_copa",
              forcaTime,
              rodadaAtual: 0,
              eliminado: false,
              vencedorNome: undefined,
              vencedorForca: undefined,
              vencedorJogadores: undefined,
              vencedorSigla: undefined,
              vencedorAno: undefined,
            }
          : p,
      ),
      erro: null,
    });

    anunciarAtualizacao(sala.codigo).catch(() => {});
    recarregarJogadores(sala.id, set, get).catch(() => {});

    return true;
  },

  revelarCopa: async () => {
    const { sala, meuId, participantes } = get();
    if (!sala || !meuId) return false;
    if (sala.hostId !== meuId) {
      set({ erro: "Somente o host pode revelar a Copa." });
      return false;
    }

    const todosTerminaram = participantes.length > 0 && participantes.every((p) => p.fase === "aguardando_copa");
    if (!todosTerminaram) {
      set({ erro: "A Copa só pode ser revelada quando todos terminarem seus times." });
      return false;
    }

    // Sorteia UM ano de Copa do Mundo pra sala inteira, pra todo mundo jogar
    // a mesma edição (só os adversários/chaves de cada jogador são diferentes).
    const anos = Array.from(ANOS_VALIDOS_COPA);
    const anoCopa = sala.config.anoCopa ?? anos[Math.floor(Math.random() * anos.length)];
    const novaConfig = { ...sala.config, anoCopa };

    const { error } = await supabase
      .from("salas")
      .update({ status: "em_andamento", config: novaConfig })
      .eq("id", sala.id)
      .eq("host_id", sala.hostId);

    if (error) {
      set({ erro: `Não foi possível revelar a Copa: ${error.message}` });
      return false;
    }

    set({ sala: { ...sala, status: "em_andamento", config: novaConfig }, erro: null });
    if (canal && codigoDoCanal === sala.codigo) {
      await canal.send({ type: "broadcast", event: "copa_revelada", payload: { at: Date.now() } });
    }
    return true;
  },

  atualizarStatus: (patch) => {
    const { meuId, apelido, participantes, sala } = get();
    if (!meuId || !canal || !sala) return;
    const atual = participantes.find((p) => p.id === meuId);
    const novo = {
      id: meuId,
      apelido: apelido ?? atual?.apelido ?? "Jogador",
      formacao: atual?.formacao ?? null,
      estilo: atual?.estilo ?? null,
      pronto: atual?.pronto ?? false,
      escalacao: atual?.escalacao ?? { titulares: {}, reservas: {} },
      fase: atual?.fase,
      forcaTime: atual?.forcaTime,
      rodadaAtual: atual?.rodadaAtual,
      rodadaLiberada: atual?.rodadaLiberada,
      eliminado: atual?.eliminado,
      vencedorNome: atual?.vencedorNome,
      vencedorForca: atual?.vencedorForca,
      vencedorJogadores: atual?.vencedorJogadores,
      vencedorSigla: atual?.vencedorSigla,
      vencedorAno: atual?.vencedorAno,
      escalacaoPronta: atual?.escalacaoPronta ?? false,
      ...patch,
    } satisfies ParticipantePresenca;

    canal.track(novo);
  },

  sair: async () => {
    const { sala, meuId } = get();
    if (sala && meuId) {
      await supabase.from("sala_jogadores").delete().eq("sala_id", sala.id).eq("player_id", meuId);
      await anunciarAtualizacao(sala.codigo);
    }
    if (canal) await canal.unsubscribe();
    canal = null;
    codigoDoCanal = null;
    set({ sala: null, meuId: null, apelido: null, participantes: [], erro: null });
  },
}));

async function conectarCanal(
  codigo: string,
  salaId: string,
  meuId: string,
  set: (partial: Partial<GameState>) => void,
  get: () => GameState,
) {
  if (canal && codigoDoCanal === codigo) {
    await anunciarPresenca(codigo, meuId, get);
    return;
  }

  canal = canalDaSala(codigo, meuId);
  codigoDoCanal = codigo;

  canal.on("presence", { event: "sync" }, async () => {
    const estado = canal?.presenceState<ParticipantePresenca>() ?? {};
    const lista = Object.values(estado).flat();
    const banco = await buscarJogadores(salaId);
    set({ participantes: mergePresencaComBanco(banco, lista) });
  });

  canal.on("broadcast", { event: "sala_atualizada" }, async () => {
    const banco = await buscarJogadores(salaId);
    const estado = canal?.presenceState<ParticipantePresenca>() ?? {};
    const lista = Object.values(estado).flat();
    set({ participantes: mergePresencaComBanco(banco, lista) });
    await atualizarSalaDoBanco(codigo, set, get);
  });

  canal.on("broadcast", { event: "partida_iniciada" }, async () => {
    await atualizarSalaDoBanco(codigo, set, get);
  });

  canal.on("broadcast", { event: "copa_revelada" }, async () => {
    await atualizarSalaDoBanco(codigo, set, get);
  });

  await new Promise<void>((resolve, reject) => {
    canal!.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await anunciarPresenca(codigo, meuId, get);
        resolve();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        reject(new Error("Não foi possível conectar ao Realtime da sala."));
      }
    });
  });
}

async function anunciarPresenca(codigo: string, meuId: string, get: () => GameState) {
  if (!canal) return;
  const atual = get().participantes.find((p) => p.id === meuId);
  await canal.track({
    id: meuId,
    apelido: get().apelido ?? atual?.apelido ?? "Jogador",
    formacao: atual?.formacao ?? null,
    estilo: atual?.estilo ?? null,
    pronto: atual?.pronto ?? false,
    escalacao: atual?.escalacao ?? { titulares: {}, reservas: {} },
    fase: atual?.fase ?? "montando_time",
    forcaTime: atual?.forcaTime,
    rodadaAtual: atual?.rodadaAtual,
    rodadaLiberada: atual?.rodadaLiberada,
    eliminado: atual?.eliminado,
    vencedorNome: atual?.vencedorNome,
    vencedorForca: atual?.vencedorForca,
    vencedorJogadores: atual?.vencedorJogadores,
    vencedorSigla: atual?.vencedorSigla,
    vencedorAno: atual?.vencedorAno,
    escalacaoPronta: atual?.escalacaoPronta ?? false,
  } satisfies ParticipantePresenca);
  await anunciarAtualizacao(codigo);
}

async function anunciarAtualizacao(codigo: string) {
  if (!canal || codigoDoCanal !== codigo) return;
  await canal.send({ type: "broadcast", event: "sala_atualizada", payload: { at: Date.now() } });
}

async function buscarJogadores(salaId: string): Promise<ParticipantePresenca[]> {
  const { data, error } = await supabase
    .from("sala_jogadores")
    .select("*")
    .eq("sala_id", salaId)
    .order("criado_em", { ascending: true });

  if (error || !data) return [];
  return data.map(linhaParaParticipante);
}

async function recarregarJogadores(salaId: string, set: (partial: Partial<GameState>) => void, get: () => GameState) {
  const banco = await buscarJogadores(salaId);
  const estado = canal?.presenceState<ParticipantePresenca>() ?? {};
  const presenca = Object.values(estado).flat();
  set({ participantes: mergePresencaComBanco(banco, presenca) });
  const eu = banco.find((p) => p.id === get().meuId);
  if (eu) set({ apelido: eu.apelido });
}

async function atualizarSalaDoBanco(codigo: string, set: (partial: Partial<GameState>) => void, get: () => GameState) {
  const { data } = await supabase.from("salas").select("*").eq("codigo", codigo).maybeSingle();
  if (!data) return;
  const atual = get().sala;
  set({ sala: salaParaEstado(data) });
  if (atual?.status !== data.status && data.status === "draft") {
    set({ erro: null });
  }
}
