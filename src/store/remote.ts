/**
 * Ponte entre o AppState (camelCase, em memória) e as tabelas do Supabase
 * (snake_case, uma linha por registro). Funções puras: não falam com a rede.
 *
 * A sincronização é por diferença: compara o último estado confirmado pelo
 * servidor com o estado atual e gera só os upserts/deletes necessários.
 * Assim as ações (`actions.ts`) continuam síncronas e sem saber da nuvem.
 */
import type { AppState, Cartao, Compra, ContaRecorrente, GastoAvulso, Lancamento, PagamentoRecorrente, Pessoa } from '@/types';

export type Linha = Record<string, unknown>;

interface Tabela<T> {
  /** Nome da tabela no Postgres. */
  nome: string;
  /** Coleção correspondente no AppState. */
  colecao: keyof Omit<AppState, 'versao'>;
  /** Colunas da chave primária (além de lar_id). */
  chave: string[];
  paraLinha(x: T, indice: number): Linha;
  deLinha(l: Linha): T;
}

const paraSnake = (k: string) => k.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase());
const paraCamel = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

/**
 * Objeto camelCase -> linha snake_case. Usa a lista explícita de campos para
 * que opcionais ausentes virem `null` (num upsert, coluna omitida manteria o
 * valor antigo no banco).
 */
function linhaGenerica(x: object, campos: readonly string[], padroes: Linha = {}): Linha {
  const l: Linha = {};
  for (const k of campos) {
    const v = (x as Record<string, unknown>)[k];
    l[paraSnake(k)] = v === undefined || v === null ? (padroes[paraSnake(k)] ?? null) : v;
  }
  return l;
}

/** Linha snake_case -> objeto camelCase. null vira undefined, exceto em `manterNull`. */
function objetoGenerico<T>(l: Linha, manterNull: string[] = []): T {
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(l)) {
    if (k === 'lar_id') continue;
    const ck = paraCamel(k);
    if (v === null && !manterNull.includes(ck)) continue;
    o[ck] = v;
  }
  return o as T;
}

const generica = <T extends object>(
  nome: string,
  colecao: Tabela<T>['colecao'],
  campos: readonly (keyof T & string)[],
  opts: { padroes?: Linha; manterNull?: string[] } = {},
): Tabela<T> => ({
  nome,
  colecao,
  chave: ['id'],
  paraLinha: (x) => linhaGenerica(x, campos, opts.padroes),
  deLinha: (l) => objetoGenerico<T>(l, opts.manterNull),
});

/** Em ordem de dependência (chaves estrangeiras): inserir nesta ordem, apagar na inversa. */
export const TABELAS: Tabela<never>[] = [
  generica<Pessoa>('pessoas', 'pessoas', ['id', 'nome', 'tipo', 'integrante', 'apelidos'], { padroes: { apelidos: [] } }),
  {
    nome: 'categorias',
    colecao: 'categorias',
    chave: ['nome'],
    paraLinha: (nome: string, i: number) => ({ nome, ordem: i }),
    deLinha: (l: Linha) => l.nome as string,
  } as Tabela<string>,
  generica<Cartao>('cartoes', 'cartoes', ['id', 'nome', 'donoId', 'diaFechamento', 'diaVencimento', 'responsavelPadrao', 'cor', 'apelidos', 'ativo'], {
    padroes: { apelidos: [] },
  }),
  generica<Compra>('compras', 'compras', ['id', 'data', 'descricao', 'categoria', 'cartaoId', 'valorTotal', 'parcelas', 'responsavel', 'mesPrimeiraFatura', 'criadoEm']),
  generica<Lancamento>('lancamentos', 'lancamentos', [
    'id', 'compraId', 'data', 'descricao', 'categoria', 'cartaoId', 'parcelaAtual', 'parcelasTotal',
    'valorParcela', 'mesFatura', 'responsavel', 'cotaDenilson', 'cotaHevellyn', 'status',
  ]),
  generica<GastoAvulso>('gastos', 'gastos', [
    'id', 'data', 'mesReferencia', 'descricao', 'categoria', 'valor', 'formaPagamento', 'responsavel',
    'pagoPor', 'cotaDenilson', 'cotaHevellyn', 'status',
  ]),
  generica<ContaRecorrente>('recorrentes', 'recorrentes', [
    'id', 'descricao', 'categoria', 'valor', 'formaPagamento', 'cartaoId', 'diaVencimento', 'responsavel',
    'pagoPor', 'inicio', 'fim', 'ativo',
  ], { manterNull: ['fim'] }),
  {
    nome: 'pagamentos_recorrentes',
    colecao: 'pagamentosRecorrentes',
    chave: ['conta_id', 'mes'],
    paraLinha: (p: PagamentoRecorrente) => linhaGenerica(p, ['contaId', 'mes', 'status', 'valorReal']),
    deLinha: (l: Linha) => objetoGenerico<PagamentoRecorrente>(l),
  } as Tabela<PagamentoRecorrente>,
] as Tabela<never>[];

/** JSON com chaves ordenadas, para comparar linhas independente da ordem dos campos. */
function estavel(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(estavel).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + estavel((v as Linha)[k])).join(',') + '}';
  }
  return JSON.stringify(v);
}

const chaveDe = (t: Tabela<never>, l: Linha) => t.chave.map((c) => String(l[c])).join('\u0000');

export interface Diferenca {
  /** Por tabela: linhas novas ou alteradas. */
  upserts: Record<string, Linha[]>;
  /** Por tabela: só as colunas de chave das linhas removidas. */
  deletes: Record<string, Linha[]>;
}

export function diferenca(antes: AppState, depois: AppState): Diferenca {
  const d: Diferenca = { upserts: {}, deletes: {} };
  for (const t of TABELAS) {
    const linhas = (s: AppState) => {
      const m = new Map<string, Linha>();
      (s[t.colecao] as never[]).forEach((x, i) => {
        const l = t.paraLinha(x, i);
        m.set(chaveDe(t, l), l);
      });
      return m;
    };
    // Atalho: mesma referência = nada mudou nesta coleção
    if (antes[t.colecao] === depois[t.colecao]) continue;
    const a = linhas(antes);
    const b = linhas(depois);
    const up = [...b].filter(([k, l]) => !a.has(k) || estavel(a.get(k)) !== estavel(l)).map(([, l]) => l);
    const del = [...a.keys()].filter((k) => !b.has(k)).map((k) => Object.fromEntries(t.chave.map((c) => [c, a.get(k)![c]])));
    if (up.length) d.upserts[t.nome] = up;
    if (del.length) d.deletes[t.nome] = del;
  }
  return d;
}

export const diferencaVazia = (d: Diferenca) => Object.keys(d.upserts).length === 0 && Object.keys(d.deletes).length === 0;

/** Monta o AppState a partir das linhas de cada tabela (já filtradas pelo lar). */
export function montarEstado(linhas: Record<string, Linha[]>): AppState {
  const s: AppState = {
    versao: 1,
    pessoas: [],
    cartoes: [],
    compras: [],
    lancamentos: [],
    gastos: [],
    recorrentes: [],
    pagamentosRecorrentes: [],
    categorias: [],
  };
  for (const t of TABELAS) {
    let ls = linhas[t.nome] ?? [];
    if (t.nome === 'categorias') ls = [...ls].sort((a, b) => Number(a.ordem) - Number(b.ordem));
    (s[t.colecao] as unknown[]) = ls.map((l) => t.deLinha(l));
  }
  return s;
}

/** Estado totalmente vazio (nem pessoas nem categorias): base para o primeiro envio. */
export function estadoNulo(): AppState {
  return montarEstado({});
}
