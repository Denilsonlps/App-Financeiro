/** Todas as mutações do estado. Cada ação é síncrona e persiste no LocalStorage. */
import type {
  AppState,
  Cartao,
  Compra,
  ContaRecorrente,
  GastoAvulso,
  Id,
  Mes,
  Pessoa,
  StatusPagamento,
} from '@/types';
import { gerarLancamentos, ratear } from '@/lib/finance';
import { setState, getState } from './store';
import { estadoDemo, estadoVazio } from './seed';

const substituir = <T extends { id: Id }>(lista: T[], item: T) =>
  lista.some((x) => x.id === item.id) ? lista.map((x) => (x.id === item.id ? item : x)) : [...lista, item];

// ------------------------------------------------------------ Pessoas

export function salvarPessoa(p: Pessoa) {
  setState((s) => ({ ...s, pessoas: substituir(s.pessoas, p) }));
}

/** Retorna mensagem de erro se não puder remover. */
export function removerPessoa(id: Id): string | null {
  const s = getState();
  const pessoa = s.pessoas.find((p) => p.id === id);
  if (pessoa?.tipo === 'casal') return 'Os integrantes do casal não podem ser removidos.';
  if (s.cartoes.some((c) => c.donoId === id)) return 'Essa pessoa ainda é dona de cartões. Remova-os primeiro.';
  setState((st) => ({ ...st, pessoas: st.pessoas.filter((p) => p.id !== id) }));
  return null;
}

// ------------------------------------------------------------ Cartões

export function salvarCartao(c: Cartao) {
  setState((s) => ({ ...s, cartoes: substituir(s.cartoes, c) }));
}

export function removerCartao(id: Id): string | null {
  const s = getState();
  if (s.compras.some((c) => c.cartaoId === id)) return 'Há compras neste cartão. Desative-o em vez de excluir.';
  if (s.recorrentes.some((r) => r.cartaoId === id)) return 'Há contas recorrentes cobradas neste cartão.';
  setState((st) => ({ ...st, cartoes: st.cartoes.filter((c) => c.id !== id) }));
  return null;
}

// ------------------------------------------------------------ Compras / Lançamentos

/** Cria ou edita uma compra, regenerando as parcelas e preservando id e status das existentes. */
export function salvarCompra(compra: Compra) {
  setState((s) => {
    const anteriores = new Map(s.lancamentos.filter((l) => l.compraId === compra.id).map((l) => [l.parcelaAtual, l] as const));
    return {
      ...s,
      compras: substituir(s.compras, compra),
      lancamentos: [
        ...s.lancamentos.filter((l) => l.compraId !== compra.id),
        ...gerarLancamentos(compra, anteriores),
      ],
      categorias: s.categorias.includes(compra.categoria) ? s.categorias : [...s.categorias, compra.categoria],
    };
  });
}

export function removerCompra(id: Id) {
  setState((s) => ({
    ...s,
    compras: s.compras.filter((c) => c.id !== id),
    lancamentos: s.lancamentos.filter((l) => l.compraId !== id),
  }));
}

export function definirStatusLancamento(id: Id, status: StatusPagamento) {
  setState((s) => ({ ...s, lancamentos: s.lancamentos.map((l) => (l.id === id ? { ...l, status } : l)) }));
}

/** Marca a fatura inteira (compras + recorrentes no cartão) de um mês. */
export function definirStatusFatura(cartaoId: Id, mes: Mes, status: StatusPagamento) {
  setState((s) => {
    const recorrentesDoCartao = s.recorrentes.filter((r) => r.formaPagamento === 'cartao' && r.cartaoId === cartaoId);
    let pagamentos = s.pagamentosRecorrentes;
    for (const r of recorrentesDoCartao) pagamentos = upsertPagamento(pagamentos, r.id, mes, status);
    return {
      ...s,
      lancamentos: s.lancamentos.map((l) => (l.cartaoId === cartaoId && l.mesFatura === mes ? { ...l, status } : l)),
      pagamentosRecorrentes: pagamentos,
    };
  });
}

// ------------------------------------------------------------ Gastos avulsos

export function salvarGasto(g: GastoAvulso) {
  const comCotas = { ...g, ...ratear(g.valor, g.responsavel) };
  setState((s) => ({
    ...s,
    gastos: substituir(s.gastos, comCotas),
    categorias: s.categorias.includes(g.categoria) ? s.categorias : [...s.categorias, g.categoria],
  }));
}

export function removerGasto(id: Id) {
  setState((s) => ({ ...s, gastos: s.gastos.filter((g) => g.id !== id) }));
}

export function definirStatusGasto(id: Id, status: StatusPagamento) {
  setState((s) => ({ ...s, gastos: s.gastos.map((g) => (g.id === id ? { ...g, status } : g)) }));
}

// ------------------------------------------------------------ Recorrentes

export function salvarRecorrente(r: ContaRecorrente) {
  setState((s) => ({
    ...s,
    recorrentes: substituir(s.recorrentes, r),
    categorias: s.categorias.includes(r.categoria) ? s.categorias : [...s.categorias, r.categoria],
  }));
}

export function removerRecorrente(id: Id) {
  setState((s) => ({
    ...s,
    recorrentes: s.recorrentes.filter((r) => r.id !== id),
    pagamentosRecorrentes: s.pagamentosRecorrentes.filter((p) => p.contaId !== id),
  }));
}

function upsertPagamento(
  lista: AppState['pagamentosRecorrentes'],
  contaId: Id,
  mes: Mes,
  status: StatusPagamento,
  valorReal?: number,
) {
  const existente = lista.find((p) => p.contaId === contaId && p.mes === mes);
  const novo = { contaId, mes, status, valorReal: valorReal ?? existente?.valorReal };
  return existente ? lista.map((p) => (p === existente ? novo : p)) : [...lista, novo];
}

export function definirPagamentoRecorrente(contaId: Id, mes: Mes, status: StatusPagamento, valorReal?: number) {
  setState((s) => ({ ...s, pagamentosRecorrentes: upsertPagamento(s.pagamentosRecorrentes, contaId, mes, status, valorReal) }));
}

// ------------------------------------------------------------ Backup

export function exportarJSON(): string {
  return JSON.stringify(getState(), null, 2);
}

export function importarJSON(texto: string): string | null {
  try {
    const s = JSON.parse(texto) as AppState;
    if (s.versao !== 1 || !Array.isArray(s.cartoes) || !Array.isArray(s.lancamentos)) return 'Arquivo não reconhecido.';
    setState(() => s);
    return null;
  } catch {
    return 'JSON inválido.';
  }
}

export function restaurar(tipo: 'demo' | 'vazio') {
  setState(() => (tipo === 'demo' ? estadoDemo() : estadoVazio()));
}
