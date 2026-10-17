/**
 * Modelo de dados do app. Espelha as abas da planilha original e o schema
 * relacional em `supabase/schema.sql` (mesmos nomes de entidade, em camelCase).
 *
 * Convenções:
 * - Todo valor monetário é armazenado em CENTAVOS (inteiro) para evitar erros
 *   de ponto flutuante no rateio (ex.: R$ 123,45 => 12345).
 * - Meses são strings "YYYY-MM" (ex.: "2026-10"), datas são "YYYY-MM-DD".
 */

export type Id = string;
export type Mes = string; // "YYYY-MM"
export type DataISO = string; // "YYYY-MM-DD"
export type Centavos = number;

/** Quem assume o custo de um lançamento. */
export type Responsavel = 'denilson' | 'hevellyn' | 'casal';

/** Integrante do casal que efetivamente desembolsou o dinheiro (para o acerto). */
export type Integrante = 'denilson' | 'hevellyn';

export type StatusPagamento = 'aberto' | 'pago';

export type FormaPagamento = 'pix' | 'boleto' | 'debito' | 'dinheiro' | 'transferencia' | 'cartao';

/** 1. Usuarios_e_Terceiros — qualquer pessoa que possa ser dona de um cartão. */
export interface Pessoa {
  id: Id;
  nome: string;
  /** "casal" = Denilson ou Hevellyn; "terceiro" = Irmão, Pai, Ramon... */
  tipo: 'casal' | 'terceiro';
  /** Preenchido só para os dois integrantes do casal. */
  integrante?: Integrante;
  /** Apelidos usados pelo Smart Input (ex.: "mano" para Irmão). */
  apelidos?: string[];
}

/** 2. Cartoes */
export interface Cartao {
  id: Id;
  nome: string; // Nubank, BB, Itaú, Inter, BV, Riachuelo
  donoId: Id; // FK -> Pessoa
  diaFechamento: number; // 1..31
  diaVencimento: number; // 1..31
  responsavelPadrao: Responsavel;
  cor: string; // hex usado no chip do cartão
  apelidos?: string[]; // ex.: ["roxinho"] para Nubank
  ativo: boolean;
}

/** Compra feita no cartão (cabeçalho). Gera N lançamentos/parcelas. */
export interface Compra {
  id: Id;
  data: DataISO;
  descricao: string;
  categoria: string;
  cartaoId: Id;
  valorTotal: Centavos;
  parcelas: number;
  responsavel: Responsavel;
  /** Mês da fatura da 1ª parcela (calculado pelo fechamento, mas editável). */
  mesPrimeiraFatura: Mes;
  criadoEm: string;
}

/** 3. Lancamentos — uma linha por parcela, exatamente como na planilha. */
export interface Lancamento {
  id: Id;
  compraId: Id; // FK -> Compra
  data: DataISO;
  descricao: string;
  categoria: string;
  cartaoId: Id; // FK -> Cartao (o dono vem do cartão)
  parcelaAtual: number;
  parcelasTotal: number;
  valorParcela: Centavos;
  mesFatura: Mes;
  responsavel: Responsavel;
  cotaDenilson: Centavos;
  cotaHevellyn: Centavos;
  status: StatusPagamento;
}

/** 4. Gastos_Fixos_e_Variaveis — PIX, boleto, débito... fora do cartão. */
export interface GastoAvulso {
  id: Id;
  data: DataISO;
  mesReferencia: Mes;
  descricao: string;
  categoria: string;
  valor: Centavos;
  formaPagamento: FormaPagamento;
  responsavel: Responsavel;
  pagoPor: Integrante;
  cotaDenilson: Centavos;
  cotaHevellyn: Centavos;
  status: StatusPagamento;
}

/** 5. Contas_Recorrentes — repetem todo mês entre `inicio` e `fim`. */
export interface ContaRecorrente {
  id: Id;
  descricao: string;
  categoria: string;
  valor: Centavos;
  formaPagamento: FormaPagamento;
  /** Quando a forma é "cartao", a conta entra na fatura deste cartão. */
  cartaoId?: Id;
  diaVencimento: number;
  responsavel: Responsavel;
  pagoPor: Integrante;
  inicio: Mes;
  fim: Mes | null; // null = sem data de término
  ativo: boolean;
}

/** Status de pagamento de uma conta recorrente num mês específico. */
export interface PagamentoRecorrente {
  contaId: Id;
  mes: Mes;
  status: StatusPagamento;
  /** Valor real pago, quando difere do valor cadastrado (ex.: conta de luz). */
  valorReal?: Centavos;
}

export interface AppState {
  versao: 1;
  pessoas: Pessoa[];
  cartoes: Cartao[];
  compras: Compra[];
  lancamentos: Lancamento[];
  gastos: GastoAvulso[];
  recorrentes: ContaRecorrente[];
  pagamentosRecorrentes: PagamentoRecorrente[];
  categorias: string[];
}
