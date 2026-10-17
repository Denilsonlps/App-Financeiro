import type { AppState, Cartao, Compra, ContaRecorrente, GastoAvulso, Pessoa, Responsavel } from '@/types';
import { calcularMesFatura, gerarLancamentos, mesAtual, ratear, somarMeses } from '@/lib/finance';

export const CATEGORIAS_PADRAO = [
  'Moradia',
  'Contas de Casa',
  'Mercado',
  'Alimentação',
  'Transporte',
  'Saúde',
  'Educação',
  'Lazer',
  'Vestuário',
  'Assinaturas',
  'Casa e Decoração',
  'Pets',
  'Presentes',
  'Eletrônicos',
  'Outros',
];

const p = (id: string, nome: string, extra: Partial<Pessoa> = {}): Pessoa => ({ id, nome, tipo: 'terceiro', ...extra });

export const PESSOAS_PADRAO: Pessoa[] = [
  p('p-denilson', 'Denilson', { tipo: 'casal', integrante: 'denilson', apelidos: ['den', 'deni'] }),
  p('p-hevellyn', 'Hevellyn', { tipo: 'casal', integrante: 'hevellyn', apelidos: ['hevelyn', 'hev', 'evellyn'] }),
  p('p-irmao', 'Irmão', { apelidos: ['mano', 'meu irmao'] }),
  p('p-pai', 'Pai', { apelidos: ['papai', 'meu pai'] }),
  p('p-evelyn', 'Evelyn', { apelidos: ['evelin'] }),
  p('p-ramon', 'Ramon'),
  p('p-deusa', 'Deusa'),
];

const c = (
  id: string,
  nome: string,
  donoId: string,
  diaFechamento: number,
  diaVencimento: number,
  responsavelPadrao: Responsavel,
  cor: string,
  apelidos: string[] = [],
): Cartao => ({ id, nome, donoId, diaFechamento, diaVencimento, responsavelPadrao, cor, apelidos, ativo: true });

export const CARTOES_PADRAO: Cartao[] = [
  c('c-nu-den', 'Nubank', 'p-denilson', 3, 10, 'casal', '#8a05be', ['nu', 'roxinho']),
  c('c-inter-den', 'Inter', 'p-denilson', 28, 5, 'denilson', '#ff7a00'),
  c('c-itau-hev', 'Itaú', 'p-hevellyn', 1, 8, 'casal', '#ec7000', ['itau']),
  c('c-nu-hev', 'Nubank', 'p-hevellyn', 5, 12, 'hevellyn', '#a855f7', ['nu', 'roxinho']),
  c('c-bb-pai', 'BB', 'p-pai', 20, 28, 'casal', '#fcd500', ['banco do brasil', 'ourocard']),
  c('c-nu-ramon', 'Nubank', 'p-ramon', 2, 9, 'denilson', '#7c3aed', ['nu', 'roxinho']),
  c('c-bv-irmao', 'BV', 'p-irmao', 10, 17, 'casal', '#1d4ed8', ['banco bv']),
  c('c-ria-deusa', 'Riachuelo', 'p-deusa', 25, 2, 'hevellyn', '#111827', ['riachu']),
];

/** Estado vazio (só pessoas e categorias), para quem quer começar do zero. */
export function estadoVazio(): AppState {
  return {
    versao: 1,
    pessoas: PESSOAS_PADRAO.slice(0, 2),
    cartoes: [],
    compras: [],
    lancamentos: [],
    gastos: [],
    recorrentes: [],
    pagamentosRecorrentes: [],
    categorias: [...CATEGORIAS_PADRAO],
  };
}

