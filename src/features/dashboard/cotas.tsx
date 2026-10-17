import { ArrowRight, Handshake } from 'lucide-react';
import type { AcertoCasal, ItemMes, ResumoMes } from '@/lib/finance';
import { moeda } from '@/lib/format';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

export function Cotas({ r, itens, acerto }: { r: ResumoMes; itens: ItemMes[]; acerto: AcertoCasal }) {
  const pagoD = itens.filter((i) => i.status === 'pago').reduce((a, i) => a + i.cotaDenilson, 0);
  const pagoH = itens.filter((i) => i.status === 'pago').reduce((a, i) => a + i.cotaHevellyn, 0);
  const total = r.cotaDenilson + r.cotaHevellyn || 1;

  return (
    <Card className="overflow-hidden">
      <div className="grid sm:grid-cols-2">
        <CotaPessoa nome="Denilson" cor="denilson" valor={r.cotaDenilson} pago={pagoD} pct={(r.cotaDenilson / total) * 100} />
        <CotaPessoa nome="Hevellyn" cor="hevellyn" valor={r.cotaHevellyn} pago={pagoH} pct={(r.cotaHevellyn / total) * 100} borda />
      </div>
      <div className="flex h-2 w-full">
        <div className="bg-denilson transition-all" style={{ width: `${(r.cotaDenilson / total) * 100}%` }} />
        <div className="bg-hevellyn transition-all" style={{ width: `${(r.cotaHevellyn / total) * 100}%` }} />
      </div>
      <AcertoBanner acerto={acerto} />
    </Card>
  );
}

function CotaPessoa({ nome, cor, valor, pago, pct, borda }: { nome: string; cor: 'denilson' | 'hevellyn'; valor: number; pago: number; pct: number; borda?: boolean }) {
  const texto = cor === 'denilson' ? 'text-denilson' : 'text-hevellyn';
  const barra = cor === 'denilson' ? 'bg-denilson' : 'bg-hevellyn';
  return (
    <div className={`grid gap-2 p-5 ${borda ? 'border-t sm:border-l sm:border-t-0' : ''}`}>
      <div className="flex items-baseline justify-between">
        <p className={`text-sm font-semibold ${texto}`}>Cota {nome}</p>
        <p className="tabular text-xs text-muted-foreground">{Math.round(pct)}% do mês</p>
      </div>
      <p className="tabular text-3xl font-bold tracking-tight">{moeda(valor)}</p>
      <Progress value={valor ? (pago / valor) * 100 : 0} barClassName={barra} />
      <p className="tabular text-xs text-muted-foreground">
        {moeda(pago)} quitado · <span className="font-medium text-foreground">{moeda(valor - pago)} a pagar</span>
      </p>
    </div>
  );
}

function AcertoBanner({ acerto }: { acerto: AcertoCasal }) {
  const { saldo } = acerto;
  return (
    <div className="flex flex-wrap items-center gap-3 border-t bg-muted/40 px-5 py-3 text-sm">
      <Handshake className="size-5 shrink-0 text-primary" />
      {saldo === 0 ? (
        <p>Acerto do casal: <strong>ninguém deve nada</strong> este mês.</p>
      ) : (
        <p className="flex flex-wrap items-center gap-1.5">
          Acerto do casal:
          <strong className={saldo > 0 ? 'text-hevellyn' : 'text-denilson'}>{saldo > 0 ? 'Hevellyn' : 'Denilson'}</strong>
          <ArrowRight className="size-4" />
          <strong className={saldo > 0 ? 'text-denilson' : 'text-hevellyn'}>{saldo > 0 ? 'Denilson' : 'Hevellyn'}</strong>
          <span className="tabular rounded-md bg-background px-2 py-0.5 font-bold shadow-sm">{moeda(Math.abs(saldo))}</span>
        </p>
      )}
      <p className="w-full text-xs text-muted-foreground sm:ml-auto sm:w-auto">
        D adiantou {moeda(acerto.denilsonAdiantou)} · H adiantou {moeda(acerto.hevellynAdiantou)}
      </p>
    </div>
  );
}
