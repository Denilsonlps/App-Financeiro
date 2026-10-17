import { CheckCircle2, CreditCard, Hourglass, Receipt, Sigma } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ResumoMes } from '@/lib/finance';
import { moeda } from '@/lib/format';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

function Kpi({ icon: Icon, label, valor, sub, destaque }: { icon: LucideIcon; label: string; valor: string; sub?: React.ReactNode; destaque?: boolean }) {
  return (
    <Card className={destaque ? 'border-primary/40 bg-primary/5' : ''}>
      <div className="grid gap-1 p-4">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Icon className="size-3.5" /> {label}
        </p>
        <p className="tabular text-xl font-bold tracking-tight sm:text-2xl">{valor}</p>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </div>
    </Card>
  );
}

export function Kpis({ r }: { r: ResumoMes }) {
  const pct = r.totalGeral ? (r.totalPago / r.totalGeral) * 100 : 0;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <Kpi icon={CreditCard} label="Faturas totais" valor={moeda(r.faturasTotais)} sub="Compras + assinaturas no cartão" />
      <Kpi icon={Receipt} label="Gastos fixos" valor={moeda(r.gastosFixos)} sub="Contas mensais + PIX/boleto" />
      <Kpi icon={Sigma} label="Total geral" valor={moeda(r.totalGeral)} destaque />
      <Kpi
        icon={CheckCircle2}
        label="Total pago"
        valor={moeda(r.totalPago)}
        sub={<Progress value={pct} className="mt-1 h-1.5" barClassName="bg-emerald-500" />}
      />
      <Kpi icon={Hourglass} label="Restante" valor={moeda(r.restante)} sub={`${Math.round(100 - pct)}% do mês em aberto`} />
    </div>
  );
}
