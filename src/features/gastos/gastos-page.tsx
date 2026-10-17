import { toast } from 'sonner';
import { Pencil, Plus, Trash2, Wallet } from 'lucide-react';
import { useAppState } from '@/store/store';
import { definirStatusGasto, removerGasto } from '@/store/actions';
import { dataCurta, moeda, ROTULO_FORMA } from '@/lib/format';
import { useMes } from '@/components/shared/mes-context';
import { useLancamento } from '@/features/smart-input/smart-input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Empty } from '@/components/ui/empty';
import { ResponsavelBadge } from '@/components/shared/responsavel';
import { PageHeader, Stat, StatusToggle } from '@/components/shared/page';

export function GastosPage() {
  const state = useAppState();
  const { mes } = useMes();
  const { abrirEditor } = useLancamento();
  const gastos = state.gastos.filter((g) => g.mesReferencia === mes).sort((a, b) => b.data.localeCompare(a.data));
  const total = gastos.reduce((a, g) => a + g.valor, 0);

  return (
    <div className="grid grid-cols-1 gap-4">
      <PageHeader
        title="Gastos avulsos"
        description="PIX, boleto, débito e dinheiro — tudo que não passa no cartão."
        actions={
          <Button onClick={() => abrirEditor('avulso', undefined, { travarTipo: true, titulo: 'Novo gasto avulso' })}>
            <Plus /> Novo gasto
          </Button>
        }
      />
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Total do mês" valor={moeda(total)} />
        <Stat label="Cota Denilson" valor={<span className="text-denilson">{moeda(gastos.reduce((a, g) => a + g.cotaDenilson, 0))}</span>} />
        <Stat label="Cota Hevellyn" valor={<span className="text-hevellyn">{moeda(gastos.reduce((a, g) => a + g.cotaHevellyn, 0))}</span>} />
      </div>
      {gastos.length === 0 ? (
        <Empty icon={Wallet} title="Nenhum gasto avulso neste mês" />
      ) : (
        <Card className="divide-y">
          {gastos.map((g) => (
            <div key={g.id} className="flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{g.descricao}</p>
                <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  {dataCurta(g.data)} · {g.categoria}
                  <Badge variant="outline">{ROTULO_FORMA[g.formaPagamento]}</Badge>
                  <span>pago por {g.pagoPor === 'denilson' ? 'Denilson' : 'Hevellyn'}</span>
                </p>
              </div>
              <ResponsavelBadge r={g.responsavel} />
              <p className="tabular w-24 text-right font-semibold">{moeda(g.valor)}</p>
              <StatusToggle status={g.status} onChange={(s) => definirStatusGasto(g.id, s)} />
              <div className="flex">
                <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => abrirEditor('avulso', { avulso: g }, { travarTipo: true, titulo: 'Editar gasto' })}>
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Excluir"
                  onClick={() => {
                    if (!confirm(`Excluir "${g.descricao}"?`)) return;
                    removerGasto(g.id);
                    toast.success('Gasto excluído');
                  }}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
