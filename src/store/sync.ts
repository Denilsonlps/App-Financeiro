/**
 * Sincronização com o Supabase.
 *
 * - Leitura: carrega todas as tabelas do lar e monta o AppState.
 * - Escrita: a cada alteração local, calcula a diferença entre o último estado
 *   confirmado pelo servidor e o atual, e envia só isso (debounce de 300 ms).
 *   Se falhar (sem internet), tenta de novo depois; nada se perde porque o
 *   estado e o "confirmado" ficam guardados no navegador.
 * - Outros aparelhos: Realtime avisa que algo mudou e o app recarrega.
 */
import { useSyncExternalStore } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { AppState } from '@/types';
import { supabase } from '@/lib/supabase';
import { definirPersistencia, getState, substituirEstado } from './store';
import { diferenca, diferencaVazia, estadoNulo, montarEstado, TABELAS, type Diferenca, type Linha } from './remote';

export type StatusSync = 'local' | 'carregando' | 'sincronizado' | 'enviando' | 'offline' | 'erro';

// ------------------------------------------------------------ Status observável

let status: StatusSync = 'local';
let ultimoErro: string | null = null;
const ouvintes = new Set<() => void>();
function definirStatus(s: StatusSync, erro: string | null = null) {
  status = s;
  ultimoErro = erro;
  ouvintes.forEach((fn) => fn());
}
const lerStatus = () => status;

export function useStatusSync(): { status: StatusSync; erro: string | null } {
  const s = useSyncExternalStore(
    (fn) => {
      ouvintes.add(fn);
      return () => ouvintes.delete(fn);
    },
    lerStatus,
  );
  return { status: s, erro: ultimoErro };
}

// ------------------------------------------------------------ Estado interno

let larId: string | null = null;
let confirmado: AppState = estadoNulo(); // último estado que o servidor tem
let enviando = false;
let reenviar = false;
let recarregarDepois = false;
let timerEnvio: ReturnType<typeof setTimeout> | undefined;
let timerRecarga: ReturnType<typeof setTimeout> | undefined;
let tentativas = 0;
let canal: RealtimeChannel | null = null;
let removerOuvintes: (() => void) | null = null;

const chaveCache = (lar: string) => `financeiro:nuvem:${lar}`;

function salvarCache() {
  if (!larId) return;
  try {
    localStorage.setItem(chaveCache(larId), JSON.stringify({ estado: getState(), confirmado }));
  } catch {
    /* sem espaço: segue sem cache offline */
  }
}

function lerCache(lar: string): { estado: AppState; confirmado: AppState } | null {
  try {
    const bruto = localStorage.getItem(chaveCache(lar));
    return bruto ? JSON.parse(bruto) : null;
  } catch {
    return null;
  }
}

function cliente() {
  if (!supabase) throw new Error('Supabase não configurado.');
  return supabase;
}

const mensagem = (e: unknown) => (e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e));

// ------------------------------------------------------------ Leitura

const PAGINA = 1000; // limite padrão de linhas por requisição no Supabase

export async function carregarRemoto(lar: string): Promise<AppState> {
  const db = cliente();
  const linhas: Record<string, Linha[]> = {};
  await Promise.all(
    TABELAS.map(async (t) => {
      const todas: Linha[] = [];
      for (let de = 0; ; de += PAGINA) {
        const { data, error } = await db
          .from(t.nome)
          .select('*')
          .eq('lar_id', lar)
          .order(t.chave[0])
          .range(de, de + PAGINA - 1);
        if (error) throw error;
        todas.push(...(data as Linha[]));
        if (!data || data.length < PAGINA) break;
      }
      linhas[t.nome] = todas;
    }),
  );
  return montarEstado(linhas);
}

// ------------------------------------------------------------ Escrita

const LOTE = 500;
const lotes = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

async function aplicar(lar: string, d: Diferenca) {
  const db = cliente();
  // Apaga primeiro (dependentes antes), depois grava (referenciados antes).
  // A ordem evita conflitos como "parcela 2/3 já existe" ao editar uma compra.
  for (const t of [...TABELAS].reverse()) {
    const chaves = d.deletes[t.nome];
    if (!chaves?.length) continue;
    if (t.chave.length === 1) {
      const col = t.chave[0];
      for (const lote of lotes(chaves.map((c) => c[col] as string), 100)) {
        const { error } = await db.from(t.nome).delete().eq('lar_id', lar).in(col, lote);
        if (error) throw error;
      }
    } else {
      for (const c of chaves) {
        const { error } = await db.from(t.nome).delete().match({ lar_id: lar, ...c });
        if (error) throw error;
      }
    }
  }
  for (const t of TABELAS) {
    const linhas = d.upserts[t.nome];
    if (!linhas?.length) continue;
    for (const lote of lotes(linhas, LOTE)) {
      const { error } = await db
        .from(t.nome)
        .upsert(
          lote.map((l) => ({ ...l, lar_id: lar })),
          { onConflict: ['lar_id', ...t.chave].join(',') },
        );
      if (error) throw error;
    }
  }
}

function agendarEnvio(ms = 300) {
  clearTimeout(timerEnvio);
  timerEnvio = setTimeout(() => void enviar(), ms);
}

