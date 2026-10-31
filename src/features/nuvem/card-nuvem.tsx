import { useState } from 'react';
import { toast } from 'sonner';
import { Cloud, Copy, LogOut, RefreshCw, Trash2 } from 'lucide-react';
import { descartarPendencias, recarregar, temPendencias, useStatusSync } from '@/store/sync';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useNuvem } from './nuvem-context';
import { IndicadorSync } from './indicador-sync';

export function CardNuvem() {
  const nuvem = useNuvem();
  const { erro } = useStatusSync();
  const [girando, setGirando] = useState(false);

  if (nuvem.modo === 'local') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Cloud className="size-4" /> Nuvem desativada
          </CardTitle>
          <CardDescription>
            Os dados ficam só neste navegador. Para sincronizar entre aparelhos, configure o Supabase (variáveis <code>VITE_SUPABASE_URL</code> e{' '}
            <code>VITE_SUPABASE_ANON_KEY</code>). O passo a passo está no README.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const codigo = nuvem.lar!.codigoConvite;
  const copiar = async () => {
    const texto = `Entre no nosso Painel do Casal: ${window.location.origin}\nCódigo de convite: ${codigo}`;
    try {
      if (navigator.share) await navigator.share({ text: texto });
      else {
        await navigator.clipboard.writeText(texto);
        toast.success('Convite copiado');
      }
    } catch {
      /* usuário cancelou o compartilhamento */
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Cloud className="size-4" /> {nuvem.lar!.nome}
          <span className="ml-auto">
            <IndicadorSync />
          </span>
        </CardTitle>
        <CardDescription>
          Conectado como <strong className="text-foreground">{nuvem.email}</strong>. Tudo que vocês lançam aparece nos aparelhos dos dois.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {erro && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">Último erro: {erro}</p>}
        <div className="grid gap-2 rounded-lg border p-3">
          <p className="text-sm font-medium">Código de convite</p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded-md bg-muted px-3 py-1.5 font-mono text-lg tracking-widest">{codigo}</code>
            <Button variant="outline" size="sm" onClick={copiar}>
              <Copy /> Enviar convite
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                if (!confirm('Gerar um novo código? O atual deixa de funcionar (quem já entrou continua no lar).')) return;
                try {
                  await nuvem.novoCodigo();
                  toast.success('Novo código gerado');
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : String(e));
                }
              }}
            >
              Gerar outro
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">A outra pessoa cria a conta dela, escolhe “Já tenho um código de convite” e digita este código.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              setGirando(true);
              try {
                await recarregar();
                toast.success('Dados atualizados');
              } catch (e) {
                toast.error(e instanceof Error ? e.message : String(e));
              } finally {
                setGirando(false);
              }
            }}
          >
            <RefreshCw className={girando ? 'animate-spin' : ''} /> Sincronizar agora
          </Button>
          {temPendencias() && (
            <Button
              variant="outline"
              onClick={async () => {
                if (!confirm('Descartar as alterações deste aparelho que não chegaram à nuvem?')) return;
                await descartarPendencias();
                toast.success('Alterações descartadas');
              }}
            >
              <Trash2 /> Descartar não enviadas
            </Button>
          )}
          <Button variant="ghost" onClick={() => void nuvem.sair()}>
            <LogOut /> Sair
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
