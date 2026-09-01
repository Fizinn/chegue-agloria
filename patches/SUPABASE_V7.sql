create table if not exists selecoes_copa (
 id uuid primary key default gen_random_uuid(),
 copa_id uuid references copa_sala(id) on delete cascade,
 selecao text not null,
 ano integer not null,
 overall integer,
 viva boolean default true,
 fase integer default 1
);

create table if not exists partidas_copa (
 id uuid primary key default gen_random_uuid(),
 copa_id uuid references copa_sala(id) on delete cascade,
 rodada integer,
 mandante uuid references selecoes_copa(id),
 visitante uuid references selecoes_copa(id),
 vencedor uuid references selecoes_copa(id)
);