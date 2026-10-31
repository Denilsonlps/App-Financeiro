import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Cliente do Supabase, ou null quando as variáveis não estão configuradas (modo local). */
export const supabase: SupabaseClient | null = url && chave ? createClient(url, chave) : null;
