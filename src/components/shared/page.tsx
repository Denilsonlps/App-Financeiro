import { Check, Circle } from 'lucide-react';
import type { StatusPagamento } from '@/types';
import { cn } from '@/lib/utils';

export function PageHeader({ title, description, actions }: { title: string; description?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Botão compacto Pago/Aberto. */
export function StatusToggle({ status, onChange }: { status: StatusPagamento; onChange: (s: StatusPagamento) => void }) {
  const pago = status === 'pago';
  return (
    <button
      onClick={() => onChange(pago ? 'aberto' : 'pago')}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors',
        pago ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'text-muted-foreground hover:border-foreground/40',
      )}
      title={pago ? 'Marcar como em aberto' : 'Marcar como pago'}
    >
      {pago ? <Check className="size-3" /> : <Circle className="size-3" />}
      {pago ? 'Pago' : 'Aberto'}
    </button>
  );
}

export function Stat({ label, valor, className }: { label: string; valor: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-lg border bg-card px-3 py-2', className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="tabular font-semibold">{valor}</p>
    </div>
  );
}
