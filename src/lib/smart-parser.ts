/**
 * Smart Input: transforma uma frase em português (digitada ou ditada) nos
 * campos de um lançamento. Roda 100% local, por regras, e não depende de API.
 *
 *   "Paguei 123 reais em Livros de Filosofia no Nubank do Ramon parcelado
 *    em 4 vezes pro Denilson pagar"
 *   => valor 12300, parcelas 4, cartão Nubank (dono Ramon),
 *      responsável denilson, descrição "Livros de Filosofia"
 *
 * Estratégia: cada extrator procura seu padrão numa cópia normalizada do texto
 * (sem acento, minúscula, mesmo comprimento) e "consome" o trecho encontrado,
 * trocando-o por espaços. O que sobra, limpo de palavras de ligação, vira a
 * descrição. A ordem dos extratores importa: datas e parcelas saem antes do
 * valor para que "dia 15" ou "4 vezes" não sejam lidos como dinheiro.
 */
import { addDays, format, setDate, setMonth, subMonths } from 'date-fns';
import type {
  Cartao,
  Centavos,
  DataISO,
  FormaPagamento,
  Id,
  Integrante,
  Pessoa,
  Responsavel,
} from '@/types';
import { normalizar } from './utils';
import { parseMoeda } from './format';

export type TipoLancamento = 'cartao' | 'avulso' | 'recorrente';

export interface CampoDetectado {
  campo: string;
  valor: string;
  trecho: string;
}

export interface ResultadoParse {
  tipo: TipoLancamento;
  valorTotal?: Centavos;
  parcelas: number;
  descricao: string;
  categoria: string;
  data: DataISO;
  cartaoId?: Id;
  donoId?: Id;
  responsavel: Responsavel;
  responsavelOrigem: 'explicito' | 'padrao-cartao' | 'padrao';
  formaPagamento: FormaPagamento;
  pagoPor?: Integrante;
  /** 0..1 — quantos campos essenciais foram reconhecidos. */
  confianca: number;
  campos: CampoDetectado[];
  avisos: string[];
  /** Texto após conversão de números por extenso (o que o parser de fato leu). */
  textoInterpretado: string;
}

export interface ContextoParse {
  pessoas: Pessoa[];
  cartoes: Cartao[];
  categorias: string[];
  hoje?: Date;
}

// ------------------------------------------------------------------ Números por extenso

const UNIDADES: Record<string, number> = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9,
  dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17,
  dezoito: 18, dezenove: 19, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70,
  oitenta: 80, noventa: 90, cem: 100, cento: 100, duzentos: 200, duzentas: 200, trezentos: 300, trezentas: 300,
  quatrocentos: 400, quinhentos: 500, seiscentos: 600, setecentos: 700, oitocentos: 800, novecentos: 900,
};
const GATILHOS_NUMERO = /^(reais|real|vezes|vez|x|parcelas?|prestacoes|prestacao|contos?|pilas?|centavos|mil)$/;

/** "cento e vinte e três reais" => "123 reais". Só converte quando há contexto numérico claro. */
export function converterNumerosPorExtenso(texto: string): string {
  const tokens = texto.split(/(\s+)/);
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const n = normalizar(tokens[i]).replace(/[^a-z]/g, '');
    // "mil" logo após dígitos ("2 mil") é tratado pelo extrator de valor
    const aposDigito = n === 'mil' && /\d$/.test(out.join('').trimEnd());
    if ((!(n in UNIDADES) && n !== 'mil') || aposDigito) {
      out.push(tokens[i++]);
      continue;
    }
    // Coleta a sequência: palavra (espaço "e" espaço palavra)*
    let j = i;
    let total = 0;
    let atual = 0;
    let palavras = 0;
    let fim = i;
    while (j < tokens.length) {
      const w = normalizar(tokens[j]).replace(/[^a-z]/g, '');
      if (w === 'mil') {
        total += (atual || 1) * 1000;
        atual = 0;
      } else if (w in UNIDADES) {
        atual += UNIDADES[w];
      } else break;
      palavras++;
      fim = j;
      // pula espaço, "e", espaço se o próximo for número
      const prox = normalizar(tokens[j + 2] ?? '').replace(/[^a-z]/g, '');
      const depois = normalizar(tokens[j + 4] ?? '').replace(/[^a-z]/g, '');
      if (prox === 'e' && (depois in UNIDADES || depois === 'mil')) j += 4;
      else if (prox in UNIDADES || prox === 'mil') j += 2;
      else break;
    }
    const valor = total + atual;
    const seguinte = normalizar(tokens[fim + 2] ?? '').replace(/[^a-z]/g, '');
    const ultimaPalavra = normalizar(tokens[fim]).replace(/[^a-z]/g, '');
    if (GATILHOS_NUMERO.test(seguinte) || palavras > 1 || ultimaPalavra === 'mil') {
      out.push(String(valor));
      i = fim + 1;
    } else {
      out.push(tokens[i++]);
    }
  }
  return out.join('');
}

