import * as React from 'react';
import { cn } from '@/lib/utils';

export const Label = ({ className, ...p }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
  <label className={cn('text-sm font-medium leading-none text-foreground/90', className)} {...p} />
);

/** Label + controle + dica, empilhados. */
export function Field({ label, htmlFor, hint, className, children }: { label: string; htmlFor?: string; hint?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('grid content-start gap-1.5', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
