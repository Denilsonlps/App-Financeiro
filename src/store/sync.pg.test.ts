/**
 * Teste de integração da sincronização contra o schema real (supabase/schema.sql)
 * num Postgres, com RLS ativo. Um cliente falso traduz as chamadas do
 * supabase-js para SQL executado como o usuário logado.
 *
 * Roda só quando PG_TEST_URL aponta para um banco descartável, por exemplo:
 *   PG_TEST_URL=postgres://postgres@localhost:5432/teste npm test
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import pg from 'pg';

const URL_PG = process.env.PG_TEST_URL;

// ------------------------------------------------------------ Cliente falso do Supabase

const fake = vi.hoisted(() => ({ pool: null as unknown as import('pg').Pool, uid: '', email: '', falharProxima: false }));

vi.mock('@/lib/supabase', () => {
  async function comoUsuario<T>(fn: (c: import('pg').PoolClient) => Promise<T>): Promise<T> {
    const c = await fake.pool.connect();
    try {
      await c.query('begin');
      await c.query(`select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.email', $2, true)`, [fake.uid, fake.email]);
      await c.query('set local role authenticated');
      const r = await fn(c);
      await c.query('commit');
      return r;
    } catch (e) {
      await c.query('rollback');
      throw e;
    } finally {
      c.release();
    }
  }
  const resultado = async <T,>(fn: () => Promise<T>) => {
    if (fake.falharProxima) {
      fake.falharProxima = false;
      return { data: null, error: { message: 'Failed to fetch' } };
    }
    try {
      return { data: await fn(), error: null };
    } catch (e) {
      return { data: null, error: { message: (e as Error).message } };
    }
  };

  function from(tabela: string) {
    const where: string[] = [];
    const params: unknown[] = [];
    let tipo: 'select' | 'delete' | 'upsert' = 'select';
    let ordem = '';
    let limite = '';
    let linhas: Record<string, unknown>[] = [];
    let conflito = '';
    const p = (v: unknown) => (params.push(v), `$${params.length}`);
    const q = {
      select: () => ((tipo = 'select'), q),
      delete: () => ((tipo = 'delete'), q),
      upsert: (ls: Record<string, unknown>[], o: { onConflict: string }) => ((tipo = 'upsert'), (linhas = ls), (conflito = o.onConflict), q),
      eq: (c: string, v: unknown) => (where.push(`${c} = ${p(v)}`), q),
      in: (c: string, vs: unknown[]) => (where.push(`${c} = any(${p(vs)})`), q),
      match: (o: Record<string, unknown>) => (Object.entries(o).forEach(([c, v]) => where.push(`${c} = ${p(v)}`)), q),
      order: (c: string) => ((ordem = ` order by ${c}`), q),
      range: (a: number, b: number) => ((limite = ` offset ${a} limit ${b - a + 1}`), q),
      then: (ok: (r: unknown) => void, erro: (e: unknown) => void) =>
        resultado(() =>
          comoUsuario(async (c) => {
            const w = where.length ? ' where ' + where.join(' and ') : '';
            if (tipo === 'select') return (await c.query(`select * from ${tabela}${w}${ordem}${limite}`, params)).rows;
            if (tipo === 'delete') return void (await c.query(`delete from ${tabela}${w}`, params));
            for (const l of linhas) {
              const cols = Object.keys(l);
              const sets = cols.map((k) => `${k} = excluded.${k}`).join(', ');
              await c.query(
                `insert into ${tabela} (${cols.join(',')}) values (${cols.map((_, i) => `$${i + 1}`).join(',')}) on conflict (${conflito}) do update set ${sets}`,
                cols.map((k) => l[k]),
              );
            }
          }),
        ).then(ok, erro),
    };
    return q;
  }

  const rpc = (fn: string, args: Record<string, unknown>) =>
    resultado(() => comoUsuario(async (c) => (await c.query(`select (r).* from (select ${fn}(${Object.keys(args).map((_, i) => `$${i + 1}`).join(',')}) r) x`, Object.values(args))).rows[0]));

  const canal = { on: () => canal, subscribe: () => canal };
  return { supabase: { from, rpc, channel: () => canal, removeChannel: async () => {} } };
});

// Ambiente mínimo de navegador
const armazenamento = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: { getItem: (k: string) => armazenamento.get(k) ?? null, setItem: (k: string, v: string) => armazenamento.set(k, v), removeItem: (k: string) => armazenamento.delete(k) },
  document: { addEventListener() {}, removeEventListener() {}, visibilityState: 'visible' },
  window: { addEventListener() {}, removeEventListener() {} },
});

// Importa depois dos mocks
const { getState } = await import('./store');
const sync = await import('./sync');
const acoes = await import('./actions');
const { estadoDemo } = await import('./seed');
const { diferenca, diferencaVazia } = await import('./remote');
const { supabase } = await import('@/lib/supabase');

const A = { uid: '00000000-0000-0000-0000-00000000000a', email: 'den@x.com' };
const B = { uid: '00000000-0000-0000-0000-00000000000b', email: 'hev@x.com' };
const C = { uid: '00000000-0000-0000-0000-00000000000c', email: 'estranho@x.com' };
const como = (u: typeof A) => Object.assign(fake, u);
const espera = (ms = 450) => new Promise((r) => setTimeout(r, ms));

describe.skipIf(!URL_PG)('sincronização com o schema real (Postgres)', () => {
  let lar = '';

  beforeAll(async () => {
    pg.types.setTypeParser(20, Number); // bigint -> number (como o PostgREST)
    pg.types.setTypeParser(1082, (v: string) => v); // date -> 'YYYY-MM-DD'
    const admin = new pg.Client({ connectionString: URL_PG });
    await admin.connect();
    await admin.query('drop schema if exists public cascade; drop schema if exists auth cascade; drop publication if exists supabase_realtime; create schema public; grant all on schema public to public;');
    await admin.query(readFileSync('supabase/test/mock-auth.sql', 'utf8'));
    await admin.query(readFileSync('supabase/schema.sql', 'utf8'));
    await admin.end();
    fake.pool = new pg.Pool({ connectionString: URL_PG });
  });

  afterAll(async () => {
    sync.encerrarNuvem({ limparCache: true });
    await fake.pool?.end();
  });

  const nuvemIgualLocal = async () => diferencaVazia(diferenca(await sync.carregarRemoto(lar), getState()));

  it('cria o lar e sobe todos os dados de exemplo', async () => {
    como(A);
    const { data, error } = await supabase!.rpc('criar_lar', { p_nome: 'Teste' });
    expect(error).toBeNull();
    lar = (data as { id: string }).id;
    await sync.iniciarNuvem(lar, { estadoInicial: estadoDemo() });
    const remoto = await sync.carregarRemoto(lar);
    expect(remoto.lancamentos).toHaveLength(estadoDemo().lancamentos.length);
    expect(await nuvemIgualLocal()).toBe(true);
  });

  it('envia edições, pagamentos e exclusões', async () => {
    const compra = getState().compras.find((c) => c.parcelas === 4)!;
    acoes.salvarCompra({ ...compra, parcelas: 6, valorTotal: 18000 }); // 4 -> 6 parcelas
    acoes.definirStatusFatura('c-nu-den', getState().lancamentos.find((l) => l.cartaoId === 'c-nu-den')!.mesFatura, 'pago');
    acoes.removerGasto(getState().gastos[0].id);
    acoes.salvarRecorrente({ ...getState().recorrentes[0], fim: '2027-03' });
    acoes.definirPagamentoRecorrente('r-luz', '2026-10', 'pago', 23456);
    acoes.salvarPessoa({ ...getState().pessoas.find((p) => p.id === 'p-ramon')!, apelidos: ['ramonzinho'] });
    await espera();
    await sync.enviar();
    expect(sync.temPendencias()).toBe(false);
    expect(await nuvemIgualLocal()).toBe(true);

    acoes.salvarCompra({ ...compra, parcelas: 2, valorTotal: 5000 }); // diminui: parcelas 3..6 somem
    acoes.removerCompra(getState().compras.find((c) => c.parcelas === 10)!.id);
    acoes.removerRecorrente('r-netflix');
    await espera();
    await sync.enviar();
    expect(await nuvemIgualLocal()).toBe(true);
    expect((await sync.carregarRemoto(lar)).lancamentos.filter((l) => l.compraId === compra.id)).toHaveLength(2);
  });

  it('a segunda pessoa entra com o código e vê os mesmos dados; estranhos não', async () => {
    como(A);
    const { data } = await supabase!.from('lares').select('*');
    const codigo = (data as { codigo_convite: string }[])[0].codigo_convite;

    como(C);
    expect((await sync.carregarRemoto(lar)).compras).toHaveLength(0);

    como(B);
    const r = await supabase!.rpc('entrar_no_lar', { p_codigo: codigo.toLowerCase() });
    expect(r.error).toBeNull();
    expect(await nuvemIgualLocal()).toBe(true);
  });

  it('recebe alteração feita no outro aparelho', async () => {
    como(B);
    await supabase!.from('gastos').upsert(
      [{ lar_id: lar, id: 'g-hev', data: '2026-10-20', mes_referencia: '2026-10', descricao: 'Farmácia', categoria: 'Saúde', valor: 5000, forma_pagamento: 'pix', responsavel: 'casal', pago_por: 'hevellyn', cota_denilson: 2500, cota_hevellyn: 2500, status: 'pago' }],
      { onConflict: 'lar_id,id' },
    );
    como(A);
    await sync.recarregar();
    expect(getState().gastos.some((g) => g.id === 'g-hev')).toBe(true);
  });

  it('sem internet guarda a alteração e envia quando volta', async () => {
    fake.falharProxima = true;
    acoes.definirStatusGasto('g-hev', 'aberto');
    await sync.enviar(); // antes do envio automático: a rede "cai"
    expect(sync.temPendencias()).toBe(true);
    expect(JSON.parse(localStorage.getItem(`financeiro:nuvem:${lar}`)!).estado.gastos.find((g: { id: string }) => g.id === 'g-hev').status).toBe('aberto');
    await sync.enviar(); // conexão volta
    expect(sync.temPendencias()).toBe(false);
    expect((await sync.carregarRemoto(lar)).gastos.find((g) => g.id === 'g-hev')?.status).toBe('aberto');
  });
});
