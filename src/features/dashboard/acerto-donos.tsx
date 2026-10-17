import { useState } from 'react';
import { toast } from 'sonner';
import { Check, ChevronDown, Users } from 'lucide-react';
import type { AcertoDono } from '@/lib/finance';
import { dataCurta, moeda } from '@/lib/format';
import { definirStatusFatura } from '@/store/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Empty } from '@/components/ui/empty';
import { Avatar, CartaoChip } from '@/components/shared/chips';
import { ResponsavelBadge } from '@/components/shared/responsavel';
import { cn } from '@/lib/utils';

/** "Quanto devo pagar para cada Dono de Cartão" no mês. */
export function AcertoDonos({ donos }: { donos: AcertoDono[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="size-4" /> Quanto pagar a cada dono de cartão
        </CardTitle>
        <CardDescription>Faturas do mês agrupadas por dono, com a parte de cada um.</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-2">
        {donos.length === 0 ? (
          <Empty icon={Users} title="Nenhuma fatura neste mês" />
        ) : (
          donos.map((d) => <LinhaDono key={d.dono.id} d={d} />)
        )}
      </CardContent>
    </Card>
  );
}

function LinhaDono({ d }: { d: AcertoDono }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className={cn('rounded-lg border transition-colors', d.pago && 'bg-muted/40')}>
      <button onClick={() => setAberto((a) => !a)} className="flex w-full items-center gap-3 p-3 text-left" aria-expanded={aberto}>
        <Avatar pessoa={d.dono} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-medium">
            {d.dono.nome}
            {d.dono.tipo === 'terceiro' && <Badge variant="outline">terceiro</Badge>}
            {d.pago && (
              <Badge variant="success">
                <Check className="size-3" /> pago
              </Badge>
            )}
          </p>
          <p className="tabular truncate text-xs text-muted-foreground">
            {d.cotaDenilson > 0 && <span className="text-denilson">D {moeda(d.cotaDenilson)}</span>}
            {d.cotaDenilson > 0 && d.cotaHevellyn > 0 && ' · '}
            {d.cotaHevellyn > 0 && <span className="text-hevellyn">H {moeda(d.cotaHevellyn)}</span>}
            {' · '}
            {d.faturas.length} {d.faturas.length === 1 ? 'cartão' : 'cartões'}
          </p>
        </div>
        <p className="tabular text-right font-bold">{moeda(d.total)}</p>
        <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', aberto && 'rotate-180')} />
      </button>
      {aberto && (
        <div className="grid gap-3 border-t p-3">
          {d.faturas.map((f) => (
            <div key={f.cartao.id} className="grid gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CartaoChip cartao={f.cartao} />
                  <span className="text-xs font-normal text-muted-foreground">vence {dataCurta(f.vencimento)}</span>
                </div>
                <Button
                  size="sm"
                  variant={f.pago ? 'outline' : 'default'}
                  onClick={() => {
                    definirStatusFatura(f.cartao.id, f.mes, f.pago ? 'aberto' : 'pago');
                    toast.success(f.pago ? 'Fatura reaberta' : `Fatura ${f.cartao.nome} de ${d.dono.nome} paga`, { description: moeda(f.total) });
                  }}
                >
                  {f.pago ? 'Reabrir' : <><Check /> Marcar paga</>}
                </Button>
              </div>
              <ul className="grid gap-1 text-sm">
                {f.itens.map((i) => (
                  <li key={i.origem + i.id} className="flex items-center gap-2">
                    <span className={cn('min-w-0 flex-1 truncate', i.status === 'pago' && 'text-muted-foreground line-through')}>
                      {i.descricao}
                      {i.parcela && <span className="ml-1 text-xs text-muted-foreground">({i.parcela})</span>}
                      {i.origem === 'recorrente' && <span className="ml-1 text-xs text-muted-foreground">(mensal)</span>}
                    </span>
                    <ResponsavelBadge r={i.responsavel} />
                    <span className="tabular w-24 text-right">{moeda(i.valor)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
