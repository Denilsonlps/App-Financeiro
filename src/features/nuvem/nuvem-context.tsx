import { createContext, useContext } from 'react';

export interface LarInfo {
  id: string;
  nome: string;
  codigoConvite: string;
}

export interface NuvemCtx {
  modo: 'local' | 'nuvem';
  email?: string;
  lar?: LarInfo;
  sair: () => Promise<void>;
  novoCodigo: () => Promise<void>;
}

export const NuvemContext = createContext<NuvemCtx>({ modo: 'local', sair: async () => {}, novoCodigo: async () => {} });
export const useNuvem = () => useContext(NuvemContext);

/** Traduz as mensagens de erro mais comuns do Supabase Auth/PostgREST. */
export function traduzirErro(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (m.includes('email not confirmed')) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'Este e-mail já tem conta. Use "Entrar".';
  if (m.includes('password should be at least')) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (m.includes('rate limit') || m.includes('security purposes')) return 'Muitas tentativas seguidas. Aguarde um minuto e tente de novo.';
  if (m.includes('failed to fetch') || m.includes('network')) return 'Sem conexão com o servidor. Verifique sua internet.';
  if (m.includes('unable to validate email') || m.includes('invalid format')) return 'E-mail inválido.';
  return msg;
}
