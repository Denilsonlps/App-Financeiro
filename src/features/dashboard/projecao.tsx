import { TrendingUp } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ProjecaoMes } from '@/lib/finance';
import { mesCurto, moeda, moedaCurta } from '@/lib/format';
import { useCoresTema } from '@/lib/hooks';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const CORES = ['denilson', 'hevellyn', 'muted-foreground', 'border'] as const;

export function Projecao({ dados, onSelecionarMes }: { dados: ProjecaoMes[]; onSelecionarMes: (m: string) => void }) {
  const cores = useCoresTema(CORES);
  const totalAno = dados.reduce((a, d) => a + d.total, 0);
  const parcelasAno = dados.reduce((a, d) => a + d.parcelas, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="size-4" /> Projeção dos próximos 12 meses
        </CardTitle>
        <CardDescription>
          Parcelas ativas + contas recorrentes. Total: <strong className="tabular text-foreground">{moeda(totalAno)}</strong> ({moeda(parcelasAno)} em parcelas).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer>
            <BarChart
              data={dados.map((d) => ({ ...d, rotulo: mesCurto(d.mes) }))}
              margin={{ left: 4, right: 4, top: 8 }}
              onClick={(e) => {
                const p = (e as { activePayload?: { payload: ProjecaoMes }[] } | null)?.activePayload?.[0]?.payload;
                if (p) onSelecionarMes(p.mes);
              }}
            >
              <CartesianGrid vertical={false} stroke={cores.border} />
              <XAxis dataKey="rotulo" tickLine={false} axisLine={false} tick={{ fill: cores['muted-foreground'], fontSize: 11 }} interval={0} angle={-35} textAnchor="end" height={44} />
              <YAxis tickFormatter={(v: number) => moedaCurta(v)} tickLine={false} axisLine={false} width={68} tick={{ fill: cores['muted-foreground'], fontSize: 11 }} />
              <Tooltip
                cursor={{ fill: cores.border, opacity: 0.4 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as ProjecaoMes;
                  return (
                    <div className="tabular grid gap-1 rounded-lg border bg-popover p-3 text-xs shadow-md">
                      <p className="font-semibold">{mesCurto(d.mes)} · {moeda(d.total)}</p>
                      <p className="text-denilson">Denilson: {moeda(d.cotaDenilson)}</p>
                      <p className="text-hevellyn">Hevellyn: {moeda(d.cotaHevellyn)}</p>
                      <p className="mt-1 border-t pt-1 text-muted-foreground">
                        Parcelas {moeda(d.parcelas)} · Recorrentes {moeda(d.recorrentes)}
                        {d.avulsos > 0 && ` · Avulsos ${moeda(d.avulsos)}`}
                      </p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="cotaDenilson" stackId="a" fill={cores.denilson} name="Denilson" className="cursor-pointer" />
              <Bar dataKey="cotaHevellyn" stackId="a" fill={cores.hevellyn} name="Hevellyn" radius={[4, 4, 0, 0]} className="cursor-pointer" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-denilson" /> Denilson</span>
          <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-hevellyn" /> Hevellyn</span>
          <span>· clique numa barra para abrir o mês</span>
        </div>
      </CardContent>
    </Card>
  );
}
