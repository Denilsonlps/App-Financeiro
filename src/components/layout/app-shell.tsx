import { useEffect, useState } from 'react';
import { CreditCard, LayoutDashboard, Mic, Moon, Plus, Receipt, Repeat, Settings, Sparkles, Sun, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTema } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { MesSelector } from '@/components/shared/mes-context';
import { useLancamento } from '@/features/smart-input/smart-input';

export type Rota = 'painel' | 'cartao' | 'avulsos' | 'recorrentes' | 'cartoes' | 'config';

const NAV: { rota: Rota; label: string; curto: string; icon: LucideIcon }[] = [
  { rota: 'painel', label: 'Painel do Casal', curto: 'Painel', icon: LayoutDashboard },
  { rota: 'cartao', label: 'Compras no cartão', curto: 'Compras', icon: Receipt },
  { rota: 'avulsos', label: 'Gastos avulsos', curto: 'Avulsos', icon: Wallet },
  { rota: 'recorrentes', label: 'Contas recorrentes', curto: 'Mensais', icon: Repeat },
  { rota: 'cartoes', label: 'Cartões & donos', curto: 'Cartões', icon: CreditCard },
  { rota: 'config', label: 'Configurações', curto: 'Config', icon: Settings },
];

function lerRota(): Rota {
  const r = window.location.hash.replace('#/', '') as Rota;
  return NAV.some((n) => n.rota === r) ? r : 'painel';
}

export function useRota() {
  const [rota, setRota] = useState<Rota>(lerRota);
  useEffect(() => {
    const on = () => setRota(lerRota());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return rota;
}

export function AppShell({ rota, children }: { rota: Rota; children: React.ReactNode }) {
  const { dark, alternar } = useTema();
  const { abrirSmart, abrirEditor } = useLancamento();
  const ir = (r: Rota) => {
    window.location.hash = `/${r}`;
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="min-h-dvh">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r bg-card/50 p-4 lg:flex">
        <div className="mb-6 flex items-center gap-2 px-2">
          <div className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Wallet className="size-4" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-bold">Painel do Casal</p>
            <p className="text-xs text-muted-foreground">Denilson & Hevellyn</p>
          </div>
        </div>
        <Button className="mb-4 justify-start" onClick={() => abrirSmart()}>
          <Sparkles /> Smart Input
          <kbd className="ml-auto rounded bg-primary-foreground/20 px-1.5 text-[10px]">Ctrl K</kbd>
        </Button>
        <nav className="grid gap-1">
          {NAV.map(({ rota: r, label, icon: Icon }) => (
            <button
              key={r}
              onClick={() => ir(r)}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                rota === r ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
              )}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </nav>
        <Button variant="outline" className="mt-auto justify-start" onClick={() => abrirEditor('cartao')}>
          <Plus /> Lançamento manual
        </Button>
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b bg-background/80 px-4 py-2 backdrop-blur">
          <div className="flex items-center gap-2 lg:hidden">
            <div className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Wallet className="size-3.5" />
            </div>
          </div>
          <div className="mx-auto lg:mx-0">
            <MesSelector />
          </div>
          <Button variant="ghost" size="icon" onClick={alternar} aria-label="Alternar tema" className="lg:ml-auto">
            {dark ? <Sun /> : <Moon />}
          </Button>
        </header>

        <main className="mx-auto max-w-6xl px-4 pb-28 pt-4 lg:pb-10">{children}</main>
      </div>

      {/* Navegação mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {NAV.slice(0, 2).map((n) => <ItemMobile key={n.rota} {...n} ativo={rota === n.rota} onClick={() => ir(n.rota)} />)}
        <div className="flex justify-center">
          <button
            onClick={() => abrirSmart({ ouvir: true })}
            onContextMenu={(e) => {
              e.preventDefault();
              abrirSmart();
            }}
            className="-mt-5 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background"
            aria-label="Lançar por voz"
          >
            <Mic className="size-6" />
          </button>
        </div>
        {NAV.slice(3, 5).map((n) => <ItemMobile key={n.rota} {...n} ativo={rota === n.rota} onClick={() => ir(n.rota)} />)}
      </nav>
    </div>
  );
}

function ItemMobile({ curto, icon: Icon, ativo, onClick }: { curto: string; icon: LucideIcon; ativo: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn('flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium', ativo ? 'text-primary' : 'text-muted-foreground')}>
      <Icon className="size-5" />
      {curto}
    </button>
  );
}

/** Links extras no mobile (Avulsos e Config não cabem na barra inferior). */
export function NavSecundariaMobile({ rota }: { rota: Rota }) {
  const extras = NAV.filter((n) => n.rota === 'avulsos' || n.rota === 'config');
  return (
    <div className="mb-4 flex gap-2 overflow-x-auto lg:hidden">
      {extras.map(({ rota: r, curto, icon: Icon }) => (
        <a key={r} href={`#/${r}`} className={cn('flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs', rota === r ? 'border-primary text-primary' : 'text-muted-foreground')}>
          <Icon className="size-3.5" /> {curto}
        </a>
      ))}
    </div>
  );
}
