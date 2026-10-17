import { useState } from 'react';
import { toast } from 'sonner';
import type { Centavos, FormaPagamento, GastoAvulso, Integrante, Mes, Responsavel, StatusPagamento } from '@/types';
import { useAppState } from '@/store/store';
import { salvarGasto } from '@/store/actions';
import { hojeISO, mesDe, ratear } from '@/lib/finance';
import { moeda, ROTULO_FORMA } from '@/lib/format';
import { uid } from '@/lib/utils';
import { Field } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { MoneyInput } from '@/components/shared/money-input';
import { ResponsavelPicker } from '@/components/shared/responsavel';
import { CategoriaInput } from '@/components/shared/selects';

export interface GastoRascunho {
  id?: string;
  data?: string;
  mesReferencia?: Mes;
  descricao?: string;
  categoria?: string;
  valor?: Centavos;
  formaPagamento?: FormaPagamento;
  responsavel?: Responsavel;
  pagoPor?: Integrante;
  status?: StatusPagamento;
}

const FORMAS: FormaPagamento[] = ['pix', 'boleto', 'debito', 'dinheiro', 'transferencia'];

export function GastoForm({ inicial, onSalvo }: { inicial?: GastoRascunho; onSalvo: () => void }) {
  const state = useAppState();
  const [data, setData] = useState(inicial?.data ?? hojeISO());
  const [mesManual, setMesManual] = useState<Mes | undefined>(inicial?.mesReferencia);
  const [descricao, setDescricao] = useState(inicial?.descricao ?? '');
  const [categoria, setCategoria] = useState(inicial?.categoria ?? 'Outros');
  const [valor, setValor] = useState(inicial?.valor);
  const [forma, setForma] = useState<FormaPagamento>(inicial?.formaPagamento && inicial.formaPagamento !== 'cartao' ? inicial.formaPagamento : 'pix');
  const [responsavel, setResponsavel] = useState<Responsavel>(inicial?.responsavel ?? 'casal');
  const [pagoPor, setPagoPor] = useState<Integrante>(inicial?.pagoPor ?? (inicial?.responsavel === 'hevellyn' ? 'hevellyn' : 'denilson'));
  const [status, setStatus] = useState<StatusPagamento>(inicial?.status ?? 'pago');
  const mesReferencia = mesManual ?? mesDe(data);

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!valor) {
      toast.error('Informe o valor.');
      return;
    }
    const g: GastoAvulso = {
      id: inicial?.id ?? uid(),
      data,
      mesReferencia,
      descricao: descricao.trim() || 'Gasto',
      categoria: categoria.trim() || 'Outros',
      valor,
      formaPagamento: forma,
      responsavel,
      pagoPor,
      ...ratear(valor, responsavel),
      status,
    };
    salvarGasto(g);
    toast.success(inicial?.id ? 'Gasto atualizado' : 'Gasto lançado', { description: `${g.descricao} · ${moeda(valor)} no ${ROTULO_FORMA[forma]}` });
    onSalvo();
  }

  return (
    <form onSubmit={salvar} className="grid gap-4">
      <Field label="Descrição" htmlFor="g-desc">
        <Input id="g-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Feira" required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Valor" htmlFor="g-valor">
          <MoneyInput id="g-valor" value={valor} onChange={setValor} />
        </Field>
        <Field label="Forma de pagamento" htmlFor="g-forma">
          <Select id="g-forma" value={forma} onChange={(e) => setForma(e.target.value as FormaPagamento)}>
            {FORMAS.map((f) => (
              <option key={f} value={f}>
                {ROTULO_FORMA[f]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Data" htmlFor="g-data">
          <Input id="g-data" type="date" value={data} onChange={(e) => setData(e.target.value)} required />
        </Field>
        <Field label="Mês de referência" htmlFor="g-mes">
          <Input id="g-mes" type="month" value={mesReferencia} onChange={(e) => setMesManual(e.target.value || undefined)} />
        </Field>
      </div>
      <Field label="Categoria" htmlFor="g-cat">
        <CategoriaInput id="g-cat" state={state} value={categoria} onChange={setCategoria} />
      </Field>
      <Field label="Quem assume o custo?">
        <ResponsavelPicker value={responsavel} onChange={setResponsavel} valor={valor} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Quem pagou do bolso?" hint="Usado no acerto do casal.">
          <Segmented
            value={pagoPor}
            onChange={setPagoPor}
            options={[
              { value: 'denilson', label: 'Denilson', className: 'text-denilson' },
              { value: 'hevellyn', label: 'Hevellyn', className: 'text-hevellyn' },
            ]}
          />
        </Field>
        <Field label="Status">
          <Segmented
            value={status}
            onChange={setStatus}
            options={[
              { value: 'pago', label: 'Pago' },
              { value: 'aberto', label: 'A pagar' },
            ]}
          />
        </Field>
      </div>
      <Button type="submit" size="lg">
        {inicial?.id ? 'Salvar alterações' : 'Lançar gasto'}
      </Button>
    </form>
  );
}
