/**
 * Motor financeiro: rateio, parcelamento, mês de fatura, resumo mensal,
 * acerto de contas e projeções. Funções puras (sem React), testadas em
 * `finance.test.ts`.
 */
import { addMonths, format, getDaysInMonth, parse } from 'date-fns';
import type {
  AppState,
  Cartao,
  Centavos,
  Compra,
  ContaRecorrente,
  DataISO,
  Id,
  Integrante,
  Lancamento,
  Mes,
  Pessoa,
  Responsavel,
  StatusPagamento,
} from '@/types';
import { uid } from './utils';

// ---------------------------------------------------------------- Meses

export function mesDe(data: Date | DataISO): Mes {
  const d = typeof data === 'string' ? parse(data, 'yyyy-MM-dd', new Date()) : data;
  return format(d, 'yyyy-MM');
}

export function somarMeses(mes: Mes, n: number): Mes {
  return format(addMonths(parse(mes, 'yyyy-MM', new Date()), n), 'yyyy-MM');
}

export function mesAtual(): Mes {
  return mesDe(new Date());
}

export function hojeISO(): DataISO {
  return format(new Date(), 'yyyy-MM-dd');
}

/** Lista [inicio, inicio+1, ..., inicio+n-1]. */
export function sequenciaMeses(inicio: Mes, n: number): Mes[] {
  return Array.from({ length: n }, (_, i) => somarMeses(inicio, i));
}

// ---------------------------------------------------------------- Rateio

export interface Cotas {
  cotaDenilson: Centavos;
  cotaHevellyn: Centavos;
}

/** Divide um valor entre o casal. No 50/50 o centavo ímpar fica com o Denilson. */
export function ratear(valor: Centavos, responsavel: Responsavel): Cotas {
  switch (responsavel) {
    case 'denilson':
      return { cotaDenilson: valor, cotaHevellyn: 0 };
    case 'hevellyn':
      return { cotaDenilson: 0, cotaHevellyn: valor };
    case 'casal': {
      const metade = Math.floor(valor / 2);
      return { cotaDenilson: valor - metade, cotaHevellyn: metade };
    }
  }
}

/** Divide o total em N parcelas inteiras; a sobra de centavos vai na 1ª parcela. */
export function dividirParcelas(total: Centavos, n: number): Centavos[] {
  const qtd = Math.max(1, Math.floor(n));
  const base = Math.floor(total / qtd);
  const sobra = total - base * qtd;
  return Array.from({ length: qtd }, (_, i) => (i === 0 ? base + sobra : base));
}

// ---------------------------------------------------------------- Fatura

/**
 * Descobre em qual fatura (mês de vencimento) uma compra cai.
 * Regra: compras feitas a partir do dia de fechamento vão para o ciclo
 * seguinte. A fatura vence no primeiro `diaVencimento` após o fechamento.
 */
export function calcularMesFatura(data: DataISO, cartao: Pick<Cartao, 'diaFechamento' | 'diaVencimento'>): Mes {
  const d = parse(data, 'yyyy-MM-dd', new Date());
  const mesCompra = mesDe(d);
  const mesFechamento = d.getDate() >= cartao.diaFechamento ? somarMeses(mesCompra, 1) : mesCompra;
  // Se o vencimento é depois do fechamento no calendário, vence no mesmo mês;
  // senão (ex.: fecha dia 28, vence dia 5) vence no mês seguinte.
  return cartao.diaVencimento > cartao.diaFechamento ? mesFechamento : somarMeses(mesFechamento, 1);
}

/** Dia efetivo de vencimento dentro de um mês (ajusta 31 em meses curtos). */
export function dataVencimento(mes: Mes, dia: number): DataISO {
  const d = parse(mes, 'yyyy-MM', new Date());
  const ultimo = getDaysInMonth(d);
  return `${mes}-${String(Math.min(dia, ultimo)).padStart(2, '0')}`;
}

