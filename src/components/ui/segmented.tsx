import { cn } from '@/lib/utils';

interface Opcao<T extends string> {
  value: T;
  label: React.ReactNode;
  className?: string;
}

/** Grupo de botões exclusivos (equivalente ao ToggleGroup do shadcn). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  'aria-label': ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Opcao<T>[];
  className?: string;
  'aria-label'?: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn('grid gap-1 rounded-lg bg-muted p-1', className)} style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded-md px-2 py-1.5 text-xs font-medium transition-all sm:text-sm',
            value === o.value ? cn('bg-background text-foreground shadow-sm', o.className) : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
