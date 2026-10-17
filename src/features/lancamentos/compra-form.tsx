import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Centavos, Compra, Mes, Responsavel } from '@/types';
import { useAppState } from '@/store/store';
import { salvarCompra } from '@/store/actions';
import { calcularMesFatura, dividirParcelas, hojeISO, somarMeses } from '@/lib/finance';
import { mesLongo, moeda } from '@/lib/format';
import { uid } from '@/lib/utils';
import { Field } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MoneyInput } from '@/components/shared/money-input';
import { ResponsavelPicker } from '@/components/shared/responsavel';
import { CartaoSelect, CategoriaInput } from '@/components/shared/selects';

export interface CompraRascunho {
  id?: string;
  data?: string;
  descricao?: string;
  categoria?: string;
  cartaoId?: string;
  valorTotal?: Centavos;
  parcelas?: number;
  responsavel?: Responsavel;
  mesPrimeiraFatura?: Mes;
}

export function CompraForm({ inicial, onSalvo }: { inicial?: CompraRascunho; onSalvo: () => void }) {
  const state = useAppState();
  const [data, setData] = useState(inicial?.data ?? hojeISO());
  const [descricao, setDescricao] = useState(inicial?.descricao ?? '');
  const [categoria, setCategoria] = useState(inicial?.categoria ?? 'Outros');
  const [cartaoId, setCartaoId] = useState(inicial?.cartaoId);
  const [valorTotal, setValorTotal] = useState(inicial?.valorTotal);
  const [parcelas, setParcelas] = useState(inicial?.parcelas ?? 1);
  const cartaoInicial = state.cartoes.find((c) => c.id === inicial?.cartaoId);
  const [responsavel, setResponsavel] = useState<Responsavel>(inicial?.responsavel ?? cartaoInicial?.responsavelPadrao ?? 'casal');
  const [respTocado, setRespTocado] = useState(!!inicial?.responsavel);
  const [mesManual, setMesManual] = useState<Mes | undefined>(inicial?.id ? inicial.mesPrimeiraFatura : undefined);

  const cartao = state.cartoes.find((c) => c.id === cartaoId);
  const mesAuto = cartao && data ? calcularMesFatura(data, cartao) : undefined;
  const mesFatura = mesManual ?? mesAuto;
  const valoresParcela = useMemo(() => (valorTotal ? dividirParcelas(valorTotal, parcelas) : []), [valorTotal, parcelas]);

  function trocarCartao(id: string) {
    setCartaoId(id);
    const c = state.cartoes.find((x) => x.id === id);
    if (c && !respTocado) setResponsavel(c.responsavelPadrao);
  }

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!cartaoId || !valorTotal || !mesFatura) {
      toast.error('Preencha valor e cartão.');
      return;
    }
    const compra: Compra = {
      id: inicial?.id ?? uid(),
      data,
      descricao: descricao.trim() || 'Compra',
      categoria: categoria.trim() || 'Outros',
      cartaoId,
      valorTotal,
      parcelas,
      responsavel,
      mesPrimeiraFatura: mesFatura,
      criadoEm: new Date().toISOString(),
    };
    salvarCompra(compra);
    toast.success(inicial?.id ? 'Compra atualizada' : 'Compra lançada', {
      description: `${compra.descricao} · ${parcelas > 1 ? `${parcelas}x de ${moeda(valoresParcela[1] ?? valoresParcela[0])}` : moeda(valorTotal)}`,
    });
    onSalvo();
  }

  return (
    <form onSubmit={salvar} className="grid gap-4">
      <Field label="Descrição" htmlFor="c-desc">
        <Input id="c-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: Livros de Filosofia" required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Valor total" htmlFor="c-valor">
          <MoneyInput id="c-valor" value={valorTotal} onChange={setValorTotal} />
        </Field>
        <Field
          label="Parcelas"
          htmlFor="c-parc"
          hint={valorTotal && parcelas > 1 ? `${parcelas}x de ${moeda(valoresParcela[valoresParcela.length - 1])}` : 'À vista'}
        >
          <Input id="c-parc" type="number" min={1} max={72} value={parcelas} onChange={(e) => setParcelas(Math.max(1, Math.min(72, +e.target.value || 1)))} />
        </Field>
      </div>
      <Field label="Cartão (dono)" htmlFor="c-cartao">
        <CartaoSelect id="c-cartao" state={state} value={cartaoId} onChange={trocarCartao} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Data da compra" htmlFor="c-data">
          <Input id="c-data" type="date" value={data} onChange={(e) => setData(e.target.value)} required />
        </Field>
        <Field
          label="1ª fatura"
          htmlFor="c-mes"
          hint={mesManual ? <button type="button" className="underline" onClick={() => setMesManual(undefined)}>usar automático</button> : cartao ? `Fecha dia ${cartao.diaFechamento}` : undefined}
        >
          <Input id="c-mes" type="month" value={mesFatura ?? ''} onChange={(e) => setMesManual(e.target.value || undefined)} />
        </Field>
      </div>
      <Field label="Categoria" htmlFor="c-cat">
        <CategoriaInput id="c-cat" state={state} value={categoria} onChange={setCategoria} />
      </Field>
      <Field label="Quem paga?" hint={cartao && !respTocado ? 'Padrão do cartão — toque para mudar.' : undefined}>
        <ResponsavelPicker
          value={responsavel}
          onChange={(r) => {
            setResponsavel(r);
            setRespTocado(true);
          }}
          valor={valoresParcela[valoresParcela.length - 1]}
          sufixo={parcelas > 1 ? '/mês' : undefined}
        />
      </Field>
      {mesFatura && parcelas > 1 && (
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          Parcelas de {mesLongo(mesFatura)} até {mesLongo(somarMeses(mesFatura, parcelas - 1))}.
        </p>
      )}
      <Button type="submit" size="lg">
        {inicial?.id ? 'Salvar alterações' : 'Lançar compra'}
      </Button>
    </form>
  );
}

