import { CalendarClock } from 'lucide-react';
import type { ParcelaAVencer } from '@/lib/finance';
import { mesCurto, moeda } from '@/lib/format';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Empty } from '@/components/ui/empty';
import { CartaoChip } from '@/components/shared/chips';
import { ResponsavelBadge } from '@/components/shared/responsavel';

export function ParcelasAVencer({ itens }: { itens: ParcelaAVencer[] }) {
  const total = itens.reduce((a, i) => a + i.saldoDevedor, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="size-4" /> Parcelas a vencer
        </CardTitle>
        <CardDescription>
          Saldo devedor total: <strong className="tabular text-foreground">{moeda(total)}</strong>
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-2">
        {itens.length === 0 ? (
          <Empty icon={CalendarClock} title="Nenhuma compra parcelada em aberto" />
        ) : (
          itens.map((i) => {
            const pagas = i.compra.parcelas - i.parcelasRestantes;
            return (
              <div key={i.compra.id} className="grid gap-2 rounded-lg border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{i.compra.descricao}</p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <CartaoChip cartao={i.cartao} dono={i.dono} />
                      <ResponsavelBadge r={i.compra.responsavel} />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="tabular font-bold">{moeda(i.saldoDevedor)}</p>
                    <p className="tabular text-xs text-muted-foreground">
                      {i.parcelasRestantes}x de {moeda(i.valorParcela)}
                    </p>
                  </div>
                </div>
                <Progress value={(pagas / i.compra.parcelas) * 100} className="h-1.5" />
                <p className="tabular flex justify-between text-xs text-muted-foreground">
                  <span>
                    Próxima: {i.proximaParcela}/{i.compra.parcelas} em {mesCurto(i.proximaFatura)}
                  </span>
                  <span>Termina {mesCurto(i.ultimaFatura)}</span>
                </p>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
