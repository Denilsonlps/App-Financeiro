-- =====================================================================
-- Painel do Casal — schema do Supabase (PostgreSQL)
--
-- Como usar: no painel do Supabase, abra "SQL Editor", cole este arquivo
-- inteiro e clique em "Run". Rode uma única vez num projeto novo.
--
-- Modelo de acesso: cada casal tem um "lar". Quem cria o lar recebe um
-- código de convite; a outra pessoa entra com esse código. As políticas de
-- RLS garantem que cada usuário só lê e grava dados do próprio lar.
--
-- Espelha src/types/index.ts: valores em centavos (bigint), meses em texto
-- 'YYYY-MM', datas em date. Os ids são texto gerados no app (uuid), o que
-- permite subir para a nuvem os dados que já estavam no navegador.
-- =====================================================================

-- Tipos ------------------------------------------------------------------
create type responsavel as enum ('denilson', 'hevellyn', 'casal');
create type integrante as enum ('denilson', 'hevellyn');
create type status_pagamento as enum ('aberto', 'pago');
create type forma_pagamento as enum ('pix', 'boleto', 'debito', 'dinheiro', 'transferencia', 'cartao');
create domain mes as text check (value ~ '^\d{4}-(0[1-9]|1[0-2])$');

-- Lar e membros ----------------------------------------------------------
create table lares (
  id              uuid primary key default gen_random_uuid(),
  nome            text not null default 'Nosso lar',
  codigo_convite  text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  criado_em       timestamptz not null default now()
);

