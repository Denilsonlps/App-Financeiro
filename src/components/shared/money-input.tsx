import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { centavosParaInput, parseMoeda } from '@/lib/format';
import type { Centavos } from '@/types';

/** Campo monetário em R$: aceita "1.234,56", "1234.56" ou "123". */
export function MoneyInput({ value, onChange, id, autoFocus }: { value: Centavos | undefined; onChange: (c: Centavos | undefined) => void; id?: string; autoFocus?: boolean }) {
  const [texto, setTexto] = useState(value ? centavosParaInput(value) : '');
  useEffect(() => {
    const atual = parseMoeda(texto);
    if (value !== (Number.isFinite(atual) ? atual : undefined)) setTexto(value ? centavosParaInput(value) : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
      <Input
        id={id}
        autoFocus={autoFocus}
        inputMode="decimal"
        placeholder="0,00"
        className="tabular pl-9"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          const c = parseMoeda(e.target.value);
          onChange(Number.isFinite(c) && c > 0 ? c : undefined);
        }}
      />
    </div>
  );
}