/** Gera as linhas de `Lancamentos` (uma por parcela) a partir de uma compra. */
export function gerarLancamentos(compra: Compra, statusPorParcela?: Map<number, StatusPagamento>): Lancamento[] {
  const valores = dividirParcelas(compra.valorTotal, compra.parcelas);
  return valores.map((valorParcela, i) => ({
    id: uid(),
    compraId: compra.id,
    data: compra.data,
    descricao: compra.descricao,
    categoria: compra.categoria,
    cartaoId: compra.cartaoId,
    parcelaAtual: i + 1,
    parcelasTotal: compra.parcelas,
    valorParcela,
    mesFatura: somarMeses(compra.mesPrimeiraFatura, i),
    responsavel: compra.responsavel,
    ...ratear(valorParcela, compra.responsavel),
    status: statusPorParcela?.get(i + 1) ?? 'aberto',
  }));
}

// ---------------------------------------------------------------- Recorrentes

export function recorrenteAtivaNoMes(conta: ContaRecorrente, mes: Mes): boolean {
  return conta.ativo && conta.inicio <= mes && (conta.fim === null || conta.fim >= mes);
}

// ---------------------------------------------------------------- Itens do mês

export type OrigemItem = 'cartao' | 'avulso' | 'recorrente';

/** Visão unificada de tudo que pesa no orçamento de um mês. */
export interface ItemMes {
  origem: OrigemItem;
  id: Id; // id do lançamento, gasto ou conta recorrente
  descricao: string;
  categoria: string;
  valor: Centavos;
  responsavel: Responsavel;
  cotaDenilson: Centavos;
  cotaHevellyn: Centavos;
  status: StatusPagamento;
  /** Cartão em que o item é cobrado (compras e recorrentes no cartão). */
  cartaoId?: Id;
  /** Quem do casal desembolsou (só para itens fora do cartão). */
  pagoPor?: Integrante;
  parcela?: string; // "2/3"
}

export function itensDoMes(state: AppState, mes: Mes): ItemMes[] {
  const itens: ItemMes[] = [];

  for (const l of state.lancamentos) {
    if (l.mesFatura !== mes) continue;
    itens.push({
      origem: 'cartao',
      id: l.id,
      descricao: l.descricao,
      categoria: l.categoria,
      valor: l.valorParcela,
      responsavel: l.responsavel,
      cotaDenilson: l.cotaDenilson,
      cotaHevellyn: l.cotaHevellyn,
      status: l.status,
      cartaoId: l.cartaoId,
      parcela: l.parcelasTotal > 1 ? `${l.parcelaAtual}/${l.parcelasTotal}` : undefined,
    });
  }

  for (const g of state.gastos) {
    if (g.mesReferencia !== mes) continue;
    itens.push({
      origem: 'avulso',
      id: g.id,
      descricao: g.descricao,
      categoria: g.categoria,
      valor: g.valor,
      responsavel: g.responsavel,
      cotaDenilson: g.cotaDenilson,
      cotaHevellyn: g.cotaHevellyn,
      status: g.status,
      pagoPor: g.pagoPor,
    });
  }

  for (const c of state.recorrentes) {
    if (!recorrenteAtivaNoMes(c, mes)) continue;
    const pg = state.pagamentosRecorrentes.find((p) => p.contaId === c.id && p.mes === mes);
    const valor = pg?.valorReal ?? c.valor;
    const noCartao = c.formaPagamento === 'cartao' && c.cartaoId;
    itens.push({
      origem: 'recorrente',
      id: c.id,
      descricao: c.descricao,
      categoria: c.categoria,
      valor,
      responsavel: c.responsavel,
      ...ratear(valor, c.responsavel),
      status: pg?.status ?? 'aberto',
      cartaoId: noCartao ? c.cartaoId : undefined,
      pagoPor: noCartao ? undefined : c.pagoPor,
    });
  }

  return itens;
}

// ---------------------------------------------------------------- Resumo

export interface ResumoMes {
  faturasTotais: Centavos; // tudo que cai em cartão (compras + recorrentes no cartão)
  gastosFixos: Centavos; // recorrentes fora do cartão + gastos avulsos
  totalGeral: Centavos;
  cotaDenilson: Centavos;
  cotaHevellyn: Centavos;
  totalPago: Centavos;
  restante: Centavos;
}

