import { useState } from 'react';
import { KeyRound, Loader2, Mail, Wallet } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Segmented } from '@/components/ui/segmented';
import { traduzirErro } from './nuvem-context';

/** Moldura centralizada usada nas telas antes do app (login, lar, carregando). */
export function TelaCentral({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-gradient-to-b from-primary/10 to-background p-4">
      <div className="grid w-full max-w-md gap-6">
        <div className="flex items-center justify-center gap-2">
          <div className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow">
            <Wallet className="size-5" />
          </div>
          <div className="leading-tight">
            <p className="font-bold">Painel do Casal</p>
            <p className="text-xs text-muted-foreground">Denilson & Hevellyn</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

type Modo = 'entrar' | 'criar' | 'esqueci';

export function TelaLogin() {
  const [modo, setModo] = useState<Modo>('entrar');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setErro(null);
    setAviso(null);
    setCarregando(true);
    try {
      if (modo === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
      } else if (modo === 'criar') {
        const { data, error } = await supabase.auth.signUp({ email, password: senha, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        if (!data.session) setAviso(`Enviamos um link de confirmação para ${email}. Abra o e-mail, confirme e depois entre aqui.`);
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
        if (error) throw error;
        setAviso(`Se existir uma conta com ${email}, você vai receber um link para criar uma nova senha.`);
      }
    } catch (err) {
      setErro(traduzirErro(err instanceof Error ? err.message : String(err)));
    } finally {
      setCarregando(false);
    }
  }

  return (
    <TelaCentral>
      <form onSubmit={enviar} className="grid gap-4 rounded-2xl border bg-card p-6 shadow-sm">
        {modo !== 'esqueci' ? (
          <Segmented
            value={modo}
            onChange={(m) => {
              setModo(m);
              setErro(null);
              setAviso(null);
            }}
            options={[
              { value: 'entrar', label: 'Entrar' },
              { value: 'criar', label: 'Criar conta' },
            ]}
          />
        ) : (
          <div>
            <p className="font-semibold">Recuperar senha</p>
            <p className="text-sm text-muted-foreground">Enviaremos um link para você criar uma nova senha.</p>
          </div>
        )}
        <Field label="E-mail" htmlFor="au-email">
          <Input id="au-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
        </Field>
        {modo !== 'esqueci' && (
          <Field label="Senha" htmlFor="au-senha" hint={modo === 'criar' ? 'Mínimo de 6 caracteres.' : undefined}>
            <Input
              id="au-senha"
              type="password"
              autoComplete={modo === 'criar' ? 'new-password' : 'current-password'}
              required
              minLength={6}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </Field>
        )}
        {erro && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}
        {aviso && (
          <p className="flex gap-2 rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
            <Mail className="mt-0.5 size-4 shrink-0" /> {aviso}
          </p>
        )}
        <Button type="submit" size="lg" disabled={carregando}>
          {carregando && <Loader2 className="animate-spin" />}
          {modo === 'entrar' ? 'Entrar' : modo === 'criar' ? 'Criar conta' : 'Enviar link'}
        </Button>
        <button
          type="button"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          onClick={() => {
            setModo(modo === 'esqueci' ? 'entrar' : 'esqueci');
            setErro(null);
            setAviso(null);
          }}
        >
          {modo === 'esqueci' ? 'Voltar para o login' : 'Esqueci minha senha'}
        </button>
      </form>
      <p className="text-center text-xs text-muted-foreground">Cada um cria a própria conta. Depois vocês compartilham o mesmo lar com um código de convite.</p>
    </TelaCentral>
  );
}

/** Aparece ao abrir o link de "esqueci minha senha". */
export function TelaNovaSenha({ onConcluir }: { onConcluir: () => void }) {
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  return (
    <TelaCentral>
      <form
        className="grid gap-4 rounded-2xl border bg-card p-6 shadow-sm"
        onSubmit={async (e) => {
          e.preventDefault();
          setCarregando(true);
          const { error } = (await supabase?.auth.updateUser({ password: senha })) ?? {};
          setCarregando(false);
          if (error) setErro(traduzirErro(error.message));
          else onConcluir();
        }}
      >
        <div>
          <p className="flex items-center gap-2 font-semibold">
            <KeyRound className="size-4" /> Criar nova senha
          </p>
        </div>
        <Field label="Nova senha" htmlFor="ns-senha" hint="Mínimo de 6 caracteres.">
          <Input id="ns-senha" type="password" autoComplete="new-password" minLength={6} required value={senha} onChange={(e) => setSenha(e.target.value)} />
        </Field>
        {erro && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}
        <Button type="submit" size="lg" disabled={carregando}>
          {carregando && <Loader2 className="animate-spin" />} Salvar senha
        </Button>
      </form>
    </TelaCentral>
  );
}
