import { describe, expect, it } from 'vitest';
import { converterNumerosPorExtenso, parseSmartInput } from './smart-parser';
import { CARTOES_PADRAO, CATEGORIAS_PADRAO, PESSOAS_PADRAO } from '@/store/seed';

const ctx = { pessoas: PESSOAS_PADRAO, cartoes: CARTOES_PADRAO, categorias: CATEGORIAS_PADRAO, hoje: new Date(2026, 9, 17) };
const parse = (t: string) => parseSmartInput(t, ctx);

describe('parseSmartInput', () => {
  it('frase de exemplo completa', () => {
    const r = parse('Paguei 123 reais em Livros de Filosofia no Nubank do Ramon parcelado em 4 vezes pro Denilson pagar');
    expect(r.tipo).toBe('cartao');
    expect(r.valorTotal).toBe(12300);
    expect(r.parcelas).toBe(4);
    expect(r.cartaoId).toBe('c-nu-ramon');
    expect(r.responsavel).toBe('denilson');
    expect(r.responsavelOrigem).toBe('explicito');
    expect(r.descricao).toBe('Livros de Filosofia');
    expect(r.categoria).toBe('Educação');
    expect(r.confianca).toBe(1);
  });

  it('R$ com centavos, 50/50 e cartão com acento', () => {
    const r = parse('Farmácia R$ 45,90 no Itaú da Hevellyn dividido');
    expect(r.valorTotal).toBe(4590);
    expect(r.cartaoId).toBe('c-itau-hev');
    expect(r.responsavel).toBe('casal');
    expect(r.descricao).toBe('Farmácia');
  });

  it('PIX vira gasto avulso e usa quem pagou', () => {
    const r = parse('Feira 80 reais no pix, a Hevellyn pagou, meio a meio');
    expect(r.tipo).toBe('avulso');
    expect(r.formaPagamento).toBe('pix');
    expect(r.pagoPor).toBe('hevellyn');
    expect(r.responsavel).toBe('casal');
    expect(r.descricao).toBe('Feira');
  });

  it('recorrente no cartão', () => {
    const r = parse('Assinatura Spotify 21,90 todo mês no Nubank do Denilson');
    expect(r.tipo).toBe('recorrente');
    expect(r.formaPagamento).toBe('cartao');
    expect(r.cartaoId).toBe('c-nu-den');
    expect(r.valorTotal).toBe(2190);
    expect(r.descricao).toBe('Spotify');
  });

  it('parcela informada ("6x de 50") e responsável padrão do cartão', () => {
    const r = parse('Comprei uma cadeira em 6x de 50 no BV do meu irmão');
    expect(r.valorTotal).toBe(30000);
    expect(r.parcelas).toBe(6);
    expect(r.cartaoId).toBe('c-bv-irmao');
    expect(r.responsavel).toBe('casal');
    expect(r.responsavelOrigem).toBe('padrao-cartao');
    expect(r.descricao).toBe('Cadeira');
  });

  it('números por extenso e data relativa', () => {
    const r = parse('ontem gastei cento e vinte reais de gasolina no inter');
    expect(r.valorTotal).toBe(12000);
    expect(r.data).toBe('2026-10-16');
    expect(r.cartaoId).toBe('c-inter-den');
    expect(r.categoria).toBe('Transporte');
  });

  it('cartão citado só pelo dono', () => {
    const r = parse('Tênis 300 reais no cartão do pai em 3x pra Hevellyn');
    expect(r.cartaoId).toBe('c-bb-pai');
    expect(r.responsavel).toBe('hevellyn');
    expect(r.parcelas).toBe(3);
  });

  it('cartão ambíguo gera aviso', () => {
    const r = parse('Uber 25 reais no Nubank');
    expect(r.cartaoId).toBe('c-nu-den');
    expect(r.avisos.join(' ')).toMatch(/Assumi/);
  });

  it('milhar', () => {
    expect(parse('Geladeira R$ 3.899,90 no BB do pai em 10x').valorTotal).toBe(389990);
    expect(parse('Sofá 2 mil reais no inter').valorTotal).toBe(200000);
  });
});

describe('converterNumerosPorExtenso', () => {
  it('converte com gatilho', () => {
    expect(converterNumerosPorExtenso('cento e vinte e três reais em quatro vezes')).toBe('123 reais em 4 vezes');
    expect(converterNumerosPorExtenso('dois mil e quinhentos reais')).toBe('2500 reais');
  });
  it('não mexe em artigos', () => {
    expect(converterNumerosPorExtenso('comprei um livro')).toBe('comprei um livro');
  });
});
