import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Remove acentos e baixa a caixa, preservando o comprimento da string. */
export function normalizar(texto: string): string {
  let out = '';
  for (const ch of texto) out += ch.normalize('NFD')[0].toLowerCase();
  return out;
}