create table membros (
  lar_id     uuid not null references lares(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  email      text,
  criado_em  timestamptz not null default now(),
  primary key (lar_id, user_id),
  unique (user_id) -- cada conta participa de um lar
);

-- security definer: consulta "membros" sem cair na própria política (evita recursão)
create function eh_membro(p_lar uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from membros where lar_id = p_lar and user_id = auth.uid());
$$;

create function criar_lar(p_nome text default 'Nosso lar') returns lares
language plpgsql security definer set search_path = public as $$
declare
  novo lares;
begin
  if auth.uid() is null then raise exception 'É preciso estar logado.'; end if;
  if exists (select 1 from membros where user_id = auth.uid()) then
    raise exception 'Esta conta já participa de um lar.';
  end if;
  insert into lares (nome) values (coalesce(nullif(trim(p_nome), ''), 'Nosso lar')) returning * into novo;
  insert into membros (lar_id, user_id, email) values (novo.id, auth.uid(), auth.jwt() ->> 'email');
  return novo;
end $$;

create function entrar_no_lar(p_codigo text) returns lares
language plpgsql security definer set search_path = public as $$
declare
  alvo lares;
begin
  if auth.uid() is null then raise exception 'É preciso estar logado.'; end if;
  select * into alvo from lares where codigo_convite = upper(trim(p_codigo));
  if alvo.id is null then raise exception 'Código de convite inválido.'; end if;
  if exists (select 1 from membros where user_id = auth.uid() and lar_id <> alvo.id) then
    raise exception 'Esta conta já participa de outro lar.';
  end if;
  insert into membros (lar_id, user_id, email) values (alvo.id, auth.uid(), auth.jwt() ->> 'email')
    on conflict do nothing;
  return alvo;
end $$;

-- Gera um novo código (invalida o anterior), útil depois que o casal entrou
create function novo_codigo_convite(p_lar uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  codigo text := upper(substr(md5(gen_random_uuid()::text), 1, 8));
begin
  if not eh_membro(p_lar) then raise exception 'Acesso negado.'; end if;
  update lares set codigo_convite = codigo where id = p_lar;
  return codigo;
end $$;

-- 1. Usuarios_e_Terceiros ----------------------------------------------
create table pessoas (
  lar_id      uuid not null references lares(id) on delete cascade,
  id          text not null,
  nome        text not null,
  tipo        text not null check (tipo in ('casal', 'terceiro')),
  integrante  integrante,
  apelidos    text[] not null default '{}',
  primary key (lar_id, id),
  check ((tipo = 'casal') = (integrante is not null))
);

-- 2. Cartoes ------------------------------------------------------------
create table cartoes (
  lar_id              uuid not null references lares(id) on delete cascade,
  id                  text not null,
  nome                text not null,
  dono_id             text not null,
  dia_fechamento      smallint not null check (dia_fechamento between 1 and 31),
  dia_vencimento      smallint not null check (dia_vencimento between 1 and 31),
  responsavel_padrao  responsavel not null default 'casal',
  cor                 text not null default '#8a05be',
  apelidos            text[] not null default '{}',
  ativo               boolean not null default true,
  primary key (lar_id, id),
  foreign key (lar_id, dono_id) references pessoas(lar_id, id)
);

-- Cabeçalho da compra (parcelada ou à vista)
create table compras (
  lar_id               uuid not null references lares(id) on delete cascade,
  id                   text not null,
  data                 date not null,
  descricao            text not null,
  categoria            text not null default 'Outros',
  cartao_id            text not null,
  valor_total          bigint not null check (valor_total > 0),
  parcelas             smallint not null default 1 check (parcelas between 1 and 72),
  responsavel          responsavel not null,
  mes_primeira_fatura  mes not null,
  criado_em            text not null default now()::text,
  primary key (lar_id, id),
  foreign key (lar_id, cartao_id) references cartoes(lar_id, id)
);

-- 3. Lancamentos (uma linha por parcela) --------------------------------
create table lancamentos (
  lar_id          uuid not null references lares(id) on delete cascade,
  id              text not null,
  compra_id       text not null,
  data            date not null,
  descricao       text not null,
  categoria       text not null default 'Outros',
  cartao_id       text not null,
  parcela_atual   smallint not null,
  parcelas_total  smallint not null,
  valor_parcela   bigint not null,
  mes_fatura      mes not null,
  responsavel     responsavel not null,
  cota_denilson   bigint not null,
  cota_hevellyn   bigint not null,
  status          status_pagamento not null default 'aberto',
  primary key (lar_id, id),
  foreign key (lar_id, compra_id) references compras(lar_id, id) on delete cascade,
  foreign key (lar_id, cartao_id) references cartoes(lar_id, id),
  check (cota_denilson + cota_hevellyn = valor_parcela)
);
create index lancamentos_mes_idx on lancamentos (lar_id, mes_fatura);

-- 4. Gastos_Fixos_e_Variaveis ------------------------------------------
create table gastos (
  lar_id           uuid not null references lares(id) on delete cascade,
  id               text not null,
  data             date not null,
  mes_referencia   mes not null,
  descricao        text not null,
  categoria        text not null default 'Outros',
  valor            bigint not null check (valor > 0),
  forma_pagamento  forma_pagamento not null default 'pix',
  responsavel      responsavel not null,
  pago_por         integrante not null,
  cota_denilson    bigint not null,
  cota_hevellyn    bigint not null,
  status           status_pagamento not null default 'pago',
  primary key (lar_id, id),
  check (cota_denilson + cota_hevellyn = valor)
);

-- 5. Contas_Recorrentes -------------------------------------------------
create table recorrentes (
  lar_id           uuid not null references lares(id) on delete cascade,
  id               text not null,
  descricao        text not null,
  categoria        text not null default 'Outros',
  valor            bigint not null check (valor > 0),
  forma_pagamento  forma_pagamento not null default 'boleto',
  cartao_id        text,
  dia_vencimento   smallint not null default 10 check (dia_vencimento between 1 and 31),
  responsavel      responsavel not null default 'casal',
  pago_por         integrante not null default 'denilson',
  inicio           mes not null,
  fim              mes,
  ativo            boolean not null default true,
  primary key (lar_id, id),
  foreign key (lar_id, cartao_id) references cartoes(lar_id, id),
  check (fim is null or fim >= inicio)
);

create table pagamentos_recorrentes (
  lar_id      uuid not null references lares(id) on delete cascade,
  conta_id    text not null,
  mes         mes not null,
  status      status_pagamento not null default 'pago',
  valor_real  bigint,
  primary key (lar_id, conta_id, mes),
  foreign key (lar_id, conta_id) references recorrentes(lar_id, id) on delete cascade
);

create table categorias (
  lar_id  uuid not null references lares(id) on delete cascade,
  nome    text not null,
  ordem   int not null default 0,
  primary key (lar_id, nome)
);

-- Segurança (RLS) ---------------------------------------------------------
alter table lares enable row level security;
alter table membros enable row level security;
create policy "membro vê o lar" on lares for select to authenticated using (eh_membro(id));
create policy "membro atualiza o lar" on lares for update to authenticated using (eh_membro(id)) with check (eh_membro(id));
create policy "membro vê os membros" on membros for select to authenticated using (eh_membro(lar_id));

do $$
declare t text;
begin
  foreach t in array array['pessoas', 'cartoes', 'compras', 'lancamentos', 'gastos', 'recorrentes', 'pagamentos_recorrentes', 'categorias']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "dados do próprio lar" on %I for all to authenticated using (eh_membro(lar_id)) with check (eh_membro(lar_id))', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
  end loop;
end $$;

grant select, update on lares to authenticated;
grant select on membros to authenticated;
revoke execute on function eh_membro(uuid), criar_lar(text), entrar_no_lar(text), novo_codigo_convite(uuid) from public, anon;
grant execute on function eh_membro(uuid), criar_lar(text), entrar_no_lar(text), novo_codigo_convite(uuid) to authenticated;

-- Tempo real: avisa os outros aparelhos quando algo muda ------------------
alter publication supabase_realtime add table
  pessoas, cartoes, compras, lancamentos, gastos, recorrentes, pagamentos_recorrentes, categorias;