/** Dados de exemplo inspirados na planilha, posicionados em torno do mês atual. */
export function estadoDemo(): AppState {
  const atual = mesAtual();
  const dia = (mesesAtras: number, d: number) => `${somarMeses(atual, -mesesAtras)}-${String(d).padStart(2, '0')}`;

  const compra = (
    id: string,
    data: string,
    descricao: string,
    categoria: string,
    cartaoId: string,
    valorTotal: number,
    parcelas: number,
    responsavel: Responsavel,
  ): Compra => {
    const cartao = CARTOES_PADRAO.find((x) => x.id === cartaoId)!;
    return {
      id,
      data,
      descricao,
      categoria,
      cartaoId,
      valorTotal,
      parcelas,
      responsavel,
      mesPrimeiraFatura: calcularMesFatura(data, cartao),
      criadoEm: new Date().toISOString(),
    };
  };

  const compras: Compra[] = [
    compra('co-1', dia(2, 14), 'Geladeira Brastemp', 'Casa e Decoração', 'c-bb-pai', 389990, 10, 'casal'),
    compra('co-2', dia(1, 8), 'Livros de Filosofia', 'Educação', 'c-nu-ramon', 12300, 4, 'denilson'),
    compra('co-3', dia(1, 20), 'Tênis de corrida', 'Vestuário', 'c-ria-deusa', 45990, 3, 'hevellyn'),
    compra('co-4', dia(0, 2), 'Mercado do mês', 'Mercado', 'c-nu-den', 87450, 1, 'casal'),
    compra('co-5', dia(3, 11), 'Notebook trabalho', 'Eletrônicos', 'c-inter-den', 480000, 12, 'denilson'),
    compra('co-6', dia(0, 4), 'Farmácia', 'Saúde', 'c-itau-hev', 15680, 1, 'casal'),
    compra('co-7', dia(1, 15), 'Passagens Natal', 'Lazer', 'c-bv-irmao', 156000, 6, 'casal'),
    compra('co-8', dia(0, 6), 'Roupas', 'Vestuário', 'c-nu-hev', 32990, 2, 'hevellyn'),
    compra('co-9', dia(0, 1), 'iFood', 'Alimentação', 'c-nu-den', 8790, 1, 'casal'),
  ];

  // Parcelas de meses passados já quitadas
  const lancamentos = compras.flatMap((co) =>
    gerarLancamentos(co).map((l) => ({ ...l, status: l.mesFatura < atual ? ('pago' as const) : l.status })),
  );

  const gasto = (
    id: string,
    mesesAtras: number,
    d: number,
    descricao: string,
    categoria: string,
    valor: number,
    forma: GastoAvulso['formaPagamento'],
    responsavel: Responsavel,
    pagoPor: GastoAvulso['pagoPor'],
  ): GastoAvulso => ({
    id,
    data: dia(mesesAtras, d),
    mesReferencia: somarMeses(atual, -mesesAtras),
    descricao,
    categoria,
    valor,
    formaPagamento: forma,
    responsavel,
    pagoPor,
    ...ratear(valor, responsavel),
    status: 'pago',
  });

  const gastos: GastoAvulso[] = [
    gasto('g-1', 0, 3, 'Feira', 'Mercado', 14250, 'pix', 'casal', 'hevellyn'),
    gasto('g-2', 0, 5, 'Gasolina', 'Transporte', 20000, 'debito', 'denilson', 'denilson'),
    gasto('g-3', 0, 7, 'Presente aniversário mãe', 'Presentes', 18000, 'pix', 'casal', 'denilson'),
  ];

  const rec = (
    id: string,
    descricao: string,
    categoria: string,
    valor: number,
    forma: ContaRecorrente['formaPagamento'],
    dia: number,
    responsavel: Responsavel,
    pagoPor: ContaRecorrente['pagoPor'],
    cartaoId?: string,
  ): ContaRecorrente => ({
    id,
    descricao,
    categoria,
    valor,
    formaPagamento: forma,
    cartaoId,
    diaVencimento: dia,
    responsavel,
    pagoPor,
    inicio: somarMeses(atual, -6),
    fim: null,
    ativo: true,
  });

  const recorrentes: ContaRecorrente[] = [
    rec('r-aluguel', 'Aluguel', 'Moradia', 180000, 'pix', 5, 'casal', 'denilson'),
    rec('r-internet', 'Internet Fibra', 'Contas de Casa', 11990, 'boleto', 15, 'casal', 'hevellyn'),
    rec('r-agua', 'Água', 'Contas de Casa', 9500, 'boleto', 20, 'casal', 'hevellyn'),
    rec('r-luz', 'Luz', 'Contas de Casa', 21000, 'boleto', 18, 'casal', 'denilson'),
    rec('r-claude', 'Claude Pro', 'Assinaturas', 11000, 'cartao', 10, 'denilson', 'denilson', 'c-nu-den'),
    rec('r-netflix', 'Netflix', 'Assinaturas', 4490, 'cartao', 12, 'casal', 'hevellyn', 'c-nu-hev'),
  ];

  return {
    versao: 1,
    pessoas: [...PESSOAS_PADRAO],
    cartoes: [...CARTOES_PADRAO],
    compras,
    lancamentos,
    gastos,
    recorrentes,
    pagamentosRecorrentes: [{ contaId: 'r-aluguel', mes: atual, status: 'pago' }],
    categorias: [...CATEGORIAS_PADRAO],
  };
}
