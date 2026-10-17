import { createContext, useContext, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Mes } from '@/types';
import { mesAtual, somarMeses } from '@/lib/finance';
import { mesLongo } from '@/lib/format';
import { Button } from '@/components/ui/button';

const Ctx = createContext<{ mes: Mes; setMes: (m: Mes) => void }>({ mes: mesAtual(), setMes: () => {} });

export function MesProvider({ children }: { children: React.ReactNode }) {
  const [mes, setMes] = useState(mesAtual());
  return <Ctx.Provider value={{ mes, setMes }}>{children}</Ctx.Provider>;
}

export const useMes = () => useContext(Ctx);

export function MesSelector() {
  const { mes, setMes } = useMes();
  const ehAtual = mes === mesAtual();
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" onClick={() => setMes(somarMeses(mes, -1))} aria-label="Mês anterior">
        <ChevronLeft />
      </Button>
      <button
        onClick={() => setMes(mesAtual())}
        className="min-w-[9.5rem] rounded-md px-2 py-1 text-center text-sm font-semibold hover:bg-accent"
        title="Voltar para o mês atual"
      >
        {mesLongo(mes)}
        {!ehAtual && <span className="block text-[10px] font-normal text-muted-foreground">toque para hoje</span>}
      </button>
      <Button variant="ghost" size="icon" onClick={() => setMes(somarMeses(mes, 1))} aria-label="Próximo mês">
        <ChevronRight />
      </Button>
    </div>
  );
}
