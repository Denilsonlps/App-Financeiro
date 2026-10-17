import { useMemo } from 'react';
import { Mic, Sparkles } from 'lucide-react';
import { useAppState } from '@/store/store';
import { acertoCasal, acertoPorDono, itensDoMes, parcelasAVencer, projecao, resumirItens } from '@/lib/finance';
import { useMes } from '@/components/shared/mes-context';
import { useLancamento } from '@/features/smart-input/smart-input';
import { Kpis } from './kpis';
import { Cotas } from './cotas';
import { AcertoDonos } from './acerto-donos';
import { Projecao } from './projecao';
import { ParcelasAVencer } from './parcelas-a-vencer';

export function DashboardPage() {
  const state = useAppState();
  const { mes, setMes } = useMes();
  const { abrirSmart } = useLancamento();

  const itens = useMemo(() => itensDoMes(state, mes), [state, mes]);
  const resumo = useMemo(() => resumirItens(itens), [itens]);
  const acerto = useMemo(() => acertoCasal(state, mes), [state, mes]);
  const donos = useMemo(() => acertoPorDono(state, mes), [state, mes]);
  const proj = useMemo(() => projecao(state, mes, 12), [state, mes]);
  const parcelas = useMemo(() => parcelasAVencer(state, mes), [state, mes]);

  return (
    <div className="grid grid-cols-1 gap-4">
      <button
        onClick={() => abrirSmart()}
        className="group flex items-center gap-3 rounded-xl border border-dashed bg-card p-3 text-left text-sm text-muted-foreground shadow-sm transition-colors hover:border-primary hover:text-foreground"
      >
        <Sparkles className="size-5 text-primary" />
        <span className="min-w-0 flex-1 truncate">Diga ou digite um gasto: “mercado 200 reais no Nubank da Hevellyn dividido”…</span>
        <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium sm:inline">Ctrl K</kbd>
        <span
          role="button"
          onClick={(e) => {
            e.stopPropagation();
            abrirSmart({ ouvir: true });
          }}
          className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground"
          aria-label="Falar"
        >
          <Mic className="size-4" />
        </span>
      </button>

      <Kpis r={resumo} />
      <Cotas r={resumo} itens={itens} acerto={acerto} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <AcertoDonos donos={donos} />
        </div>
        <div className="lg:col-span-2">
          <ParcelasAVencer itens={parcelas} />
        </div>
      </div>

      <Projecao dados={proj} onSelecionarMes={setMes} />
    </div>
  );
}