const soma = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function resumirItens(itens: ItemMes[]): ResumoMes {
  const faturasTotais = soma(itens.filter((i) => i.cartaoId).map((i) => i.valor));
  const totalGeral = soma(itens.map((i) => i.valor));
  const totalPago = soma(itens.filter((i) => i.status === 'pago').map((i) => i.valor));
  return {
    faturasTotais,
    gastosFixos: totalGeral - faturasTotais,
    totalGeral,
    cotaDenilson: soma(itens.map((i) => i.cotaDenilson)),
    cotaHevellyn: soma(itens.map((i) => i.cotaHevellyn)),
    totalPago,
    restante: totalGeral - totalPago,
  };
}

export function resumoMes(state: AppState, mes: Mes): ResumoMes {
  return resumirItens(itensDoMes(state, mes));
}

// ---------------------------------------------------------------- Faturas / Donos

export interface FaturaCartao {
  cartao: Cartao;
  dono: Pessoa | undefined;
  mes: Mes;
  vencimento: DataISO;
  itens: ItemMes[];
  total: Centavos;
  cotaDenilson: Centavos;
  cotaHevellyn: Centavos;
  pago: boolean;
}

export function faturasDoMes(state: AppState, mes: Mes): FaturaCartao[] {
  const itens = itensDoMes(state, mes).filter((i) => i.cartaoId);
  return state.cartoes
    .map((cartao) => {
      const doCartao = itens.filter((i) => i.cartaoId === cartao.id);
      return {
        cartao,
        dono: state.pessoas.find((p) => p.id === cartao.donoId),
        mes,
        vencimento: dataVencimento(mes, cartao.diaVencimento),
        itens: doCartao,
        total: soma(doCartao.map((i) => i.valor)),
        cotaDenilson: soma(doCartao.map((i) => i.cotaDenilson)),
        cotaHevellyn: soma(doCartao.map((i) => i.cotaHevellyn)),
        pago: doCartao.length > 0 && doCartao.every((i) => i.status === 'pago'),
      };
    })
    .filter((f) => f.itens.length > 0)
    .sort((a, b) => b.total - a.total);
}

export interface AcertoDono {
  dono: Pessoa;
  faturas: FaturaCartao[];
  total: Centavos;
  cotaDenilson: Centavos;
  cotaHevellyn: Centavos;
  pago: boolean;
}

/** "Quanto devo pagar para cada Dono de Cartão" no mês. */
export function acertoPorDono(state: AppState, mes: Mes): AcertoDono[] {
  const porDono = new Map<Id, FaturaCartao[]>();
  for (const f of faturasDoMes(state, mes)) {
    const k = f.cartao.donoId;
    porDono.set(k, [...(porDono.get(k) ?? []), f]);
  }
  return [...porDono.entries()]
    .map(([donoId, faturas]) => ({
      dono: state.pessoas.find((p) => p.id === donoId) ?? { id: donoId, nome: '?', tipo: 'terceiro' as const },
      faturas,
      total: soma(faturas.map((f) => f.total)),
      cotaDenilson: soma(faturas.map((f) => f.cotaDenilson)),
      cotaHevellyn: soma(faturas.map((f) => f.cotaHevellyn)),
      pago: faturas.every((f) => f.pago),
    }))
    .sort((a, b) => {
      // Integrantes do casal primeiro, depois terceiros por valor
      if (a.dono.tipo !== b.dono.tipo) return a.dono.tipo === 'casal' ? -1 : 1;
      return b.total - a.total;
    });
}

export interface AcertoCasal {
  /** Positivo: Hevellyn transfere para Denilson. Negativo: o contrário. */
  saldo: Centavos;
  denilsonAdiantou: Centavos; // cotas da Hevellyn pagas pelo Denilson
  hevellynAdiantou: Centavos; // cotas do Denilson pagas pela Hevellyn
}

