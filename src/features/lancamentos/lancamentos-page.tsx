import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CreditCard, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useAppState } from '@/store/store';
import { definirStatusLancamento, removerCompra } from '@/store/actions';
import { faturasDoMes } from '@/lib/finance';
import { dataCurta, moeda } from '@/lib/format';
import { normalizar } from '@/lib/utils';
import { useMes } from '@/components/shared/mes-context';
import { useLancamento } from '@/features/smart-input/smart-input';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Empty } from '@/components/ui/empty';
import { CartaoChip } from '@/components/shared/chips';
import { ResponsavelBadge } from '@/components/shared/responsavel';
import { PageHeader, Stat, StatusToggle } from '@/components/shared/page';

export function LancamentosPage() {
  const state = useAppState();
  const { mes } = useMes();
  const { abrirEditor } = useLancamento();
  const [filtroCartao, setFiltroCartao] = useState('');
  const [busca, setBusca] = useState('');

  const lancamentos = useMemo(() => {
    const q = normalizar(busca.trim());
    return state.lancamentos
      .filter((l) => l.mesFatura === mes && (!filtroCartao || l.cartaoId === filtroCartao) && (!q || normalizar(l.descricao + ' ' + l.categoria).includes(q)))
      .sort((a, b) => b.data.localeCompare(a.data));
  }, [state.lancamentos, mes, filtroCartao, busca]);

  const faturas = faturasDoMes(state, mes);
  const total = lancamentos.reduce((a, l) => a + l.valorParcela, 0);
  const totD = lancamentos.reduce((a, l) => a + l.cotaDenilson, 0);
  const totH = lancamentos.reduce((a, l) => a + l.cotaHevellyn, 0);

  function editar(compraId: string) {
    const c = state.compras.find((x) => x.id === compraId);
    if (c) abrirEditor('cartao', { cartao: c }, { travarTipo: true, titulo: 'Editar compra' });
  }

  function excluir(compraId: string) {
    const c = state.compras.find((x) => x.id === compraId);
    if (!c || !confirm(`Excluir "${c.descricao}" e todas as ${c.parcelas} parcelas?`)) return;
    removerCompra(compraId);
    toast.success('Compra excluída');
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      <PageHeader
        title="Compras no cartão"
        description="Uma linha por parcela, na fatura em que ela cai."
        actions={
          <Button onClick={() => abrirEditor('cartao')}>
            <Plus /> Nova compra
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Total das faturas" valor={moeda(total)} />
        <Stat label="Cota Denilson" valor={<span className="text-denilson">{moeda(totD)}</span>} />
        <Stat label="Cota Hevellyn" valor={<span className="text-hevellyn">{moeda(totH)}</span>} />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar descrição ou categoria…" className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <div className="sm:w-64">
          <Select value={filtroCartao} onChange={(e) => setFiltroCartao(e.target.value)} aria-label="Filtrar por cartão">
            <option value="">Todos os cartões ({faturas.length} com fatura)</option>
            {faturas.map((f) => (
              <option key={f.cartao.id} value={f.cartao.id}>
                {f.cartao.nome} · {f.dono?.nome} — {moeda(f.total)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {lancamentos.length === 0 ? (
        <Empty icon={CreditCard} title="Nenhuma parcela nesta fatura">
          Use o Smart Input ou “Nova compra” para lançar.
        </Empty>
      ) : (
        <Card className="overflow-hidden">
          {/* Tabela no desktop */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Data</th>
                  <th className="px-4 py-2 font-medium">Descrição</th>
                  <th className="px-4 py-2 font-medium">Cartão · Dono</th>
                  <th className="px-4 py-2 font-medium">Parcela</th>
                  <th className="px-4 py-2 font-medium">Responsável</th>
                  <th className="px-4 py-2 text-right font-medium">Valor</th>
                  <th className="px-4 py-2 text-right font-medium">Cota D</th>
                  <th className="px-4 py-2 text-right font-medium">Cota H</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {lancamentos.map((l) => {
                  const cartao = state.cartoes.find((c) => c.id === l.cartaoId);
                  const dono = state.pessoas.find((p) => p.id === cartao?.donoId);
                  return (
                    <tr key={l.id} className="hover:bg-muted/30">
                      <td className="tabular whitespace-nowrap px-4 py-2 text-muted-foreground">{dataCurta(l.data)}</td>
                      <td className="px-4 py-2">
                        <p className="font-medium">{l.descricao}</p>
                        <p className="text-xs text-muted-foreground">{l.categoria}</p>
                      </td>
                      <td className="px-4 py-2"><CartaoChip cartao={cartao} dono={dono} /></td>
                      <td className="tabular px-4 py-2">{l.parcelasTotal > 1 ? `${l.parcelaAtual}/${l.parcelasTotal}` : 'À vista'}</td>
                      <td className="px-4 py-2"><ResponsavelBadge r={l.responsavel} /></td>
                      <td className="tabular px-4 py-2 text-right font-semibold">{moeda(l.valorParcela)}</td>
                      <td className="tabular px-4 py-2 text-right text-denilson">{l.cotaDenilson ? moeda(l.cotaDenilson) : '—'}</td>
                      <td className="tabular px-4 py-2 text-right text-hevellyn">{l.cotaHevellyn ? moeda(l.cotaHevellyn) : '—'}</td>
                      <td className="px-4 py-2"><StatusToggle status={l.status} onChange={(s) => definirStatusLancamento(l.id, s)} /></td>
                      <td className="whitespace-nowrap px-2 py-2">
                        <Button variant="ghost" size="icon" onClick={() => editar(l.compraId)} aria-label="Editar"><Pencil /></Button>
                        <Button variant="ghost" size="icon" onClick={() => excluir(l.compraId)} aria-label="Excluir"><Trash2 /></Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Lista no mobile */}
          <ul className="divide-y md:hidden">
            {lancamentos.map((l) => {
              const cartao = state.cartoes.find((c) => c.id === l.cartaoId);
              const dono = state.pessoas.find((p) => p.id === cartao?.donoId);
              return (
                <li key={l.id} className="grid gap-1.5 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <button className="min-w-0 text-left" onClick={() => editar(l.compraId)}>
                      <p className="truncate font-medium">
                        {l.descricao}
                        {l.parcelasTotal > 1 && <span className="ml-1 text-xs text-muted-foreground">{l.parcelaAtual}/{l.parcelasTotal}</span>}
                      </p>
                      <CartaoChip cartao={cartao} dono={dono} className="text-xs" />
                    </button>
                    <p className="tabular font-semibold">{moeda(l.valorParcela)}</p>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <ResponsavelBadge r={l.responsavel} />
                    <div className="flex items-center gap-1">
                      <StatusToggle status={l.status} onChange={(s) => definirStatusLancamento(l.id, s)} />
                      <Button variant="ghost" size="icon" className="size-7" onClick={() => excluir(l.compraId)} aria-label="Excluir"><Trash2 /></Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
