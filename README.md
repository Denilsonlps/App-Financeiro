# Painel do Casal · Controle Financeiro

Web app de orçamento compartilhado (Denilson & Hevellyn) baseado na planilha original: cartões próprios e de terceiros, parcelamentos, rateio 50/50 ou 100%, contas recorrentes, acerto de contas e projeção de 12 meses. O ponto central é o **Smart Input**: você fala ou digita uma frase e o formulário já vem preenchido.

> “Paguei 123 reais em Livros de Filosofia no Nubank do Ramon parcelado em 4 vezes pro Denilson pagar”
> → **Valor** R$ 123,00 · **4x** de R$ 30,75 · **Cartão** Nubank (dono: Ramon) · **Responsável** Denilson 100% · **Categoria** Educação

## Como rodar localmente

Pré-requisito: **Node.js 20 ou mais recente** (`node -v`).

```bash
git clone https://github.com/denilsonlps/app-financeiro.git
cd app-financeiro
npm install
npm run dev          # abre em http://localhost:5173
```

Outros comandos:

| Comando             | O que faz                                          |
| ------------------- | -------------------------------------------------- |
| `npm test`          | Testes do motor financeiro e do parser (Vitest)    |
| `npm run typecheck` | Checagem de tipos TypeScript                       |
| `npm run build`     | Build de produção em `dist/`                       |
| `npm run preview`   | Serve o build em http://localhost:4173             |

O app abre com **dados de exemplo** (os cartões e pessoas da planilha). Em *Configurações* dá para começar do zero, exportar ou importar um backup em JSON.

**Ditado por voz:** usa a Web Speech API do navegador em pt-BR. Funciona no Chrome e no Edge (desktop e Android) e no Safari; precisa de internet e de permissão de microfone. Em `localhost` o microfone é liberado. Em produção o site precisa estar em HTTPS. No Firefox, digite a frase: o parser é o mesmo.

## Funcionalidades

- **Smart Input** (`Ctrl/⌘ + K` ou botão de microfone): voz ou texto livre em português, com os campos reconhecidos aparecendo em tempo real, preenchimento automático do formulário certo (cartão, PIX/boleto ou conta mensal) e avisos quando algo está ambíguo (ex.: “há 3 cartões Nubank, assumi o do Denilson”).
- **Cartões & donos**: cartões próprios e de terceiros (Pai, Irmão, Ramon…), com dia de fechamento e de vencimento e o **responsável padrão** pelo rateio, que já vem pré-selecionado ao lançar.
- **Motor de rateio**: Denilson 100%, Hevellyn 100% ou Casal 50/50, com prévia em tempo real da cota de cada um (no 50/50 o centavo ímpar fica com o Denilson).
- **Mês da fatura automático**: calculado pela data da compra e pelo fechamento do cartão. Dá para editar.
- **Painel do Casal**: faturas totais, gastos fixos, total geral, total pago, restante, cota de cada um, **acerto do casal** (quem transfere quanto para quem), **quanto pagar a cada dono de cartão** (com “marcar fatura paga”), **parcelas a vencer** com saldo devedor e **projeção de 12 meses**.
- **Contas recorrentes** com início e fim, pagas por PIX/boleto ou cobradas num cartão (nesse caso entram sozinhas na fatura).
- Dark mode, layout responsivo (barra inferior com microfone no celular) e persistência em LocalStorage.

## Arquitetura de dados

Valores sempre em **centavos** (inteiros), para o rateio nunca errar por ponto flutuante. Meses no formato `YYYY-MM`.

```
Pessoa (Usuarios_e_Terceiros)
  id, nome, tipo: casal | terceiro, integrante?: denilson | hevellyn, apelidos[]
     │ 1
     │ N
Cartao                                     ContaRecorrente (Contas_Recorrentes)
  id, nome, donoId → Pessoa,                 id, descricao, categoria, valor,
  diaFechamento, diaVencimento,              formaPagamento, cartaoId? → Cartao,
  responsavelPadrao, cor, apelidos[]         diaVencimento, responsavel, pagoPor,
     │ 1                                     inicio, fim | null, ativo
     │ N                                        │ 1
Compra (cabeçalho da compra parcelada)          │ N
  id, data, descricao, categoria,           PagamentoRecorrente
  cartaoId, valorTotal, parcelas,             contaId, mes, status, valorReal?
  responsavel, mesPrimeiraFatura
     │ 1
     │ N
Lancamento (Lancamentos: uma linha por parcela)    GastoAvulso (Gastos_Fixos_e_Variaveis)
  id, compraId, data, descricao, cartaoId,           id, data, mesReferencia, descricao,
  parcelaAtual, parcelasTotal, valorParcela,         categoria, valor, formaPagamento,
  mesFatura, responsavel,                            responsavel, pagoPor,
  cotaDenilson, cotaHevellyn, status                 cotaDenilson, cotaHevellyn, status
```

