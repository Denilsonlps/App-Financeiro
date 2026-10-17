import { useState } from 'react';
import { toast } from 'sonner';
import { CreditCard, Pencil, Plus, Power, Trash2, UserPlus } from 'lucide-react';
import type { Cartao, Pessoa } from '@/types';
import { useAppState } from '@/store/store';
import { removerCartao, removerPessoa, salvarCartao, salvarPessoa } from '@/store/actions';
import { faturasDoMes } from '@/lib/finance';
import { moeda, ROTULO_CURTO_RESPONSAVEL } from '@/lib/format';
import { cn, uid } from '@/lib/utils';
import { useMes } from '@/components/shared/mes-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/shared/chips';
import { PageHeader } from '@/components/shared/page';
import { CartaoForm } from './cartao-form';

export function CartoesPage() {
  const state = useAppState();
  const { mes } = useMes();
  const [editando, setEditando] = useState<{ cartao?: Cartao } | null>(null);
  const [pessoaEd, setPessoaEd] = useState<Partial<Pessoa> | null>(null);
  const faturas = new Map(faturasDoMes(state, mes).map((f) => [f.cartao.id, f]));
  const donos = [...state.pessoas].sort((a, b) => (a.tipo === b.tipo ? 0 : a.tipo === 'casal' ? -1 : 1));

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        title="Cartões & donos"
        description="Cartões próprios e de terceiros, com quem assume cada fatura por padrão."
        actions={
          <>
            <Button variant="outline" onClick={() => setPessoaEd({})}>
              <UserPlus /> Nova pessoa
            </Button>
            <Button onClick={() => setEditando({})}>
              <Plus /> Novo cartão
            </Button>
          </>
        }
      />

      {donos.map((dono) => {
        const cartoes = state.cartoes.filter((c) => c.donoId === dono.id);
        return (
          <section key={dono.id} className="grid gap-3">
            <div className="flex items-center gap-3">
              <Avatar pessoa={dono} className="size-8" />
              <h2 className="font-semibold">{dono.nome}</h2>
              {dono.tipo === 'terceiro' && <Badge variant="outline">terceiro</Badge>}
              <div className="ml-auto flex">
                <Button variant="ghost" size="icon" aria-label="Editar pessoa" onClick={() => setPessoaEd(dono)}><Pencil /></Button>
                {dono.tipo === 'terceiro' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remover pessoa"
                    onClick={() => {
                      if (!confirm(`Remover ${dono.nome}?`)) return;
                      const erro = removerPessoa(dono.id);
                      erro ? toast.error(erro) : toast.success('Pessoa removida');
                    }}
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
            </div>
            {cartoes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum cartão cadastrado.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {cartoes.map((c) => {
                  const f = faturas.get(c.id);
                  return (
                    <div key={c.id} className={cn('grid gap-3', !c.ativo && 'opacity-50')}>
                      <div
                        className={cn('relative flex aspect-[1.75] flex-col justify-between overflow-hidden rounded-xl p-4 shadow-md', corClara(c.cor) ? 'text-zinc-900' : 'text-white')}
                        style={{ background: `linear-gradient(135deg, ${c.cor}, ${c.cor}cc 55%, ${corClara(c.cor) ? "#00000033" : "#000000aa"})` }}
                      >
                        <div className="flex items-start justify-between">
                          <p className="text-lg font-bold drop-shadow">{c.nome}</p>
                          <CreditCard className="size-6 opacity-80" />
                        </div>
                        <div className="grid gap-0.5 text-xs drop-shadow">
                          <p className="text-[10px] uppercase tracking-wider opacity-80">Fatura de {mes.slice(5)}/{mes.slice(2, 4)}</p>
                          <p className="tabular text-2xl font-bold">{moeda(f?.total ?? 0)}</p>
                          <p className="opacity-90">
                            {dono.nome.toUpperCase()} · fecha {c.diaFechamento} · vence {c.diaVencimento}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={c.responsavelPadrao}>Padrão: {ROTULO_CURTO_RESPONSAVEL[c.responsavelPadrao]}</Badge>
                        <div className="ml-auto flex">
                          <Button variant="ghost" size="icon" aria-label={c.ativo ? 'Desativar' : 'Ativar'} title={c.ativo ? 'Desativar' : 'Ativar'} onClick={() => salvarCartao({ ...c, ativo: !c.ativo })}>
                            <Power />
                          </Button>
                          <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => setEditando({ cartao: c })}><Pencil /></Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Excluir"
                            onClick={() => {
                              if (!confirm(`Excluir o cartão ${c.nome} de ${dono.nome}?`)) return;
                              const erro = removerCartao(c.id);
                              erro ? toast.error(erro) : toast.success('Cartão excluído');
                            }}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Como funciona o mês da fatura</CardTitle>
          <CardDescription>
            Compras feitas <strong>antes</strong> do dia de fechamento entram na fatura que vence logo em seguida. A partir do fechamento, vão para a próxima.
            Se o vencimento é antes do fechamento no calendário (ex.: fecha 28, vence 5), a fatura vence no mês seguinte.
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>

      <Dialog open={!!editando} onOpenChange={(o) => !o && setEditando(null)} title={editando?.cartao ? 'Editar cartão' : 'Novo cartão'}>
        {editando && <CartaoForm inicial={editando.cartao} onSalvo={() => setEditando(null)} />}
      </Dialog>

      <Dialog open={!!pessoaEd} onOpenChange={(o) => !o && setPessoaEd(null)} title={pessoaEd?.id ? 'Editar pessoa' : 'Nova pessoa'}>
        {pessoaEd && <PessoaForm inicial={pessoaEd} onSalvo={() => setPessoaEd(null)} />}
      </Dialog>
    </div>
  );
}

function PessoaForm({ inicial, onSalvo }: { inicial: Partial<Pessoa>; onSalvo: () => void }) {
  const [nome, setNome] = useState(inicial.nome ?? '');
  const [apelidos, setApelidos] = useState((inicial.apelidos ?? []).join(', '));
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        salvarPessoa({
          id: inicial.id ?? uid(),
          tipo: inicial.tipo ?? 'terceiro',
          integrante: inicial.integrante,
          nome: nome.trim(),
          apelidos: apelidos.split(',').map((a) => a.trim()).filter(Boolean),
        });
        toast.success('Pessoa salva');
        onSalvo();
      }}
    >
      <Field label="Nome" htmlFor="pe-nome">
        <Input id="pe-nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
      </Field>
      <Field label="Apelidos (opcional)" htmlFor="pe-apel" hint='Como vocês falam dessa pessoa. Ex.: "mano, meu irmão".'>
        <Input id="pe-apel" value={apelidos} onChange={(e) => setApelidos(e.target.value)} />
      </Field>
      <Button type="submit">Salvar</Button>
    </form>
  );
}

/** true se a cor do cartão é clara o bastante para pedir texto escuro (ex.: amarelo do BB). */
function corClara(hex: string): boolean {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
  if (Number.isNaN(n)) return false;
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 170;
}