// ------------------------------------------------------------------ Utilidades

const NUM = String.raw`\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?`;

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const alternativas = (xs: string[]) =>
  [...new Set(xs.map(normalizar).filter(Boolean))].sort((a, b) => b.length - a.length).map(escapar).join('|');

const MESES: Record<string, number> = {
  janeiro: 0, fevereiro: 1, marco: 2, abril: 3, maio: 4, junho: 5, julho: 6, agosto: 7, setembro: 8,
  outubro: 9, novembro: 10, dezembro: 11,
};

const CATEGORIA_POR_PALAVRA: [RegExp, string][] = [
  [/\b(livros?|curso|faculdade|escola|apostila|udemy|alura|mensalidade escolar|material escolar)\b/, 'Educação'],
  [/\b(mercado|supermercado|feira|atacadao|assai|carrefour|hortifruti|acougue|padaria)\b/, 'Mercado'],
  [/\b(ifood|restaurante|lanche|pizza|hamburguer|almoco|jantar|cafe|rappi|delivery|sushi|acai)\b/, 'Alimentação'],
  [/\b(uber|99|gasolina|combustivel|onibus|metro|estacionamento|pedagio|oficina|mecanico|ipva|posto)\b/, 'Transporte'],
  [/\b(farmacia|remedio|medico|consulta|exame|dentista|hospital|plano de saude|academia|drogaria)\b/, 'Saúde'],
  [/\b(netflix|spotify|claude|chatgpt|amazon prime|prime video|disney|hbo|max|youtube premium|icloud|assinatura|globoplay)\b/, 'Assinaturas'],
  [/\b(aluguel|condominio|iptu)\b/, 'Moradia'],
  [/\b(luz|energia|agua|internet|fibra|gas|telefone|celular|conta de)\b/, 'Contas de Casa'],
  [/\b(cinema|show|viagem|passagens?|hotel|bar|cerveja|ingresso|jogo|steam|playstation|lazer|passeio)\b/, 'Lazer'],
  [/\b(roupas?|tenis|camisas?|camisetas?|calcas?|sapatos?|vestido|blusa|renner|riachuelo|shein|cea|zara)\b/, 'Vestuário'],
  [/\b(movel|moveis|sofa|geladeira|fogao|cama|colchao|decoracao|panelas?|eletrodomestico|mesa)\b/, 'Casa e Decoração'],
  [/\b(racao|veterinario|pet|petshop|cachorro|gato)\b/, 'Pets'],
  [/\b(presente|aniversario|lembrancinha)\b/, 'Presentes'],
  [/\b(notebook|celular novo|iphone|fone|monitor|teclado|mouse|computador|tablet|eletronicos?|tv|televisao)\b/, 'Eletrônicos'],
];

