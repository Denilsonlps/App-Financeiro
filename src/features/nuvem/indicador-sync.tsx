import { CloudAlert, CloudCheck, CloudOff, CloudUpload, Loader2 } from 'lucide-react';
import { useStatusSync } from '@/store/sync';
import { cn } from '@/lib/utils';

const INFO = {
  carregando: { icone: Loader2, texto: 'Atualizando…', cor: 'text-muted-foreground', girar: true },
  sincronizado: { icone: CloudCheck, texto: 'Sincronizado', cor: 'text-emerald-600 dark:text-emerald-400', girar: false },
  enviando: { icone: CloudUpload, texto: 'Salvando…', cor: 'text-muted-foreground', girar: false },
  offline: { icone: CloudOff, texto: 'Offline — salvo neste aparelho', cor: 'text-amber-600 dark:text-amber-400', girar: false },
  erro: { icone: CloudAlert, texto: 'Erro ao sincronizar', cor: 'text-destructive', girar: false },
} as const;

/** Ícone no cabeçalho com o estado da nuvem. Toque leva às Configurações. */
export function IndicadorSync() {
  const { status, erro } = useStatusSync();
  if (status === 'local') return null;
  const { icone: Icone, texto, cor, girar } = INFO[status];
  return (
    <a href="#/config" title={erro ? `${texto}: ${erro}` : texto} className={cn('flex items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-accent', cor)}>
      <Icone className={cn('size-4', girar && 'animate-spin')} />
      <span className="hidden sm:inline">{texto}</span>
    </a>
  );
}
