import { describe, expect, it } from 'vitest';
import { diferenca, diferencaVazia, estadoNulo, montarEstado } from './remote';
import { estadoDemo } from './seed';
import type { AppState } from '@/types';

/** Simula ida e volta pelo banco: estado -> linhas (JSON) -> estado. */
function idaEVolta(s: AppState): AppState {
  const linhas = JSON.parse(JSON.stringify(diferenca(estadoNulo(), s).upserts));
  // O banco devolve as colunas em outra ordem; embaralha para garantir que isso não importa
  for (const t of Object.keys(linhas)) linhas[t] = linhas[t].map((l: object) => Object.fromEntries(Object.entries(l).reverse().concat([['lar_id', 'x']])));
  return montarEstado(linhas);
}

describe('mapeamento para o Supabase', () => {
  const demo = estadoDemo();

  it('converte para snake_case e preenche padrões', () => {
    const d = diferenca(estadoNulo(), demo);
    const lanc = d.upserts.lancamentos[0];
    expect(lanc).toHaveProperty('cota_denilson');
    expect(lanc).toHaveProperty('mes_fatura');
    expect(d.upserts.pessoas.find((p) => p.id === 'p-ramon')).toMatchObject({ apelidos: [], integrante: null });
    expect(d.upserts.recorrentes[0]).toMatchObject({ fim: null });
    expect(d.upserts.categorias[1]).toEqual({ nome: demo.categorias[1], ordem: 1 });
  });

  it('ida e volta não gera diferença', () => {
    const volta = idaEVolta(demo);
    expect(diferencaVazia(diferenca(demo, volta))).toBe(true);
    expect(volta.recorrentes[0].fim).toBeNull();
    expect(volta.recorrentes.find((r) => r.formaPagamento !== 'cartao')?.cartaoId).toBeUndefined();
    expect(volta.categorias).toEqual(demo.categorias);
  });

  it('detecta só o que mudou', () => {
    const alvo = demo.lancamentos.find((l) => l.status === 'aberto')!;
    const depois: AppState = {
      ...demo,
      lancamentos: demo.lancamentos.map((l) => (l === alvo ? { ...l, status: 'pago' as const } : l)),
      gastos: demo.gastos.slice(1),
      pagamentosRecorrentes: [...demo.pagamentosRecorrentes, { contaId: 'r-luz', mes: '2026-10', status: 'pago' }],
    };
    const d = diferenca(demo, depois);
    expect(Object.keys(d.upserts).sort()).toEqual(['lancamentos', 'pagamentos_recorrentes']);
    expect(d.upserts.lancamentos).toHaveLength(1);
    expect(d.deletes).toEqual({ gastos: [{ id: demo.gastos[0].id }] });
  });

  it('chave composta dos pagamentos', () => {
    const sem = { ...demo, pagamentosRecorrentes: [] };
    expect(diferenca(demo, sem).deletes.pagamentos_recorrentes).toEqual([{ conta_id: 'r-aluguel', mes: demo.pagamentosRecorrentes[0].mes }]);
  });
});
