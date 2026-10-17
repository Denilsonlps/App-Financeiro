import * as React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/** Dialog modal (API inspirada no shadcn). Fecha com Esc ou clique fora. */
export function Dialog({ open, onOpenChange, title, description, children, className }: DialogProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onOpenChange(false);
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.querySelector<HTMLElement>('input, textarea, select')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [open, onOpenChange]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 animate-fade-in bg-black/60 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative z-10 flex max-h-[92dvh] w-full max-w-lg animate-zoom-in flex-col rounded-t-2xl border bg-background shadow-xl sm:rounded-2xl',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b p-5">
          <div className="grid gap-1">
            <h2 className="text-lg font-semibold leading-none">{title}</h2>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          <button onClick={() => onOpenChange(false)} className="rounded-md p-1 opacity-70 hover:bg-accent hover:opacity-100" aria-label="Fechar">
            <X className="size-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
