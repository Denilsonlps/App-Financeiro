import { describe, expect, it } from 'vitest';
import {
  acertoCasal,
  acertoPorDono,
  calcularMesFatura,
  dividirParcelas,
  gerarLancamentos,
  parcelasAVencer,
  projecao,
  ratear,
  resumoMes,
} from './finance';
import { estadoVazio, PESSOAS_PADRAO, CARTOES_PADRAO } from '@/store/seed';
import type { AppState, Compra } from '@/types';

describe('ratear', () => {
  it('divide 50/50 com centavo ímpar para o Denilson', () => {
    expect(ratear(12301, 'casal')).toEqual({ cotaDenilson: 6151, cotaHevellyn: 6150 });
  });
  it('100% para um integrante', () => {
    expect(ratear(500, 'hevellyn')).toEqual({ cotaDenilson: 0, cotaHevellyn: 500 });
  });
});

describe('dividirParcelas', () => {
  it('soma exatamente o total', () => {
    const p = dividirParcelas(12300, 4);
    expect(p).toEqual([3075, 3075, 3075, 3075]);
    expect(dividirParcelas(10000, 3)).toEqual([3334, 3333, 3333]);
  });
});

describe('calcularMesFatura', () => {
  const nubank = { diaFechamento: 3, diaVencimento: 10 };
  const inter = { diaFechamento: 28, diaVencimento: 5 };
  it('antes do fechamento cai no mesmo mês', () => {
    expect(calcularMesFatura('2026-10-02', nubank)).toBe('2026-10');
  });
  it('no/depois do fechamento vai para o próximo', () => {
    expect(calcularMesFatura('2026-10-03', nubank)).toBe('2026-11');
  });
  it('vencimento antes do fechamento empurra um mês', () => {
    expect(calcularMesFatura('2026-10-15', inter)).toBe('2026-11');
    expect(calcularMesFatura('2026-10-29', inter)).toBe('2026-12');
  });
  it('vira o ano', () => {
    expect(calcularMesFatura('2026-12-20', inter)).toBe('2027-01');
  });
});

function estadoTeste(): AppState {
  const s = estadoVazio();
  s.pessoas = [...PESSOAS_PADRAO];
  s.cartoes = [...CARTOES_PADRAO];
  const compra: Compra = {
    id: 'x',
    data: '2026-10-08',
    descricao: 'Livros',
    categoria: 'Educação',
    cartaoId: 'c-nu-ramon',
    valorTotal: 12300,
    parcelas: 4,
    responsavel: 'denilson',
    mesPrimeiraFatura: '2026-11',
    criadoEm: '',
  };
  const compra2: Compra = { ...compra, id: 'y', cartaoId: 'c-nu-den', valorTotal: 10000, parcelas: 1, responsavel: 'casal' };
  s.compras = [compra, compra2];
  s.lancamentos = [...gerarLancamentos(compra), ...gerarLancamentos(compra2)];
  s.recorrentes = [
    {
      id: 'r',
      descricao: 'Aluguel',
      categoria: 'Moradia',
      valor: 200000,
      formaPagamento: 'pix',
      diaVencimento: 5,
      responsavel: 'casal',
      pagoPor: 'hevellyn',
      inicio: '2026-01',
      fim: '2026-12',
      ativo: true,
    },
  ];
  return s;
}

describe('resumo, acerto e projeção', () => {
  const s = estadoTeste();

  it('resume o mês', () => {
    const r = resumoMes(s, '2026-11');
    expect(r.faturasTotais).toBe(3075 + 10000);
    expect(r.gastosFixos).toBe(200000);
    expect(r.cotaDenilson).toBe(3075 + 5000 + 100000);
    expect(r.cotaHevellyn).toBe(5000 + 100000);
    expect(r.restante).toBe(r.totalGeral);
  });

  it('agrupa por dono do cartão', () => {
    const donos = acertoPorDono(s, '2026-11');
    expect(donos.map((d) => d.dono.nome)).toEqual(['Denilson', 'Ramon']);
    expect(donos[1].cotaDenilson).toBe(3075);
  });

  it('calcula o acerto do casal', () => {
    // Denilson pagou a fatura do Nubank dele (cota Hev 5000); Hev pagou o aluguel (cota Den 100000)
    expect(acertoCasal(s, '2026-11').saldo).toBe(5000 - 100000);
  });

  it('projeta respeitando o fim da recorrente', () => {
    const p = projecao(s, '2026-11', 5);
    expect(p.map((x) => x.recorrentes)).toEqual([200000, 200000, 0, 0, 0]);
    // 4 parcelas: nov..fev (+ compra à vista em nov)
    expect(p.map((x) => x.parcelas)).toEqual([3075 + 10000, 3075, 3075, 3075, 0]);
  });

  it('lista parcelas a vencer com saldo devedor', () => {
    const [item] = parcelasAVencer(s, '2026-12');
    expect(item.parcelasRestantes).toBe(3);
    expect(item.saldoDevedor).toBe(3075 * 3);
    expect(item.proximaParcela).toBe(2);
  });
});
