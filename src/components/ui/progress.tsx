import { cn } from '@/lib/utils';

export function Progress({ value, className, barClassName }: { value: number; className?: string; barClassName?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-secondary', className)} role="progressbar" aria-valuenow={Math.round(v)}>
      <div className={cn('h-full rounded-full bg-primary transition-all', barClassName)} style={{ width: `${v}%` }} />
    </div>
  );
}