const PALAVRAS_DE_LIGACAO = new Set([
  'paguei', 'pagamos', 'pago', 'comprei', 'compramos', 'gastei', 'gastamos', 'gasto', 'foi', 'foram', 'lanca',
  'lancar', 'lance', 'anota', 'anotar', 'registra', 'registrar', 'coloca', 'colocar', 'bota', 'botar', 'adiciona',
  'adicionar', 'uma', 'compra', 'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas', 'com', 'o', 'a',
  'os', 'as', 'um', 'e', 'pro', 'pra', 'para', 'pelo', 'pela', 'por', 'que', 'eu', 'ai', 'hoje', 'ontem',
  'cartao', 'reais', 'real', 'valor', 'total', 'conta', 'pagar', 'vai', 'via', 'usando', 'credito', 'ficou',
  'custou', 'parcelado', 'parcelada', 'mensal', 'todo', 'mes', 'cada', 'tambem',
]);

// ------------------------------------------------------------------ Parser

export function parseSmartInput(textoBruto: string, ctx: ContextoParse): ResultadoParse {
  const hoje = ctx.hoje ?? new Date();
  const texto = converterNumerosPorExtenso(textoBruto.trim());
  const original = texto;
  let w = normalizar(texto);
  const campos: CampoDetectado[] = [];
  const avisos: string[] = [];

  /** Procura `re` no texto ainda não consumido; consome e devolve o match. */
  const consumir = (re: RegExp, campo?: string, rotulo?: (m: RegExpExecArray) => string) => {
    const m = new RegExp(re.source, re.flags.replace('g', '')).exec(w);
    if (!m) return null;
    w = w.slice(0, m.index) + ' '.repeat(m[0].length) + w.slice(m.index + m[0].length);
    if (campo) campos.push({ campo, valor: rotulo ? rotulo(m) : m[0].trim(), trecho: original.substr(m.index, m[0].length).trim() });
    return m;
  };

  // ---------------- Tipo: recorrente?
  let tipo: TipoLancamento = 'cartao';
  if (consumir(/\b(todo(s)? (o )?(mes|meses)|mensal(mente)?|assinatura|recorrente|por mes|ao mes)\b/, 'Recorrência', () => 'Conta mensal')) {
    tipo = 'recorrente';
  }

  // ---------------- Data
  let data: Date = hoje;
  let m: RegExpExecArray | null;
  if ((m = consumir(/\b(anteontem|antes de ontem)\b/))) data = addDays(hoje, -2);
  else if ((m = consumir(/\bontem\b/))) data = addDays(hoje, -1);
  else if ((m = consumir(/\bhoje\b/))) data = hoje;
  else if ((m = consumir(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/))) {
    const ano = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : hoje.getFullYear();
    data = new Date(ano, +m[2] - 1, +m[1]);
  } else if ((m = consumir(new RegExp(String.raw`\b(?:no |em )?dia (\d{1,2})(?: de (${Object.keys(MESES).join('|')}))?\b`)))) {
    let d = setDate(hoje, +m[1]);
    if (m[2]) d = setMonth(d, MESES[m[2]]);
    else if (d > hoje) d = subMonths(d, 1); // "dia 28" dito no dia 10 = mês passado
    data = d;
  }
  const dataISO = format(data, 'yyyy-MM-dd');
  if (m) campos.push({ campo: 'Data', valor: format(data, 'dd/MM/yyyy'), trecho: m[0].trim() });

  // ---------------- Parcelas
  let parcelas = 1;
  let valorParcela: Centavos | undefined;
  m = consumir(
    new RegExp(String.raw`\b(?:(?:parcelad[oa]s?|dividid[oa]s?)\s+)?(?:em\s+)?(\d{1,2})\s*(?:x|vezes|parcelas|prestacoes)(?:\s+(?:de|no valor de)\s+(?:r\$\s*)?(${NUM})(?:\s*reais)?)?`),
  );
  if (m) {
    parcelas = Math.max(1, Math.min(72, +m[1]));
    if (m[2]) valorParcela = parseMoeda(m[2]);
    campos.push({ campo: 'Parcelas', valor: parcelas === 1 ? 'À vista' : `${parcelas}x`, trecho: m[0].trim() });
  } else if (consumir(/\b(a vista|avista|uma vez so|sem parcelar)\b/, 'Parcelas', () => 'À vista')) {
    parcelas = 1;
  }

  // ---------------- Valor
  let valorTotal: Centavos | undefined;
  const padroesValor: RegExp[] = [
    new RegExp(String.raw`r\$\s*(${NUM})(\s*mil)?`),
    new RegExp(String.raw`\b(${NUM})(\s*mil)?\s*(?:reais|real|contos?|pilas?|mangos?|conto)(?:\s+e\s+(\d{1,2})\s+centavos)?`),
    new RegExp(String.raw`\b(?:paguei|gastei|gastamos|pagamos|custou|por|valor de|valor|total de|de)\s+(${NUM})(\s*mil)?\b(?!\s*(?:x|vezes|parcelas|\/))`),
    new RegExp(String.raw`\b(${NUM})(\s*mil)?\b(?!\s*(?:x|vezes|parcelas|\/))`),
  ];
  for (const re of padroesValor) {
    const mv = consumir(re);
    if (!mv) continue;
    let v = parseMoeda(mv[1]);
    if (mv[2]) v *= 1000;
    if (mv[3]) v += +mv[3];
    if (Number.isFinite(v) && v > 0) {
      valorTotal = v;
      // Se o trecho era só "de 123", devolve o "de" à descrição não importa: é palavra de ligação
      campos.push({ campo: 'Valor', valor: formatarBRL(v), trecho: mv[0].trim() });
      break;
    }
  }
  if (valorParcela && parcelas > 1) {
    // "4x de 30" => o valor citado é da parcela
    if (!valorTotal) {
      valorTotal = valorParcela * parcelas;
      campos.push({ campo: 'Valor', valor: `${formatarBRL(valorTotal)} (${parcelas}x ${formatarBRL(valorParcela)})`, trecho: '' });
    }
  }

  // ---------------- Forma de pagamento (fora do cartão)
  let formaPagamento: FormaPagamento = 'cartao';
  const formas: [RegExp, FormaPagamento, string][] = [
    [/\b(?:no |via |pelo |por |com )?pix\b/, 'pix', 'PIX'],
    [/\b(?:no |via |pelo |por |com )?boleto\b/, 'boleto', 'Boleto'],
    [/\b(?:no |via |pelo |com )?(?:cartao de )?debito\b/, 'debito', 'Débito'],
    [/\b(?:em |no |com )?(?:dinheiro|especie|cash)\b/, 'dinheiro', 'Dinheiro'],
    [/\b(?:via |por |com )?(?:transferencia|ted|doc)\b/, 'transferencia', 'Transferência'],
  ];
  for (const [re, forma, rotulo] of formas) {
    if (consumir(re, 'Forma de pagamento', () => rotulo)) {
      formaPagamento = forma;
      if (tipo === 'cartao') tipo = 'avulso';
      break;
    }
  }

  // ---------------- Cartão e dono
  const pessoasRe = ctx.pessoas.map((p) => ({ p, re: alternativas([p.nome, ...(p.apelidos ?? [])]) }));
  const qualquerPessoa = alternativas(ctx.pessoas.flatMap((p) => [p.nome, ...(p.apelidos ?? [])]));
  const acharPessoa = (trecho: string) => pessoasRe.find(({ re }) => new RegExp(`^(?:${re})$`).test(trecho.trim()))?.p;

  let cartao: Cartao | undefined;
  let dono: Pessoa | undefined;
  const ativos = ctx.cartoes.filter((c) => c.ativo);
  const nomesCartao = alternativas(ativos.flatMap((c) => [c.nome, ...(c.apelidos ?? [])]));
  const prefixoCartao = String.raw`(?:\b(?:no|na|pelo|pela|com o|com a|usando o|usando a|em)\s+)?(?:cartao\s+(?:de credito\s+)?(?:do\s+|da\s+)?)?`;

  if (nomesCartao) {
    m = consumir(
      new RegExp(String.raw`${prefixoCartao}\b(${nomesCartao})\b(?:\s+(?:do|da|de)\s+(?:meu\s+|minha\s+|o\s+|a\s+)?(${qualquerPessoa}))?`),
    );
    if (m) {
      const nomeDito = m[1];
      const candidatos = ativos.filter((c) => [c.nome, ...(c.apelidos ?? [])].map(normalizar).includes(nomeDito));
      if (m[2]) dono = acharPessoa(m[2]);
      cartao = (dono && candidatos.find((c) => c.donoId === dono!.id)) || undefined;
      if (!cartao) {
        if (dono) avisos.push(`${dono.nome} não tem cartão "${nomeDito}" cadastrado.`);
        // Sem dono explícito: prefere cartão do casal
        const doCasal = candidatos.filter((c) => ctx.pessoas.find((p) => p.id === c.donoId)?.tipo === 'casal');
        cartao = doCasal[0] ?? candidatos[0];
        if (!dono && candidatos.length > 1) {
          const nomeDono = ctx.pessoas.find((p) => p.id === cartao!.donoId)?.nome;
          avisos.push(`Há ${candidatos.length} cartões "${cartao.nome}". Assumi o de ${nomeDono} — confira.`);
        }
        dono = ctx.pessoas.find((p) => p.id === cartao!.donoId);
      }
    }
  }
  if (!cartao) {
    // "no cartão do Pai" (sem citar o banco)
    m = consumir(new RegExp(String.raw`\bcartao\s+(?:de credito\s+)?(?:do|da)\s+(?:meu\s+|minha\s+)?(${qualquerPessoa})\b`));
    if (m) {
      dono = acharPessoa(m[1]);
      const doDono = ativos.filter((c) => c.donoId === dono?.id);
      cartao = doDono[0];
      if (doDono.length > 1) avisos.push(`${dono?.nome} tem ${doDono.length} cartões. Assumi ${cartao.nome} — confira.`);
      if (!cartao) avisos.push(`${dono?.nome} não tem cartão cadastrado.`);
    }
  }
  if (cartao) {
    const nomeDono = ctx.pessoas.find((p) => p.id === cartao!.donoId)?.nome ?? '?';
    campos.push({ campo: 'Cartão', valor: `${cartao.nome} · ${nomeDono}`, trecho: m?.[0].trim() ?? '' });
    if (tipo === 'avulso') tipo = 'cartao';
    if (tipo === 'recorrente') formaPagamento = 'cartao';
  }

  // ---------------- Responsável pelo rateio
  const casal = ctx.pessoas.filter((p) => p.integrante);
  const integranteRe = alternativas(casal.flatMap((p) => [p.nome, ...(p.apelidos ?? [])]));
  const integranteDe = (trecho: string) => acharPessoa(trecho)?.integrante;
  let responsavel: Responsavel | undefined;
  let pagoPor: Integrante | undefined;

  // Quem pagou do bolso (para PIX/boleto): "a Hevellyn pagou"
  if (integranteRe && (m = consumir(new RegExp(String.raw`\b(?:o |a )?(${integranteRe})\s+(?:que\s+)?(?:pagou|transferiu|passou)\b`)))) {
    pagoPor = integranteDe(m[1]);
  }

  if (consumir(/\b(?:pr[oa]s?|para|pra)?\s*(?:o\s+)?(?:casal|nos dois|a gente|os dois|ambos)\b(?:\s+pagar(?:em)?)?|\b(?:meio a meio|50\s*\/\s*50|50 por cento|rachad[oa]|rachar|dividid[oa](?! em \d)|dividir(?! em \d)|metade cada)\b/, 'Responsável', () => 'Casal (50/50)')) {
    responsavel = 'casal';
  } else if (
    integranteRe &&
    (m =
      consumir(new RegExp(String.raw`\b(?:pr[oa]|para(?: [oa])?|pra|p\/)\s+(?:o |a )?(${integranteRe})\b(?:\s+(?:pagar|paga|assumir|bancar))?`)) ??
      consumir(new RegExp(String.raw`\b(?:o |a )?(${integranteRe})\s+(?:vai\s+)?(?:paga|pagar|assume|assumir|banca|bancar)\b`)) ??
      consumir(new RegExp(String.raw`\b(?:conta|cota|responsavel|por conta)\s*(?:d[oa]|:)?\s*(${integranteRe})\b`)) ??
      consumir(new RegExp(String.raw`\b(${integranteRe})\b`)))
  ) {
    responsavel = integranteDe(m[1]);
    if (responsavel) campos.push({ campo: 'Responsável', valor: responsavel === 'denilson' ? 'Denilson (100%)' : 'Hevellyn (100%)', trecho: m[0].trim() });
  }

  let responsavelOrigem: ResultadoParse['responsavelOrigem'] = 'explicito';
  if (!responsavel) {
    if (cartao) {
      responsavel = cartao.responsavelPadrao;
      responsavelOrigem = 'padrao-cartao';
    } else {
      responsavel = 'casal';
      responsavelOrigem = 'padrao';
    }
  }
  if (!pagoPor) pagoPor = responsavel === 'casal' ? undefined : responsavel;

  // ---------------- Descrição
  let descricao = '';
  {
    const restos: string[] = [];
    let atual = '';
    for (let i = 0; i < original.length; i++) {
      if (w[i] === ' ' && original[i].trim() !== '') {
        if (atual.trim()) restos.push(atual);
        atual = '';
      } else atual += original[i];
    }
    if (atual.trim()) restos.push(atual);
    const palavras = restos.join(' ').replace(/[,;.!?]+/g, ' ').split(/\s+/).filter(Boolean);
    while (palavras.length && PALAVRAS_DE_LIGACAO.has(normalizar(palavras[0]))) palavras.shift();
    while (palavras.length && PALAVRAS_DE_LIGACAO.has(normalizar(palavras[palavras.length - 1]))) palavras.pop();
    descricao = palavras.filter((p, i) => !(i > 0 && normalizar(p) === normalizar(palavras[i - 1]))).join(' ');
    if (descricao) descricao = descricao.charAt(0).toUpperCase() + descricao.slice(1);
  }
  if (descricao) campos.push({ campo: 'Descrição', valor: descricao, trecho: descricao });

  // ---------------- Categoria
  const base = normalizar(descricao || textoBruto);
  let categoria = 'Outros';
  for (const [re, cat] of CATEGORIA_POR_PALAVRA) {
    if (re.test(base)) {
      categoria = cat;
      break;
    }
  }
  if (!ctx.categorias.includes(categoria)) categoria = ctx.categorias.includes('Outros') ? 'Outros' : ctx.categorias[0] ?? 'Outros';
  campos.push({ campo: 'Categoria', valor: categoria, trecho: '' });

  // ---------------- Confiança e avisos finais
  if (!valorTotal) avisos.push('Não encontrei o valor. Ex.: "123 reais" ou "R$ 45,90".');
  if (tipo === 'cartao' && !cartao) avisos.push('Não identifiquei o cartão. Diga, por exemplo, "no Nubank do Ramon" ou "no PIX".');
  if (!descricao) avisos.push('Não consegui extrair uma descrição.');
  const pontos = [!!valorTotal, tipo !== 'cartao' || !!cartao, !!descricao, responsavelOrigem === 'explicito'];
  const confianca = pontos.filter(Boolean).length / pontos.length;

  return {
    tipo,
    valorTotal,
    parcelas,
    descricao,
    categoria,
    data: dataISO,
    cartaoId: cartao?.id,
    donoId: dono?.id ?? cartao?.donoId,
    responsavel,
    responsavelOrigem,
    formaPagamento,
    pagoPor,
    confianca,
    campos,
    avisos,
    textoInterpretado: texto,
  };
}

function formatarBRL(c: Centavos) {
  return (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
