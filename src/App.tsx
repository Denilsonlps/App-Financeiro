import { Toaster } from 'sonner';
import { MesProvider } from '@/components/shared/mes-context';
import { AppShell, NavSecundariaMobile, useRota } from '@/components/layout/app-shell';
import { LancamentoProvider } from '@/features/smart-input/smart-input';
import { DashboardPage } from '@/features/dashboard/dashboard-page';
import { LancamentosPage } from '@/features/lancamentos/lancamentos-page';
import { GastosPage } from '@/features/gastos/gastos-page';
import { RecorrentesPage } from '@/features/recorrentes/recorrentes-page';
import { CartoesPage } from '@/features/cartoes/cartoes-page';
import { ConfiguracoesPage } from '@/features/configuracoes/configuracoes-page';
import { useTema } from '@/lib/hooks';

export default function App() {
  const rota = useRota();
  const { dark } = useTema();
  return (
    <MesProvider>
      <LancamentoProvider>
        <AppShell rota={rota}>
          <NavSecundariaMobile rota={rota} />
          {rota === 'painel' && <DashboardPage />}
          {rota === 'cartao' && <LancamentosPage />}
          {rota === 'avulsos' && <GastosPage />}
          {rota === 'recorrentes' && <RecorrentesPage />}
          {rota === 'cartoes' && <CartoesPage />}
          {rota === 'config' && <ConfiguracoesPage />}
        </AppShell>
        <Toaster richColors position="top-center" theme={dark ? 'dark' : 'light'} />
      </LancamentoProvider>
    </MesProvider>
  );
}
