/**
 * Store mínimo sobre useSyncExternalStore. Toda escrita passa por `setState`,
 * que chama a persistência ativa:
 * - modo local (padrão): LocalStorage deste navegador;
 * - modo nuvem: `sync.ts` troca a persistência para enviar ao Supabase.
 */
import { useSyncExternalStore } from 'react';
import type { AppState } from '@/types';
import { estadoDemo } from './seed';

const CHAVE_LOCAL = 'financeiro:estado:v1';

/** Estado salvo no navegador no modo local (null se não houver). */
export function lerEstadoLocal(): AppState | null {
  try {
    const bruto = localStorage.getItem(CHAVE_LOCAL);
    if (bruto) {
      const s = JSON.parse(bruto) as AppState;
      if (s.versao === 1) return s;
    }
  } catch {
    /* storage indisponível ou JSON corrompido */
  }
  return null;
}

function salvarLocal(s: AppState) {
  try {
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify(s));
  } catch {
    /* modo privado / cota cheia: o app segue funcionando em memória */
  }
}

let estado: AppState = (typeof window !== 'undefined' && lerEstadoLocal()) || estadoDemo();
let persistir: (s: AppState) => void = salvarLocal;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((fn) => fn());

export function getState(): AppState {
  return estado;
}

/** Alteração feita pelo usuário: atualiza a tela e persiste. */
export function setState(atualizar: (s: AppState) => AppState) {
  estado = atualizar(estado);
  persistir(estado);
  avisar();
}

/** Troca o estado inteiro sem disparar persistência (ex.: dados vindos da nuvem). */
export function substituirEstado(s: AppState) {
  estado = s;
  avisar();
}

export function definirPersistencia(fn: ((s: AppState) => void) | 'local') {
  persistir = fn === 'local' ? salvarLocal : fn;
}

export function subscribe(fn: () => void) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getState, getState);
}
