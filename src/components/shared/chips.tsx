import { CreditCard } from 'lucide-react';
import type { Cartao, Pessoa } from '@/types';
import { cn } from '@/lib/utils';

export function CartaoChip({ cartao, dono, className }: { cartao?: Cartao; dono?: Pessoa; className?: string }) {
  if (!cartao) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
      <span className="grid size-5 shrink-0 place-items-center rounded" style={{ backgroundColor: cartao.cor }}>
        <CreditCard className="size-3 text-white mix-blend-difference" />
      </span>
      <span className="truncate">
        {cartao.nome}
        {dono && <span className="text-muted-foreground"> · {dono.nome}</span>}
      </span>
    </span>
  );
}

const CORES_AVATAR = ['bg-sky-500', 'bg-amber-500', 'bg-emerald-500', 'bg-rose-500', 'bg-violet-500', 'bg-teal-500', 'bg-orange-500'];

export function Avatar({ pessoa, className }: { pessoa: Pessoa; className?: string }) {
  const cor =
    pessoa.integrante === 'denilson'
      ? 'bg-denilson'
      : pessoa.integrante === 'hevellyn'
        ? 'bg-hevellyn'
        : CORES_AVATAR[[...pessoa.nome].reduce((a, c) => a + c.charCodeAt(0), 0) % CORES_AVATAR.length];
  return (
    <span className={cn('grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold text-white', cor, className)}>
      {pessoa.nome.slice(0, 1).toUpperCase()}
    </span>
  );
}
