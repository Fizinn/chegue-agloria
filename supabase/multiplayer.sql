-- Multiplayer / salas
-- Este arquivo NÃO altera nem remove as tabelas já existentes.
-- Ele serve como referência/migração para instalações novas e para habilitar
-- o acesso do cliente às tabelas que o lobby usa.

create table if not exists public.salas (
  id uuid primary key default gen_random_uuid(),
  codigo text unique not null,
  host_id uuid not null,
  status text not null default 'lobby',
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sala_jogadores (
  id uuid primary key default gen_random_uuid(),
  sala_id uuid not null references public.salas(id) on delete cascade,
  player_id uuid not null,
  nome text not null,
  formacao text not null,
  estilo text not null,
  pronto boolean not null default false,
  joined_at timestamptz not null default now(),
  unique (sala_id, player_id)
);

-- "fase" e "escalacao_pronta" são usados pelo app (lobby + draft) mas podem
-- não existir ainda em instalações mais antigas — adiciona sem quebrar nada.
alter table public.sala_jogadores add column if not exists fase text not null default 'montando_time';
alter table public.sala_jogadores add column if not exists escalacao_pronta boolean not null default false;

alter table public.salas enable row level security;
alter table public.sala_jogadores enable row level security;

-- O jogo usa IDs de sessão gerados no navegador, sem Supabase Auth.
-- Estas políticas permitem que o lobby leia e atualize somente os dados
-- necessários ao funcionamento do multiplayer.
drop policy if exists "salas multiplayer leitura" on public.salas;
drop policy if exists "salas multiplayer criação" on public.salas;
drop policy if exists "salas multiplayer atualização" on public.salas;
drop policy if exists "jogadores multiplayer leitura" on public.sala_jogadores;
drop policy if exists "jogadores multiplayer criação" on public.sala_jogadores;
drop policy if exists "jogadores multiplayer atualização" on public.sala_jogadores;
drop policy if exists "jogadores multiplayer saída" on public.sala_jogadores;

create policy "salas multiplayer leitura"
  on public.salas for select using (true);

create policy "salas multiplayer criação"
  on public.salas for insert with check (true);

create policy "salas multiplayer atualização"
  on public.salas for update using (true) with check (true);

create policy "jogadores multiplayer leitura"
  on public.sala_jogadores for select using (true);

create policy "jogadores multiplayer criação"
  on public.sala_jogadores for insert with check (true);

create policy "jogadores multiplayer atualização"
  on public.sala_jogadores for update using (true) with check (true);

create policy "jogadores multiplayer saída"
  on public.sala_jogadores for delete using (true);

create index if not exists sala_jogadores_sala_idx
  on public.sala_jogadores(sala_id);

create index if not exists sala_jogadores_player_idx
  on public.sala_jogadores(player_id);

-- Início atômico da partida: o host só consegue mudar a sala para draft
-- quando todos os jogadores persistidos estão prontos.
create or replace function public.iniciar_sala(p_codigo text, p_host_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sala_atual public.salas%rowtype;
  total_jogadores integer;
  total_nao_prontos integer;
begin
  select * into sala_atual
    from public.salas
   where codigo = p_codigo
   for update;

  if not found then
    raise exception 'Sala não encontrada.';
  end if;

  if sala_atual.host_id <> p_host_id then
    raise exception 'Somente o host pode iniciar a partida.';
  end if;

  if sala_atual.status <> 'lobby' then
    return jsonb_build_object('ok', true, 'status', sala_atual.status);
  end if;

  select count(*), count(*) filter (where not pronto or nome = '' or formacao = '' or estilo = '')
    into total_jogadores, total_nao_prontos
    from public.sala_jogadores
   where sala_id = sala_atual.id;

  if total_jogadores = 0 or total_nao_prontos > 0 then
    raise exception 'Todos os jogadores precisam estar prontos.';
  end if;

  -- "pronto"/"fase" acima medem a prontidão da SALA DE ESPERA. Esses mesmos
  -- campos são reaproveitados dentro do draft pra indicar quem já terminou
  -- de montar o time. Sem resetar aqui, o valor antigo (fase =
  -- 'aguardando_copa', pronto = true) vaza pro draft e todo mundo aparece
  -- como pronto antes mesmo de escalar alguém.
  update public.sala_jogadores
     set pronto = false,
         fase = 'montando_time'
   where sala_id = sala_atual.id;

  update public.salas
     set status = 'draft', updated_at = now()
   where id = sala_atual.id;

  return jsonb_build_object('ok', true, 'status', 'draft');
end;
$$;

grant execute on function public.iniciar_sala(text, uuid) to anon, authenticated;