/** Envia ao servidor tudo que difere do último estado confirmado. */
export async function enviar(): Promise<void> {
  if (!larId) return;
  if (enviando) {
    reenviar = true;
    return;
  }
  const alvo = getState();
  const d = diferenca(confirmado, alvo);
  if (diferencaVazia(d)) {
    definirStatus('sincronizado');
    if (recarregarDepois) void recarregar();
    return;
  }
  enviando = true;
  definirStatus('enviando');
  try {
    await aplicar(larId, d);
    confirmado = alvo;
    tentativas = 0;
    salvarCache();
    definirStatus('sincronizado');
  } catch (e) {
    tentativas++;
    const offline = typeof navigator !== 'undefined' && !navigator.onLine;
    definirStatus(offline ? 'offline' : 'erro', offline ? null : mensagem(e));
    // Nova tentativa com espera crescente (2s, 4s, 8s... até 60s)
    agendarEnvio(Math.min(60_000, 1000 * 2 ** tentativas));
    return;
  } finally {
    enviando = false;
  }
  if (reenviar || getState() !== alvo) {
    reenviar = false;
    agendarEnvio(0);
  } else if (recarregarDepois) {
    void recarregar();
  }
}

/** Busca o estado do servidor. Se houver alterações locais pendentes, envia antes. */
export async function recarregar(): Promise<void> {
  if (!larId) return;
  if (enviando || !diferencaVazia(diferenca(confirmado, getState()))) {
    recarregarDepois = true;
    agendarEnvio(0);
    return;
  }
  recarregarDepois = false;
  const antes = getState();
  const remoto = await carregarRemoto(larId);
  if (getState() !== antes) {
    // O usuário mexeu durante o download: envia primeiro, recarrega depois
    recarregarDepois = true;
    agendarEnvio(0);
    return;
  }
  confirmado = remoto;
  substituirEstado(remoto);
  salvarCache();
  definirStatus('sincronizado');
}

function agendarRecarga(ms = 500) {
  clearTimeout(timerRecarga);
  timerRecarga = setTimeout(() => void recarregar().catch((e) => definirStatus(navigator.onLine ? 'erro' : 'offline', mensagem(e))), ms);
}

// ------------------------------------------------------------ Ciclo de vida

/**
 * Liga o modo nuvem para um lar. Com `estadoInicial`, sobe esses dados para
 * um lar recém-criado; sem ele, baixa o que está no servidor (usando o cache
 * local para abrir instantaneamente e funcionar offline).
 */
export async function iniciarNuvem(lar: string, opts: { estadoInicial?: AppState } = {}) {
  encerrarNuvem({ limparCache: false });
  larId = lar;
  definirStatus('carregando');
  definirPersistencia(() => {
    salvarCache();
    agendarEnvio();
  });

  if (opts.estadoInicial) {
    confirmado = estadoNulo();
    substituirEstado(opts.estadoInicial);
    salvarCache();
    await enviar();
    if (status === 'erro') throw new Error(ultimoErro ?? 'Falha ao enviar os dados.');
  } else {
    const cache = lerCache(lar);
    if (cache) {
      confirmado = cache.confirmado;
      substituirEstado(cache.estado);
      agendarRecarga(0); // atualiza em segundo plano
    } else {
      const remoto = await carregarRemoto(lar);
      confirmado = remoto;
      substituirEstado(remoto);
      salvarCache();
      definirStatus('sincronizado');
    }
  }

  // Avisos de outros aparelhos
  const db = cliente();
  canal = db
    .channel(`lar-${lar}`)
    .on('postgres_changes', { event: '*', schema: 'public' }, () => agendarRecarga())
    .subscribe();

  const aoVoltar = () => document.visibilityState === 'visible' && agendarRecarga(0);
  const aoReconectar = () => {
    tentativas = 0;
    agendarEnvio(0);
    agendarRecarga(1000);
  };
  const aoSairOffline = () => definirStatus('offline');
  document.addEventListener('visibilitychange', aoVoltar);
  window.addEventListener('online', aoReconectar);
  window.addEventListener('offline', aoSairOffline);
  removerOuvintes = () => {
    document.removeEventListener('visibilitychange', aoVoltar);
    window.removeEventListener('online', aoReconectar);
    window.removeEventListener('offline', aoSairOffline);
  };
}

export function encerrarNuvem({ limparCache }: { limparCache: boolean }) {
  clearTimeout(timerEnvio);
  clearTimeout(timerRecarga);
  if (canal) void supabase?.removeChannel(canal);
  canal = null;
  removerOuvintes?.();
  removerOuvintes = null;
  if (larId && limparCache) {
    try {
      localStorage.removeItem(chaveCache(larId));
    } catch {
      /* ignore */
    }
  }
  larId = null;
  enviando = reenviar = recarregarDepois = false;
  tentativas = 0;
  definirPersistencia('local');
  definirStatus('local');
}

/** Há alterações feitas neste aparelho que ainda não chegaram ao servidor? */
export function temPendencias(): boolean {
  return !!larId && !diferencaVazia(diferenca(confirmado, getState()));
}

/** Joga fora o que não foi enviado e baixa de novo do servidor. */
export async function descartarPendencias() {
  if (!larId) return;
  substituirEstado(confirmado);
  salvarCache();
  await recarregar();
}