/**
 * Acerto entre os dois: quando um paga algo (fatura do próprio cartão, PIX,
 * conta recorrente) que tem cota do outro, o outro fica devendo essa cota.
 * Faturas de terceiros não geram transferência: cada um paga a própria cota
 * direto ao dono do cartão.
 */
export function acertoCasal(state: AppState, mes: Mes): AcertoCasal {
  const integrantePorPessoa = new Map(state.pessoas.map((p) => [p.id, p.integrante]));
  const donoDoCartao = new Map(state.cartoes.map((c) => [c.id, integrantePorPessoa.get(c.donoId)]));
  let denilsonAdiantou = 0;
  let hevellynAdiantou = 0;
  for (const item of itensDoMes(state, mes)) {
    const pagador = item.cartaoId ? donoDoCartao.get(item.cartaoId) : item.pagoPor;
    if (pagador === 'denilson') denilsonAdiantou += item.cotaHevellyn;
    if (pagador === 'hevellyn') hevellynAdiantou += item.cotaDenilson;
  }
  return { saldo: denilsonAdiantou - hevellynAdiantou, denilsonAdiantou, hevellynAdiantou };
}

// ---------------------------------------------------------------- Projeção

export interface ProjecaoMes {
  mes: Mes;
  parcelas: Centavos; // compras parceladas/à vista no cartão
  recorrentes: Centavos;
  avulsos: Centavos; // já lançados para meses futuros
  total: Centavos;
  cotaDenilson: Centavos;
  cotaHevellyn: Centavos;
}

export function projecao(state: AppState, inicio: Mes, meses = 12): ProjecaoMes[] {
  return sequenciaMeses(inicio, meses).map((mes) => {
    const itens = itensDoMes(state, mes);
    const por = (o: OrigemItem) => soma(itens.filter((i) => i.origem === o).map((i) => i.valor));
    const r = resumirItens(itens);
    return {
      mes,
      parcelas: por('cartao'),
      recorrentes: por('recorrente'),
      avulsos: por('avulso'),
      total: r.totalGeral,
      cotaDenilson: r.cotaDenilson,
      cotaHevellyn: r.cotaHevellyn,
    };
  });
}

export interface ParcelaAVencer {
  compra: Compra;
  cartao: Cartao | undefined;
  dono: Pessoa | undefined;
  valorParcela: Centavos;
  parcelasRestantes: number;
  proximaParcela: number;
  saldoDevedor: Centavos;
  saldoDenilson: Centavos;
  saldoHevellyn: Centavos;
  proximaFatura: Mes;
  ultimaFatura: Mes;
}

/** Compras parceladas que ainda têm parcelas em aberto a partir de `aPartirDe`. */
export function parcelasAVencer(state: AppState, aPartirDe: Mes): ParcelaAVencer[] {
  const res: ParcelaAVencer[] = [];
  for (const compra of state.compras) {
    if (compra.parcelas < 2) continue;
    const abertas = state.lancamentos
      .filter((l) => l.compraId === compra.id && l.status === 'aberto' && l.mesFatura >= aPartirDe)
      .sort((a, b) => a.parcelaAtual - b.parcelaAtual);
    if (abertas.length === 0) continue;
    const cartao = state.cartoes.find((c) => c.id === compra.cartaoId);
    res.push({
      compra,
      cartao,
      dono: state.pessoas.find((p) => p.id === cartao?.donoId),
      valorParcela: abertas[abertas.length - 1].valorParcela,
      parcelasRestantes: abertas.length,
      proximaParcela: abertas[0].parcelaAtual,
      saldoDevedor: soma(abertas.map((l) => l.valorParcela)),
      saldoDenilson: soma(abertas.map((l) => l.cotaDenilson)),
      saldoHevellyn: soma(abertas.map((l) => l.cotaHevellyn)),
      proximaFatura: abertas[0].mesFatura,
      ultimaFatura: abertas[abertas.length - 1].mesFatura,
    });
  }
  return res.sort((a, b) => b.saldoDevedor - a.saldoDevedor);
}
