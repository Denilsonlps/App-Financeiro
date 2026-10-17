import type { AppState, Id } from '@/types';
import { Select } from '@/components/ui/select';

/** Select de cartões agrupado por dono (casal primeiro). */
export function CartaoSelect({ state, value, onChange, id, incluirInativos }: { state: AppState; value: Id | undefined; onChange: (id: Id) => void; id?: string; incluirInativos?: boolean }) {
  const donos = [...state.pessoas].sort((a, b) => (a.tipo === b.tipo ? 0 : a.tipo === 'casal' ? -1 : 1));
  return (
    <Select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)} required>
      <option value="" disabled>
        Selecione o cartão…
      </option>
      {donos.map((d) => {
        const cartoes = state.cartoes.filter((c) => c.donoId === d.id && (incluirInativos || c.ativo || c.id === value));
        if (!cartoes.length) return null;
        return (
          <optgroup key={d.id} label={`Cartões de ${d.nome}`}>
            {cartoes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} · {d.nome}
              </option>
            ))}
          </optgroup>
        );
      })}
    </Select>
  );
}

export function CategoriaInput({ state, value, onChange, id }: { state: AppState; value: string; onChange: (v: string) => void; id?: string }) {
  return (
    <>
      <input
        id={id}
        list="lista-categorias"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        placeholder="Ex.: Mercado"
        required
      />
      <datalist id="lista-categorias">
        {state.categorias.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </>
  );
}
