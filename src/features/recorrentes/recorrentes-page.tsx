import { toast } from 'sonner';
import { Pause, Pencil, Play, Plus, Repeat, Trash2 } from 'lucide-react';
import { useAppState } from '@/store/store';
import { definirPagamentoRecorrente, removerRecorrente, salvarRecorrente } from '@/store/actions';
import { recorrenteAtivaNoMes } from '@/lib/finance';
import { mesCurto, mesLongo, moeda, ROTULO_FORMA } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useMes } from '@/components/shared/mes-context';
import { useLancamento } from '@/features/smart-input/smart-input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Empty } from '@/components/ui/empty';
import { CartaoChip } from '@/components/shared/chips';
import { ResponsavelBadge } from '@/components/shared/responsavel';
import { PageHeader, Stat, StatusToggle } from '@/components/shared/page';

export function RecorrentesPage() {
  const state = useAppState();
  const { mes } = useMes();
  const { abrirEditor } = useLancamento();
  const contas = [...state.recorrentes].sort((a, b) => Number(recorrenteAtivaNoMes(b, mes)) - Number(recorrenteAtivaNoMes(a, mes)) || a.diaVencimento - b.diaVencimento);
  const ativas = contas.filter((c) => recorrenteAtivaNoMes(c, mes));
  const valorNoMes = (id: string, padrao: number) => state.pagamentosRecorrentes.find((p) => p.contaId === id && p.mes === mes)?.valorReal ?? padrao;
  const total = ativas.reduce((a, c) => a + valorNoMes(c.id, c.valor), 0);

  return (
    <div className="grid grid-cols-1 gap-4">
      <PageHeader
        title="Contas recorrentes"
        description="Aluguel, contas de casa e assinaturas que se repetem todo mês."
        actions={
          <Button onClick={() => abrirEditor('recorrente', undefined, { travarTipo: true, titulo: 'Nova conta recorrente' })}>
            <Plus /> Nova conta
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-2">
        <Stat label={`Ativas em ${mesLongo(mes)}`} valor={`${ativas.length} contas`} />
        <Stat label="Total mensal" valor={moeda(total)} />
      </div>
      {contas.length === 0 ? (
        <Empty icon={Repeat} title="Nenhuma conta recorrente" />
      ) : (
        <Card className="divide-y">
          {contas.map((c) => {
            const ativa = recorrenteAtivaNoMes(c, mes);
            const pg = state.pagamentosRecorrentes.find((p) => p.contaId === c.id && p.mes === mes);
            const cartao = state.cartoes.find((x) => x.id === c.cartaoId);
            const dono = state.pessoas.find((p) => p.id === cartao?.donoId);
            return (
              <div key={c.id} className={cn('flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap', !ativa && 'opacity-50')}>
                <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-xs font-bold tabular">
                  {String(c.diaVencimento).padStart(2, '0')}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate font-medium">
                    {c.descricao}
                    {!c.ativo && <Badge variant="warning">pausada</Badge>}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    {c.categoria} ·
                    {c.formaPagamento === 'cartao' ? <CartaoChip cartao={cartao} dono={dono} /> : <span>{ROTULO_FORMA[c.formaPagamento]} por {c.pagoPor === 'denilson' ? 'Denilson' : 'Hevellyn'}</span>}
                    <span>· {mesCurto(c.inicio)} → {c.fim ? mesCurto(c.fim) : 'sem fim'}</span>
                  </div>
                </div>
                <ResponsavelBadge r={c.responsavel} />
                <p className="tabular w-24 text-right font-semibold">{moeda(pg?.valorReal ?? c.valor)}</p>
                {ativa ? (
                  <StatusToggle status={pg?.status ?? 'aberto'} onChange={(s) => definirPagamentoRecorrente(c.id, mes, s)} />
                ) : (
                  <span className="text-xs text-muted-foreground">fora do período</span>
                )}
                <div className="flex">
                  <Button variant="ghost" size="icon" aria-label={c.ativo ? 'Pausar' : 'Reativar'} title={c.ativo ? 'Pausar' : 'Reativar'} onClick={() => salvarRecorrente({ ...c, ativo: !c.ativo })}>
                    {c.ativo ? <Pause /> : <Play />}
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => abrirEditor('recorrente', { recorrente: c }, { travarTipo: true, titulo: 'Editar conta recorrente' })}>
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Excluir"
                    onClick={() => {
                      if (!confirm(`Excluir "${c.descricao}" e o histórico de pagamentos?`)) return;
                      removerRecorrente(c.id);
                      toast.success('Conta excluída');
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            );
          })}
        </Card>
      )}
      <p className="text-xs text-muted-foreground">
        Dica: para encerrar uma assinatura sem perder o histórico, edite e defina o mês de fim. Contas no cartão entram automaticamente na fatura.
      </p>
    </div>
  );
}
