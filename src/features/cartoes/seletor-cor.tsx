import { useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

/** Cores das marcas mais comuns + tons neutros. */
export const CORES_PADRAO = [
  '#8a05be', '#a855f7', '#7c3aed', '#4f46e5', '#1d4ed8', '#0ea5e9', '#06b6d4', '#14b8a6',
  '#059669', '#16a34a', '#84cc16', '#fcd500', '#f59e0b', '#ff7a00', '#ec7000', '#ea580c',
  '#dc2626', '#cc092f', '#e11d48', '#db2777', '#111827', '#374151', '#64748b', '#a3a3a3',
];

const HEX = /^#[0-9a-f]{6}$/i;

function Amostra({ cor, ativa, onClick }: { cor: string; ativa: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('grid size-8 place-items-center rounded-full ring-offset-2 ring-offset-background transition hover:scale-110', ativa && 'ring-2 ring-foreground')}
      style={{ backgroundColor: cor }}
      aria-label={`Cor ${cor}`}
      aria-pressed={ativa}
    >
      {ativa && <Check className="size-4 text-white mix-blend-difference" />}
    </button>
  );
}

export function SeletorCor({ value, onChange, usadas }: { value: string; onChange: (c: string) => void; usadas: string[] }) {
  const [hex, setHex] = useState(value);
  const atual = value.toLowerCase();
  const padrao = new Set(CORES_PADRAO);
  // Cores personalizadas já usadas em outros cartões (e a atual, se for nova)
  const extras = [...new Set([...usadas, atual].map((c) => c.toLowerCase()))].filter((c) => HEX.test(c) && !padrao.has(c));

  const escolher = (c: string) => {
    onChange(c.toLowerCase());
    setHex(c.toLowerCase());
  };

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {CORES_PADRAO.map((c) => (
          <Amostra key={c} cor={c} ativa={atual === c} onClick={() => escolher(c)} />
        ))}
      </div>
      {extras.length > 0 && (
        <div className="grid gap-1.5">
          <p className="text-xs text-muted-foreground">Suas cores</p>
          <div className="flex flex-wrap gap-2">
            {extras.map((c) => (
              <Amostra key={c} cor={c} ativa={atual === c} onClick={() => escolher(c)} />
            ))}
          </div>
        </div>
      )}
      <div className="flex items-center gap-2">
        <label
          className="relative grid size-9 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-full border-2 border-dashed border-muted-foreground/50 hover:border-foreground"
          title="Escolher qualquer cor"
          style={HEX.test(hex) ? { backgroundColor: hex } : undefined}
        >
          <Plus className="size-4 text-white mix-blend-difference" />
          <input type="color" value={HEX.test(value) ? value : '#000000'} onChange={(e) => escolher(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Escolher cor personalizada" />
        </label>
        <Input
          value={hex}
          onChange={(e) => {
            let v = e.target.value.trim();
            if (v && !v.startsWith('#')) v = '#' + v;
            setHex(v);
            if (HEX.test(v)) onChange(v.toLowerCase());
          }}
          placeholder="#8a05be"
          maxLength={7}
          className="w-32 font-mono uppercase"
          aria-label="Código hexadecimal da cor"
        />
        <span className="text-xs text-muted-foreground">Toque no + ou digite o código</span>
      </div>
    </div>
  );
}
