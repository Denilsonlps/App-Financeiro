import { useRef } from 'react';
import { toast } from 'sonner';
import { Database, Download, RotateCcw, Upload } from 'lucide-react';
import { exportarJSON, importarJSON, restaurar } from '@/store/actions';
import { useAppState } from '@/store/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/page';

export function ConfiguracoesPage() {
  const state = useAppState();
  const arquivo = useRef<HTMLInputElement>(null);

  function baixar() {
    const blob = new Blob([exportarJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `financeiro-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success('Backup baixado');
  }

  return (
    <div className="grid grid-cols-1 gap-4">
      <PageHeader title="Configurações" description="Backup, restauração e dados de exemplo." />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Database className="size-4" /> Seus dados</CardTitle>
          <CardDescription>
            Tudo fica salvo neste navegador (LocalStorage): {state.cartoes.length} cartões, {state.compras.length} compras, {state.gastos.length} gastos avulsos e{' '}
            {state.recorrentes.length} contas recorrentes. Faça backups com frequência.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button onClick={baixar}><Download /> Exportar backup (.json)</Button>
          <Button variant="outline" onClick={() => arquivo.current?.click()}><Upload /> Importar backup</Button>
          <input
            ref={arquivo}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (!confirm('Importar vai substituir todos os dados atuais. Continuar?')) return;
              const erro = importarJSON(await f.text());
              erro ? toast.error(erro) : toast.success('Backup importado');
              e.target.value = '';
            }}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><RotateCcw className="size-4" /> Recomeçar</CardTitle>
          <CardDescription>Restaurar os dados de exemplo ou começar com o app vazio (mantém Denilson e Hevellyn).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => confirm('Substituir tudo pelos dados de exemplo?') && (restaurar('demo'), toast.success('Dados de exemplo carregados'))}>
            Carregar exemplo
          </Button>
          <Button variant="destructive" onClick={() => confirm('Apagar TODOS os dados? Essa ação não pode ser desfeita.') && (restaurar('vazio'), toast.success('Tudo limpo'))}>
            Começar do zero
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
