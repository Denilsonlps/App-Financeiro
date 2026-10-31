import { useState } from 'react';
import { toast } from 'sonner';
import type { Cartao, Responsavel } from '@/types';
import { useAppState } from '@/store/store';
import { salvarCartao, salvarPessoa } from '@/store/actions';
import { uid } from '@/lib/utils';
import { Field } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { NumberInput } from '@/components/shared/number-input';
import { CORES_PADRAO, SeletorCor } from './seletor-cor';

const BANCOS = ['Nubank', 'BB', 'Itaú', 'Inter', 'BV', 'Riachuelo', 'C6', 'Santander', 'Bradesco', 'Caixa', 'Mercado Pago', 'PicPay', 'XP', 'Renner', 'Magalu'];
const NOVA_PESSOA = '__nova__';

export function CartaoForm({ inicial, onSalvo }: { inicial?: Cartao; onSalvo: () => void }) {
  const state = useAppState();
  const [nome, setNome] = useState(inicial?.nome ?? '');
  const [donoId, setDonoId] = useState(inicial?.donoId ?? state.pessoas[0]?.id ?? '');
  const [novaPessoa, setNovaPessoa] = useState('');
  const [fechamento, setFechamento] = useState(inicial?.diaFechamento ?? 1);
  const [vencimento, setVencimento] = useState(inicial?.diaVencimento ?? 10);
  const [responsavel, setResponsavel] = useState<Responsavel>(inicial?.responsavelPadrao ?? 'casal');
  const [cor, setCor] = useState(inicial?.cor ?? CORES_PADRAO[0]);
  const [apelidos, setApelidos] = useState((inicial?.apelidos ?? []).join(', '));

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    let dono = donoId;
    if (donoId === NOVA_PESSOA) {
      const n = novaPessoa.trim();
      if (!n) return void toast.error('Informe o nome do novo dono.');
      const existente = state.pessoas.find((p) => p.nome.toLowerCase() === n.toLowerCase());
      dono = existente?.id ?? uid();
      if (!existente) salvarPessoa({ id: dono, nome: n, tipo: 'terceiro' });
    }
    salvarCartao({
      id: inicial?.id ?? uid(),
      nome: nome.trim(),
      donoId: dono,
      diaFechamento: fechamento,
      diaVencimento: vencimento,
      responsavelPadrao: responsavel,
      cor,
      apelidos: apelidos.split(',').map((a) => a.trim()).filter(Boolean),
      ativo: inicial?.ativo ?? true,
    });
    toast.success(inicial ? 'Cartão atualizado' : 'Cartão cadastrado');
    onSalvo();
  }

  return (
    <form onSubmit={salvar} className="grid gap-4">
      <Field label="Banco / bandeira" htmlFor="k-nome">
        <Input id="k-nome" list="lista-bancos" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Nubank" required />
        <datalist id="lista-bancos">{BANCOS.map((b) => <option key={b} value={b} />)}</datalist>
      </Field>
      <Field label="Dono do cartão físico" htmlFor="k-dono" hint="Quem recebe a fatura. Pode ser um terceiro (Pai, Irmão…).">
        <Select id="k-dono" value={donoId} onChange={(e) => setDonoId(e.target.value)}>
          {state.pessoas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}{p.tipo === 'terceiro' ? ' (terceiro)' : ''}
            </option>
          ))}
          <option value={NOVA_PESSOA}>+ Nova pessoa…</option>
        </Select>
        {donoId === NOVA_PESSOA && <Input autoFocus placeholder="Nome do dono" value={novaPessoa} onChange={(e) => setNovaPessoa(e.target.value)} />}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Dia de fechamento" htmlFor="k-fech" hint="Compras a partir desse dia vão para a próxima fatura.">
          <NumberInput id="k-fech" min={1} max={31} value={fechamento} onChange={setFechamento} />
        </Field>
        <Field label="Dia de vencimento" htmlFor="k-venc">
          <NumberInput id="k-venc" min={1} max={31} value={vencimento} onChange={setVencimento} />
        </Field>
      </div>
      <Field label="Responsável padrão pelo rateio" hint="Pré-selecionado ao lançar compras nesse cartão.">
        <Segmented
          value={responsavel}
          onChange={setResponsavel}
          options={[
            { value: 'denilson', label: 'Denilson', className: 'text-denilson' },
            { value: 'casal', label: 'Casal 50/50', className: 'text-casal' },
            { value: 'hevellyn', label: 'Hevellyn', className: 'text-hevellyn' },
          ]}
        />
      </Field>
      <Field label="Cor">
        <SeletorCor value={cor} onChange={setCor} usadas={state.cartoes.map((c) => c.cor)} />
      </Field>
      <Field label="Apelidos (opcional)" htmlFor="k-apel" hint='Ajudam o Smart Input. Ex.: "roxinho, nu".'>
        <Input id="k-apel" value={apelidos} onChange={(e) => setApelidos(e.target.value)} />
      </Field>
      <Button type="submit" size="lg">{inicial ? 'Salvar cartão' : 'Cadastrar cartão'}</Button>
    </form>
  );
}
