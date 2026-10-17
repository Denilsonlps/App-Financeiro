-- =====================================================================
-- App Financeiro (Painel do Casal) — schema relacional para Supabase
-- Espelha src/types/index.ts. Valores em centavos (bigint), meses em
-- 'YYYY-MM' armazenados como date no dia 1 para permitir range/índices.
-- Rode no SQL Editor do Supabase (ou `supabase db push`).
-- =====================================================================

create extension if not exists "pgcrypto";

-- Tipos -----------------------------------------------------------------
create type responsavel as enum ('denilson', 'hevellyn', 'casal');
create type integrante as enum ('denilson', 'hevellyn');
create type status_pagamento as enum ('aberto', 'pago');
create type forma_pagamento as enum ('pix', 'boleto', 'debito', 'dinheiro', 'transferencia', 'cartao');

-- Função de rateio: devolve (cota_denilson, cota_hevellyn) em centavos.
-- No "casal" o centavo ímpar fica com o Denilson (mesma regra do front).
create or replace function ratear(valor bigint, resp responsavel)
returns table (cota_denilson bigint, cota_hevellyn bigint)
language sql immutable as $$
  select
    case resp when 'denilson' then valor when 'hevellyn' then 0 else valor - (valor / 2) end,
    case resp when 'denilson' then 0 when 'hevellyn' then valor else valor / 2 end;
$$;

-- 1. Usuarios_e_Terceiros ----------------------------------------------
create table pessoas (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null unique,
  tipo        text not null check (tipo in ('casal', 'terceiro')),
  integrante  integrante unique,               -- só Denilson/Hevellyn
  apelidos    text[] not null default '{}',
  criado_em   timestamptz not null default now(),
  check ((tipo = 'casal') = (integrante is not null))
);

-- 2. Cartoes ------------------------------------------------------------
create table cartoes (
  id                  uuid primary key default gen_random_uuid(),
  nome                text not null,
  dono_id             uuid not null references pessoas(id) on delete restrict,
  dia_fechamento      smallint not null check (dia_fechamento between 1 and 31),
  dia_vencimento      smallint not null check (dia_vencimento between 1 and 31),
  responsavel_padrao  responsavel not null default 'casal',
  cor                 text not null default '#6366f1',
  apelidos            text[] not null default '{}',
  ativo               boolean not null default true,
  unique (nome, dono_id)
);

-- Cabeçalho da compra parcelada
create table compras (
  id                    uuid primary key default gen_random_uuid(),
  data                  date not null,
  descricao             text not null,
  categoria             text not null default 'Outros',
  cartao_id             uuid not null references cartoes(id) on delete restrict,
  valor_total           bigint not null check (valor_total > 0),
  parcelas              smallint not null default 1 check (parcelas between 1 and 72),
  responsavel           responsavel not null,
  mes_primeira_fatura   date not null,
  criado_em             timestamptz not null default now()
);

-- 3. Lancamentos (uma linha por parcela) --------------------------------
create table lancamentos (
  id              uuid primary key default gen_random_uuid(),
  compra_id       uuid not null references compras(id) on delete cascade,
  data            date not null,
  descricao       text not null,
  categoria       text not null default 'Outros',
  cartao_id       uuid not null references cartoes(id) on delete restrict,
  parcela_atual   smallint not null,
  parcelas_total  smallint not null,
  valor_parcela   bigint not null,
  mes_fatura      date not null,
  responsavel     responsavel not null,
  cota_denilson   bigint not null,
  cota_hevellyn   bigint not null,
  status          status_pagamento not null default 'aberto',
  unique (compra_id, parcela_atual),
  check (cota_denilson + cota_hevellyn = valor_parcela)
);
create index lancamentos_mes_idx on lancamentos (mes_fatura, cartao_id);

-- 4. Gastos_Fixos_e_Variaveis ------------------------------------------
create table gastos (
  id               uuid primary key default gen_random_uuid(),
  data             date not null,
  mes_referencia   date not null,
  descricao        text not null,
  categoria        text not null default 'Outros',
  valor            bigint not null check (valor > 0),
  forma_pagamento  forma_pagamento not null default 'pix',
  responsavel      responsavel not null,
  pago_por         integrante not null,
  cota_denilson    bigint not null,
  cota_hevellyn    bigint not null,
  status           status_pagamento not null default 'pago',
  check (cota_denilson + cota_hevellyn = valor)
);
create index gastos_mes_idx on gastos (mes_referencia);

-- 5. Contas_Recorrentes -------------------------------------------------
create table contas_recorrentes (
  id               uuid primary key default gen_random_uuid(),
  descricao        text not null,
  categoria        text not null default 'Moradia',
  valor            bigint not null check (valor > 0),
  forma_pagamento  forma_pagamento not null default 'boleto',
  cartao_id        uuid references cartoes(id) on delete set null,
  dia_vencimento   smallint not null default 10 check (dia_vencimento between 1 and 31),
  responsavel      responsavel not null default 'casal',
  pago_por         integrante not null default 'denilson',
  inicio           date not null,
  fim              date,
  ativo            boolean not null default true,
  check (fim is null or fim >= inicio),
  check ((forma_pagamento = 'cartao') = (cartao_id is not null))
);

create table pagamentos_recorrentes (
  conta_id    uuid not null references contas_recorrentes(id) on delete cascade,
  mes         date not null,
  status      status_pagamento not null default 'pago',
  valor_real  bigint,
  primary key (conta_id, mes)
);

-- Views de apoio ao Dashboard -------------------------------------------

-- Fatura por cartão/mês com as cotas de cada um
create view v_faturas as
select
  l.mes_fatura,
  c.id   as cartao_id,
  c.nome as cartao,
  p.id   as dono_id,
  p.nome as dono,
  sum(l.valor_parcela)  as total,
  sum(l.cota_denilson)  as cota_denilson,
  sum(l.cota_hevellyn)  as cota_hevellyn,
  sum(l.valor_parcela) filter (where l.status = 'pago') as total_pago
from lancamentos l
join cartoes c on c.id = l.cartao_id
join pessoas p on p.id = c.dono_id
group by l.mes_fatura, c.id, c.nome, p.id, p.nome;

-- Parcelas a vencer: saldo devedor por compra
create view v_parcelas_a_vencer as
select
  co.id as compra_id,
  co.descricao,
  ca.nome as cartao,
  co.parcelas,
  count(*) filter (where l.status = 'aberto')               as parcelas_restantes,
  sum(l.valor_parcela) filter (where l.status = 'aberto')   as saldo_devedor,
  min(l.mes_fatura) filter (where l.status = 'aberto')      as proxima_fatura,
  max(l.mes_fatura)                                         as ultima_fatura
from compras co
join lancamentos l on l.compra_id = co.id
join cartoes ca on ca.id = co.cartao_id
group by co.id, co.descricao, ca.nome, co.parcelas
having count(*) filter (where l.status = 'aberto') > 0;

-- Row Level Security: o app é de um único casal. Libere para usuários
-- autenticados (ajuste para uma tabela de "household" se for multi-tenant).
do $$
declare t text;
begin
  foreach t in array array['pessoas','cartoes','compras','lancamentos','gastos','contas_recorrentes','pagamentos_recorrentes']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "casal_autenticado" on %I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
