import { useState } from 'react';
import { toast } from 'sonner';
import type { Centavos, ContaRecorrente, FormaPagamento, Integrante, Mes, Responsavel } from '@/types';
import { useAppState } from '@/store/store';
import { salvarRecorrente } from '@/store/actions';
import { mesAtual } from '@/lib/finance';
import { moeda, ROTULO_FORMA } from '@/lib/format';
import { uid } from '@/lib/utils';
import { Field } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { MoneyInput } from '@/components/shared/money-input';
import { ResponsavelPicker } from '@/components/shared/responsavel';
import { CartaoSelect, CategoriaInput } from '@/components/shared/selects';

export type RecorrenteRascunho = Partial<ContaRecorrente>;

const FORMAS: FormaPagamento[] = ['boleto', 'pix', 'debito', 'cartao', 'transferencia', 'dinheiro'];

export function RecorrenteForm({ inicial, onSalvo }: { inicial?: RecorrenteRascunho; onSalvo: () => void }) {
  const state = useAppState();
  const [descricao, setDescricao] = useState(inicial?.descricao ?? '');
  const [categoria, setCategoria] = useState(inicial?.categoria ?? 'Contas de Casa');
  const [valor, setValor] = useState<Centavos | undefined>(inicial?.valor);
  const [forma, setForma] = useState<FormaPagamento>(inicial?.formaPagamento ?? (inicial?.cartaoId ? 'cartao' : 'boleto'));
  const [cartaoId, setCartaoId] = useState(inicial?.cartaoId);
  const [dia, setDia] = useState(inicial?.diaVencimento ?? 10);
  const [responsavel, setResponsavel] = useState<Responsavel>(inicial?.responsavel ?? 'casal');
  const [pagoPor, setPagoPor] = useState<Integrante>(inicial?.pagoPor ?? 'denilson');
  const [inicio, setInicio] = useState<Mes>(inicial?.inicio ?? mesAtual());
  const [fim, setFim] = useState<Mes | ''>(inicial?.fim ?? '');

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!valor) return void toast.error('Informe o valor.');
    if (forma === 'cartao' && !cartaoId) return void toast.error('Escolha o cartão em que a conta é cobrada.');
    if (fim && fim < inicio) return void toast.error('O fim deve ser depois do início.');
    const r: ContaRecorrente = {
      id: inicial?.id ?? uid(),
      descricao: descricao.trim() || 'Conta',
      categoria: categoria.trim() || 'Outros',
      valor,
      formaPagamento: forma,
      cartaoId: forma === 'cartao' ? cartaoId : undefined,
      diaVencimento: dia,
      responsavel,
      pagoPor,
      inicio,
      fim: fim || null,
      ativo: inicial?.ativo ?? true,
    };
    salvarRecorrente(r);
    toast.success(inicial?.id ? 'Conta atualizada' : 'Conta recorrente criada', { description: `${r.descricao} · ${moeda(valor)}/mês` });
    onSalvo();
  }

  return (
    <form onSubmit={salvar} className="grid gap-4">
      <Field label="Descrição" htmlFor="r-desc">
        <Input id="r-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Internet Fibra" required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Valor mensal" htmlFor="r-valor">
          <MoneyInput id="r-valor" value={valor} onChange={setValor} />
        </Field>
        <Field label="Dia de vencimento" htmlFor="r-dia">
          <Input id="r-dia" type="number" min={1} max={31} value={dia} onChange={(e) => setDia(Math.max(1, Math.min(31, +e.target.value || 1)))} />
        </Field>
      </div>
      <Field label="Forma de pagamento" htmlFor="r-forma">
        <Select id="r-forma" value={forma} onChange={(e) => setForma(e.target.value as FormaPagamento)}>
          {FORMAS.map((f) => (
            <option key={f} value={f}>
              {ROTULO_FORMA[f]}
            </option>
          ))}
        </Select>
      </Field>
      {forma === 'cartao' ? (
        <Field label="Cobrada no cartão" htmlFor="r-cartao" hint="Entra automaticamente na fatura desse cartão todo mês.">
          <CartaoSelect id="r-cartao" state={state} value={cartaoId} onChange={setCartaoId} />
        </Field>
      ) : (
        <Field label="Quem paga a conta?" hint="Usado no acerto do casal.">
          <Segmented
            value={pagoPor}
            onChange={setPagoPor}
            options={[
              { value: 'denilson', label: 'Denilson', className: 'text-denilson' },
              { value: 'hevellyn', label: 'Hevellyn', className: 'text-hevellyn' },
            ]}
          />
        </Field>
      )}
      <Field label="Categoria" htmlFor="r-cat">
        <CategoriaInput id="r-cat" state={state} value={categoria} onChange={setCategoria} />
      </Field>
      <Field label="Rateio">
        <ResponsavelPicker value={responsavel} onChange={setResponsavel} valor={valor} sufixo="/mês" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Início" htmlFor="r-ini">
          <Input id="r-ini" type="month" value={inicio} onChange={(e) => setInicio(e.target.value)} required />
        </Field>
        <Field label="Fim (opcional)" htmlFor="r-fim" hint="Vazio = sem prazo.">
          <Input id="r-fim" type="month" value={fim} onChange={(e) => setFim(e.target.value)} />
        </Field>
      </div>
      <Button type="submit" size="lg">
        {inicial?.id ? 'Salvar alterações' : 'Criar conta recorrente'}
      </Button>
    </form>
  );
}
