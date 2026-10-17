/**
 * Store mínimo (sem dependências) sobre useSyncExternalStore, persistido em
 * LocalStorage. Toda escrita passa por `setState`, então trocar a persistência
 * por Supabase é questão de reimplementar `carregar`/`salvar` (ver README).
 */
import { useSyncExternalStore } from 'react';
import type { AppState } from '@/types';
import { estadoDemo } from './seed';

const CHAVE = 'financeiro:estado:v1';

function carregar(): AppState {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (bruto) {
      const s = JSON.parse(bruto) as AppState;
      if (s.versao === 1) return s;
    }
  } catch {
    /* storage indisponível ou JSON corrompido: cai no demo */
  }
  return estadoDemo();
}

function salvar(s: AppState) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(s));
  } catch {
    /* modo privado / cota cheia: o app segue funcionando em memória */
  }
}

let estado: AppState = typeof window === 'undefined' ? estadoDemo() : carregar();
const ouvintes = new Set<() => void>();

export function getState(): AppState {
  return estado;
}

export function setState(atualizar: (s: AppState) => AppState) {
  estado = atualizar(estado);
  salvar(estado);
  ouvintes.forEach((fn) => fn());
}

export function subscribe(fn: () => void) {
  ouvintes.add(fn);
  return () => ouvintes.delete(fn);
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getState, getState);
}
