import { CreditCard, Repeat, Wallet } from 'lucide-react';
import { Segmented } from '@/components/ui/segmented';
import type { TipoLancamento } from '@/lib/smart-parser';
import { CompraForm, type CompraRascunho } from '@/features/lancamentos/compra-form';
import { GastoForm, type GastoRascunho } from '@/features/gastos/gasto-form';
import { RecorrenteForm, type RecorrenteRascunho } from '@/features/recorrentes/recorrente-form';

export interface Rascunhos {
  cartao?: CompraRascunho;
  avulso?: GastoRascunho;
  recorrente?: RecorrenteRascunho;
}

/** Abas Cartão / PIX-Boleto / Recorrente com o formulário correspondente. */
export function EditorLancamento({
  tipo,
  onTipo,
  rascunhos,
  onSalvo,
  travarTipo,
}: {
  tipo: TipoLancamento;
  onTipo: (t: TipoLancamento) => void;
  rascunhos?: Rascunhos;
  onSalvo: () => void;
  travarTipo?: boolean;
}) {
  return (
    <div className="grid gap-4">
      {!travarTipo && (
        <Segmented
          aria-label="Tipo de lançamento"
          value={tipo}
          onChange={onTipo}
          options={[
            { value: 'cartao', label: <span className="inline-flex items-center gap-1.5"><CreditCard className="size-3.5" />Cartão</span> },
            { value: 'avulso', label: <span className="inline-flex items-center gap-1.5"><Wallet className="size-3.5" />PIX/Boleto</span> },
            { value: 'recorrente', label: <span className="inline-flex items-center gap-1.5"><Repeat className="size-3.5" />Mensal</span> },
          ]}
        />
      )}
      {tipo === 'cartao' && <CompraForm inicial={rascunhos?.cartao} onSalvo={onSalvo} />}
      {tipo === 'avulso' && <GastoForm inicial={rascunhos?.avulso} onSalvo={onSalvo} />}
      {tipo === 'recorrente' && <RecorrenteForm inicial={rascunhos?.recorrente} onSalvo={onSalvo} />}
    </div>
  );
}