- Os tipos estão em [`src/types/index.ts`](src/types/index.ts).
- O schema equivalente para **Supabase/PostgreSQL** está em [`supabase/schema.sql`](supabase/schema.sql): tabelas, FKs, a função `ratear()`, as views `v_faturas` e `v_parcelas_a_vencer` e RLS.
- **Acerto do casal**: quando alguém paga algo que tem cota do outro (a fatura do próprio cartão, um PIX ou uma conta), o outro fica devendo essa cota. Faturas de terceiros não geram transferência entre o casal, porque cada um paga a sua parte direto ao dono.

## Estrutura de pastas

```
src/
├── types/index.ts                 # Modelo de dados
├── lib/
│   ├── finance.ts                 # Rateio, parcelas, mês da fatura, resumo, acerto, projeção
│   ├── smart-parser.ts            # NLP em pt-BR: frase → campos
│   ├── format.ts                  # Moeda BRL, datas, rótulos
│   ├── hooks.ts                   # Tema e Speech-to-Text (Web Speech API)
│   └── *.test.ts                  # Testes (Vitest)
├── store/
│   ├── store.ts                   # Store + persistência em LocalStorage
│   ├── actions.ts                 # Todas as mutações (salvar compra, pagar fatura…)
│   └── seed.ts                    # Pessoas, cartões e dados de exemplo
├── components/
│   ├── ui/                        # Componentes no padrão shadcn/ui
│   ├── shared/                    # Seletor de responsável, chips, seletor de mês…
│   └── layout/app-shell.tsx       # Sidebar, header e navegação mobile
└── features/
    ├── dashboard/                 # Painel do Casal
    ├── smart-input/               # Dialog de voz/texto + editor unificado
    ├── lancamentos/               # Compras no cartão
    ├── gastos/                    # PIX, boleto, débito
    ├── recorrentes/               # Contas mensais
    ├── cartoes/                   # Cartões e donos
    └── configuracoes/             # Backup e restauração
supabase/schema.sql                # Schema relacional para migrar ao Supabase
```

## Migrando para o Supabase

1. Crie um projeto em [supabase.com](https://supabase.com) e rode `supabase/schema.sql` no SQL Editor.
2. `npm i @supabase/supabase-js` e crie `.env` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
3. Toda escrita passa por `src/store/actions.ts` e toda leitura por `src/store/store.ts`. Basta trocar `carregar`/`salvar` (ou cada ação) por chamadas ao Supabase, convertendo camelCase ↔ snake_case e `YYYY-MM` ↔ `date` (dia 1). Os cálculos em `lib/finance.ts` não mudam.

## Smart Input: o que ele entende

| Exemplo                                    | Interpretação                                  |
| ------------------------------------------ | ---------------------------------------------- |
| `123 reais`, `R$ 45,90`, `3.899,90`, `2 mil reais`, `cento e vinte reais` | Valor |
| `em 4x`, `parcelado em 4 vezes`, `6x de 50` | Parcelas (no último caso, 50 é o valor da parcela) |
| `no Nubank do Ramon`, `no Itaú da Hevellyn`, `no cartão do pai` | Cartão e dono (usa nomes e apelidos cadastrados) |
| `pro Denilson pagar`, `Hevellyn paga`, `dividido`, `meio a meio`, `50/50` | Responsável |
| `no pix`, `boleto`, `débito`, `a Hevellyn pagou` | Gasto avulso e quem pagou |
| `todo mês`, `assinatura`, `mensal`         | Conta recorrente                               |
| `ontem`, `dia 15`, `12/10`                 | Data                                           |

O parser é baseado em regras e roda 100% no navegador: não precisa de chave de API e é instantâneo. Se quiser, dá para trocar `parseSmartInput` por uma chamada a um LLM mantendo o mesmo formato de retorno (`ResultadoParse`).
