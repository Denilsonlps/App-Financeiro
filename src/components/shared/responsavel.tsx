import { Heart, User } from 'lucide-react';
import type { Centavos, Responsavel } from '@/types';
import { ratear } from '@/lib/finance';
import { moeda } from '@/lib/format';
import { Segmented } from '@/components/ui/segmented';
import { Badge } from '@/components/ui/badge';

/** Seletor de responsável com prévia do rateio em tempo real. */
export function ResponsavelPicker({
  value,
  onChange,
  valor,
  sufixo,
}: {
  value: Responsavel;
  onChange: (r: Responsavel) => void;
  valor?: Centavos;
  sufixo?: string;
}) {
  const cotas = ratear(valor && Number.isFinite(valor) ? valor : 0, value);
  return (
    <div className="grid gap-2">
      <Segmented
        aria-label="Responsável pelo rateio"
        value={value}
        onChange={onChange}
        options={[
          { value: 'denilson', label: 'Denilson 100%', className: 'text-denilson' },
          { value: 'casal', label: 'Casal 50/50', className: 'text-casal' },
          { value: 'hevellyn', label: 'Hevellyn 100%', className: 'text-hevellyn' },
        ]}
      />
      <div className="grid grid-cols-2 gap-2 text-sm">
        <CotaBox nome="Denilson" valor={cotas.cotaDenilson} cor="denilson" ativo={cotas.cotaDenilson > 0} sufixo={sufixo} />
        <CotaBox nome="Hevellyn" valor={cotas.cotaHevellyn} cor="hevellyn" ativo={cotas.cotaHevellyn > 0} sufixo={sufixo} />
      </div>
    </div>
  );
}

function CotaBox({ nome, valor, cor, ativo, sufixo }: { nome: string; valor: Centavos; cor: 'denilson' | 'hevellyn'; ativo: boolean; sufixo?: string }) {
  return (
    <div className={`rounded-lg border px-3 py-2 transition-opacity ${ativo ? '' : 'opacity-40'}`}>
      <p className={`text-xs font-medium ${cor === 'denilson' ? 'text-denilson' : 'text-hevellyn'}`}>Cota {nome}</p>
      <p className="tabular font-semibold">
        {moeda(valor)}
        {sufixo && <span className="text-xs font-normal text-muted-foreground"> {sufixo}</span>}
      </p>
    </div>
  );
}

export function ResponsavelBadge({ r }: { r: Responsavel }) {
  if (r === 'casal')
    return (
      <Badge variant="casal">
        <Heart className="size-3" /> 50/50
      </Badge>
    );
  return (
    <Badge variant={r}>
      <User className="size-3" /> {r === 'denilson' ? 'Denilson' : 'Hevellyn'}
    </Badge>
  );
}
