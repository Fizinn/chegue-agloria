create table if not exists public.salas (
  id uuid primary key default gen_random_uuid(),
  codigo text unique not null,
  host_id uuid not null,
  config jsonb not null default '{}'::jsonb,
  status text not null default 'lobby',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.salas enable row level security;
drop policy if exists "qualquer um pode ler salas" on public.salas;
drop policy if exists "qualquer um pode criar sala" on public.salas;
drop policy if exists "qualquer um pode atualizar status da sala" on public.salas;
create policy "qualquer um pode ler salas" on public.salas for select using (true);
create policy "qualquer um pode criar sala" on public.salas for insert with check (true);
create policy "qualquer um pode atualizar status da sala" on public.salas for update using (true) with check (true);

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

alter table public.sala_jogadores enable row level security;
drop policy if exists "qualquer um pode ler jogadores da sala" on public.sala_jogadores;
drop policy if exists "qualquer um pode entrar na sala" on public.sala_jogadores;
drop policy if exists "qualquer um pode atualizar jogador da sala" on public.sala_jogadores;
drop policy if exists "qualquer um pode sair da sala" on public.sala_jogadores;
create policy "qualquer um pode ler jogadores da sala" on public.sala_jogadores for select using (true);
create policy "qualquer um pode entrar na sala" on public.sala_jogadores for insert with check (true);
create policy "qualquer um pode atualizar jogador da sala" on public.sala_jogadores for update using (true) with check (true);
create policy "qualquer um pode sair da sala" on public.sala_jogadores for delete using (true);

create index if not exists sala_jogadores_sala_idx on public.sala_jogadores(sala_id);
create index if not exists sala_jogadores_player_idx on public.sala_jogadores(player_id);

-- Início atômico da partida: somente o host e somente com todos os
-- jogadores persistidos prontos.
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
  select * into sala_atual from public.salas where codigo = p_codigo for update;
  if not found then raise exception 'Sala não encontrada.'; end if;
  if sala_atual.host_id <> p_host_id then raise exception 'Somente o host pode iniciar a partida.'; end if;
  if sala_atual.status <> 'lobby' then
    return jsonb_build_object('ok', true, 'status', sala_atual.status);
  end if;
  select count(*), count(*) filter (where not pronto or nome = '' or formacao = '' or estilo = '')
    into total_jogadores, total_nao_prontos
    from public.sala_jogadores where sala_id = sala_atual.id;
  if total_jogadores = 0 or total_nao_prontos > 0 then
    raise exception 'Todos os jogadores precisam estar prontos.';
  end if;
  -- Reseta "pronto"/"fase" (que mediam prontidão da sala de espera) antes
  -- de entrar no draft, onde os mesmos campos passam a indicar quem já
  -- terminou de montar o time. Sem isso o valor antigo vaza e todo mundo
  -- aparece pronto sem ter escalado ninguém.
  update public.sala_jogadores set pronto = false, fase = 'montando_time' where sala_id = sala_atual.id;
  update public.salas set status = 'draft', updated_at = now() where id = sala_atual.id;
  return jsonb_build_object('ok', true, 'status', 'draft');
end;
$$;

grant execute on function public.iniciar_sala(text, uuid) to anon, authenticated;

create table if not exists public.overall_overrides (
  year integer not null,
  player_id text not null,
  player_name text not null,
  overall integer not null check (overall between 52 and 99),
  updated_at timestamptz not null default now(),
  primary key (year, player_id)
);

alter table public.overall_overrides enable row level security;
create index if not exists overall_overrides_year_idx on public.overall_overrides(year);
create index if not exists overall_overrides_player_idx on public.overall_overrides(player_id);

comment on table public.overall_overrides is
  'Overalls manuais persistentes. A identidade é year + player_id; player_name é apenas rótulo de exibição.';
comment on column public.overall_overrides.player_id is
  'ID estável da fonte do jogador. O nome nunca é usado como chave do override.';

