import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';

/**
 * Campo inteiro com limites. Guarda o texto digitado (inclusive vazio) e só
 * ajusta para o intervalo ao sair do campo: assim dá para apagar tudo e
 * digitar "25" sem o valor pular para 1 no meio do caminho.
 */
export function NumberInput({ value, onChange, min, max, id }: { value: number; onChange: (n: number) => void; min: number; max: number; id?: string }) {
  const [texto, setTexto] = useState(String(value));

  useEffect(() => {
    if (Number(texto) !== value) setTexto(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Input
      id={id}
      inputMode="numeric"
      pattern="[0-9]*"
      className="tabular"
      value={texto}
      onChange={(e) => {
        const t = e.target.value.replace(/\D/g, '').slice(0, String(max).length);
        setTexto(t);
        const n = Number(t);
        if (t && n >= min && n <= max) onChange(n);
      }}
      onBlur={() => {
        const n = Math.max(min, Math.min(max, Number(texto) || value));
        setTexto(String(n));
        onChange(n);
      }}
    />
  );
}
