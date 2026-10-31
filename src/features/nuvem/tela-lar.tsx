import { useState } from 'react';
import { House, Loader2, LogOut, Ticket } from 'lucide-react';
import type { AppState } from '@/types';
import { supabase } from '@/lib/supabase';
import { lerEstadoLocal } from '@/store/store';
import { estadoDemo, estadoVazio } from '@/store/seed';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { TelaCentral } from './tela-auth';
import { traduzirErro } from './nuvem-context';

interface LarCriado {
  id: string;
  nome: string;
  codigo_convite: string;
}

type Origem = 'local' | 'exemplo' | 'vazio';

/** Primeiro acesso de uma conta: criar o lar do casal ou entrar com código. */
export function TelaLar({ email, onPronto, onSair }: { email: string; onPronto: (lar: LarCriado, estadoInicial?: AppState) => Promise<void>; onSair: () => void }) {
  const local = lerEstadoLocal();
  const temLocal = !!local && local.compras.length + local.gastos.length + local.recorrentes.length > 0;
  const [nome, setNome] = useState('Denilson & Hevellyn');
  const [origem, setOrigem] = useState<Origem>(temLocal ? 'local' : 'vazio');
  const [codigo, setCodigo] = useState('');
  const [ocupado, setOcupado] = useState<'criar' | 'entrar' | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function executar(tipo: 'criar' | 'entrar') {
    if (!supabase) return;
    setErro(null);
    setOcupado(tipo);
    try {
      if (tipo === 'criar') {
        const { data, error } = await supabase.rpc('criar_lar', { p_nome: nome });
        if (error) throw error;
        const inicial = origem === 'local' && local ? local : origem === 'exemplo' ? estadoDemo() : estadoVazio();
        await onPronto(data as LarCriado, inicial);
      } else {
        const { data, error } = await supabase.rpc('entrar_no_lar', { p_codigo: codigo });
        if (error) throw error;
        await onPronto(data as LarCriado);
      }
    } catch (e) {
      setErro(traduzirErro(e instanceof Error ? e.message : String((e as { message?: string }).message ?? e)));
      setOcupado(null);
    }
  }

  const opcao = (valor: Origem, titulo: string, desc: string) => (
    <label className={cn('flex cursor-pointer gap-3 rounded-lg border p-3 text-sm transition-colors', origem === valor ? 'border-primary bg-primary/5' : 'hover:bg-accent')}>
      <input type="radio" name="origem" className="mt-1 accent-[hsl(var(--primary))]" checked={origem === valor} onChange={() => setOrigem(valor)} />
      <span>
        <span className="font-medium">{titulo}</span>
        <span className="block text-xs text-muted-foreground">{desc}</span>
      </span>
    </label>
  );

  return (
    <TelaCentral>
      <div className="grid gap-4 rounded-2xl border bg-card p-6 shadow-sm">
        <div>
          <p className="flex items-center gap-2 font-semibold">
            <House className="size-4" /> Criar o lar do casal
          </p>
          <p className="text-sm text-muted-foreground">Faça isso só uma vez, em uma das contas. Depois a outra pessoa entra com o código.</p>
        </div>
        <Field label="Nome" htmlFor="lar-nome">
          <Input id="lar-nome" value={nome} onChange={(e) => setNome(e.target.value)} />
        </Field>
        <div className="grid gap-2">
          {temLocal &&
            opcao('local', 'Levar os dados deste aparelho', `${local!.cartoes.length} cartões, ${local!.compras.length} compras, ${local!.gastos.length} gastos e ${local!.recorrentes.length} contas mensais já lançados aqui.`)}
          {opcao('vazio', 'Começar do zero', 'Só Denilson e Hevellyn cadastrados.')}
          {opcao('exemplo', 'Dados de exemplo', 'Para explorar o app antes de usar de verdade.')}
        </div>
        <Button size="lg" onClick={() => executar('criar')} disabled={!!ocupado}>
          {ocupado === 'criar' && <Loader2 className="animate-spin" />} Criar lar
        </Button>
      </div>

      <div className="grid gap-4 rounded-2xl border bg-card p-6 shadow-sm">
        <div>
          <p className="flex items-center gap-2 font-semibold">
            <Ticket className="size-4" /> Já tenho um código de convite
          </p>
          <p className="text-sm text-muted-foreground">Quem criou o lar encontra o código em Configurações.</p>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void executar('entrar');
          }}
        >
          <Input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="Ex.: 7F3A9C21" maxLength={8} className="font-mono uppercase tracking-widest" required />
          <Button type="submit" variant="secondary" disabled={!!ocupado || codigo.length < 8}>
            {ocupado === 'entrar' && <Loader2 className="animate-spin" />} Entrar
          </Button>
        </form>
      </div>

      {erro && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</p>}
      <button onClick={onSair} className="mx-auto flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <LogOut className="size-3.5" /> Sair de {email}
      </button>
    </TelaCentral>
  );
}
