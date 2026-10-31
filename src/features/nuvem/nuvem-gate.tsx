import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import type { AppState } from '@/types';
import { supabase } from '@/lib/supabase';
import { substituirEstado } from '@/store/store';
import { estadoNulo } from '@/store/remote';
import { encerrarNuvem, iniciarNuvem, temPendencias } from '@/store/sync';
import { Button } from '@/components/ui/button';
import { NuvemContext, traduzirErro, type LarInfo } from './nuvem-context';
import { TelaCentral, TelaLogin, TelaNovaSenha } from './tela-auth';
import { TelaLar } from './tela-lar';

type Fase =
  | { tipo: 'carregando'; texto?: string }
  | { tipo: 'login' }
  | { tipo: 'novaSenha' }
  | { tipo: 'semLar'; email: string }
  | { tipo: 'pronto'; email: string; lar: LarInfo }
  | { tipo: 'erro'; mensagem: string };

const msg = (e: unknown) => traduzirErro(e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e));

/**
 * Sem Supabase configurado: renderiza o app no modo local, como antes.
 * Com Supabase: exige login e um lar antes de mostrar o app.
 */
export function NuvemGate({ children }: { children: React.ReactNode }) {
  if (!supabase) {
    return <NuvemContext.Provider value={{ modo: 'local', sair: async () => {}, novoCodigo: async () => {} }}>{children}</NuvemContext.Provider>;
  }
  return <GateNuvem>{children}</GateNuvem>;
}

function GateNuvem({ children }: { children: React.ReactNode }) {
  const db = supabase!;
  const [fase, setFase] = useState<Fase>({ tipo: 'carregando' });
  const usuarioAtual = useRef<string | null>(null);
  const recuperandoSenha = useRef(false);

  const abrirLar = useCallback(async (email: string, lar: LarInfo, estadoInicial?: AppState) => {
    setFase({ tipo: 'carregando', texto: estadoInicial ? 'Enviando seus dados para a nuvem…' : 'Carregando seus dados…' });
    try {
      await iniciarNuvem(lar.id, { estadoInicial });
      setFase({ tipo: 'pronto', email, lar });
    } catch (e) {
      // O que não subiu continua no cache deste aparelho; "Tentar de novo" retoma o envio
      encerrarNuvem({ limparCache: false });
      usuarioAtual.current = null;
      setFase({ tipo: 'erro', mensagem: msg(e) });
    }
  }, []);

  const resolverSessao = useCallback(
    async (session: Session | null) => {
      if (recuperandoSenha.current) return;
      if (!session) {
        usuarioAtual.current = null;
        encerrarNuvem({ limparCache: false });
        setFase({ tipo: 'login' });
        return;
      }
      if (usuarioAtual.current === session.user.id) return; // ex.: renovação de token
      usuarioAtual.current = session.user.id;
      const email = session.user.email ?? '';
      setFase({ tipo: 'carregando' });
      try {
        const { data, error } = await db.from('membros').select('lares(id, nome, codigo_convite)').eq('user_id', session.user.id).maybeSingle();
        if (error) throw error;
        const lar = (data?.lares ?? null) as unknown as { id: string; nome: string; codigo_convite: string } | null;
        if (!lar) setFase({ tipo: 'semLar', email });
        else await abrirLar(email, { id: lar.id, nome: lar.nome, codigoConvite: lar.codigo_convite });
      } catch (e) {
        usuarioAtual.current = null;
        setFase({ tipo: 'erro', mensagem: msg(e) });
      }
    },
    [db, abrirLar],
  );

  useEffect(() => {
    void db.auth.getSession().then(({ data }) => resolverSessao(data.session));
    const { data } = db.auth.onAuthStateChange((evento, session) => {
      if (evento === 'PASSWORD_RECOVERY') {
        recuperandoSenha.current = true;
        setFase({ tipo: 'novaSenha' });
        return;
      }
      // Recomendação do Supabase: não chamar o cliente dentro do callback
      setTimeout(() => void resolverSessao(session), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [db, resolverSessao]);

  const sair = useCallback(async () => {
    if (temPendencias() && !confirm('Há alterações que ainda não foram enviadas para a nuvem e serão perdidas. Sair mesmo assim?')) return;
    encerrarNuvem({ limparCache: true });
    substituirEstado(estadoNulo());
    usuarioAtual.current = null;
    await db.auth.signOut();
    setFase({ tipo: 'login' });
  }, [db]);

  const novoCodigo = useCallback(async () => {
    if (fase.tipo !== 'pronto') return;
    const { data, error } = await db.rpc('novo_codigo_convite', { p_lar: fase.lar.id });
    if (error) throw new Error(msg(error));
    setFase({ ...fase, lar: { ...fase.lar, codigoConvite: data as string } });
  }, [db, fase]);

  switch (fase.tipo) {
    case 'carregando':
      return (
        <TelaCentral>
          <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> {fase.texto ?? 'Conectando…'}
          </p>
        </TelaCentral>
      );
    case 'login':
      return <TelaLogin />;
    case 'novaSenha':
      return (
        <TelaNovaSenha
          onConcluir={async () => {
            recuperandoSenha.current = false;
            usuarioAtual.current = null;
            const { data } = await db.auth.getSession();
            await resolverSessao(data.session);
          }}
        />
      );
    case 'semLar':
      return (
        <TelaLar
          email={fase.email}
          onSair={() => void sair()}
          onPronto={(lar, estadoInicial) => abrirLar(fase.email, { id: lar.id, nome: lar.nome, codigoConvite: lar.codigo_convite }, estadoInicial)}
        />
      );
    case 'erro':
      return (
        <TelaCentral>
          <div className="grid gap-3 rounded-2xl border bg-card p-6 text-center shadow-sm">
            <p className="font-semibold">Não foi possível carregar os dados</p>
            <p className="text-sm text-muted-foreground">{fase.mensagem}</p>
            <div className="flex justify-center gap-2">
              <Button
                onClick={async () => {
                  const { data } = await db.auth.getSession();
                  await resolverSessao(data.session);
                }}
              >
                <RefreshCw /> Tentar de novo
              </Button>
              <Button variant="outline" onClick={() => void sair()}>
                Sair
              </Button>
            </div>
          </div>
        </TelaCentral>
      );
    case 'pronto':
      return <NuvemContext.Provider value={{ modo: 'nuvem', email: fase.email, lar: fase.lar, sair, novoCodigo }}>{children}</NuvemContext.Provider>;
  }
}
