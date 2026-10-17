import { format, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Centavos, FormaPagamento, Mes, Responsavel } from '@/types';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function moeda(centavos: Centavos): string {
  return brl.format(centavos / 100);
}

/** "R$ 1,2 mil" — usado nos eixos do gráfico. */
export function moedaCurta(centavos: Centavos): string {
  const reais = centavos / 100;
  if (Math.abs(reais) >= 1000) return `R$ ${(reais / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`;
  return `R$ ${Math.round(reais)}`;
}

/** Converte "1.234,56", "1234.56" ou "123" em centavos. Retorna NaN se inválido. */
export function parseMoeda(texto: string): Centavos {
  const limpo = texto.replace(/[^\d,.-]/g, '');
  if (!limpo) return NaN;
  let normal = limpo;
  if (limpo.includes(',')) normal = limpo.replace(/\./g, '').replace(',', '.');
  else if ((limpo.match(/\./g) ?? []).length > 1 || /\.\d{3}$/.test(limpo)) normal = limpo.replace(/\./g, '');
  const n = Number(normal);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

export function centavosParaInput(c: Centavos): string {
  return (c / 100).toFixed(2).replace('.', ',');
}

export function mesLongo(mes: Mes): string {
  const d = parse(mes, 'yyyy-MM', new Date());
  const s = format(d, "MMMM 'de' yyyy", { locale: ptBR });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function mesCurto(mes: Mes): string {
  const d = parse(mes, 'yyyy-MM', new Date());
  const s = format(d, 'MMM/yy', { locale: ptBR });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function dataCurta(iso: string): string {
  return format(parse(iso, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy');
}

export const ROTULO_RESPONSAVEL: Record<Responsavel, string> = {
  denilson: 'Denilson (100%)',
  hevellyn: 'Hevellyn (100%)',
  casal: 'Casal (50/50)',
};

export const ROTULO_CURTO_RESPONSAVEL: Record<Responsavel, string> = {
  denilson: 'Denilson',
  hevellyn: 'Hevellyn',
  casal: 'Casal 50/50',
};

export const ROTULO_FORMA: Record<FormaPagamento, string> = {
  pix: 'PIX',
  boleto: 'Boleto',
  debito: 'Débito',
  dinheiro: 'Dinheiro',
  transferencia: 'Transferência',
  cartao: 'Cartão de crédito',
};
