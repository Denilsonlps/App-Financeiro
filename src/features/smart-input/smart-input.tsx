import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, CheckCircle2, Mic, Sparkles, Square, Wand2 } from 'lucide-react';
import { useAppState } from '@/store/store';
import { parseSmartInput, type ResultadoParse, type TipoLancamento } from '@/lib/smart-parser';
import { mesDe } from '@/lib/finance';
import { useReconhecimentoVoz } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { EditorLancamento, type Rascunhos } from './editor-lancamento';

// ------------------------------------------------------------ Contexto global

interface LancamentoCtx {
  /** Abre o Smart Input (texto/voz). */
  abrirSmart: (opts?: { ouvir?: boolean }) => void;
  /** Abre o formulário manual direto, opcionalmente com valores. */
  abrirEditor: (tipo: TipoLancamento, rascunhos?: Rascunhos, opts?: { travarTipo?: boolean; titulo?: string }) => void;
}
const Ctx = createContext<LancamentoCtx>({ abrirSmart: () => {}, abrirEditor: () => {} });
export const useLancamento = () => useContext(Ctx);

export function LancamentoProvider({ children }: { children: React.ReactNode }) {
  const [smart, setSmart] = useState<{ aberto: boolean; ouvir: boolean }>({ aberto: false, ouvir: false });
  const [editor, setEditor] = useState<{ aberto: boolean; tipo: TipoLancamento; rascunhos?: Rascunhos; travarTipo?: boolean; titulo?: string; chave: number }>({
    aberto: false,
    tipo: 'cartao',
    chave: 0,
  });

  const abrirSmart = useCallback((opts?: { ouvir?: boolean }) => setSmart({ aberto: true, ouvir: !!opts?.ouvir }), []);
  const abrirEditor = useCallback<LancamentoCtx['abrirEditor']>(
    (tipo, rascunhos, opts) => setEditor((e) => ({ aberto: true, tipo, rascunhos, travarTipo: opts?.travarTipo, titulo: opts?.titulo, chave: e.chave + 1 })),
    [],
  );

  // Atalho: Ctrl/Cmd + K abre o Smart Input
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        abrirSmart();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [abrirSmart]);

  const fecharEditor = useCallback(() => setEditor((e) => ({ ...e, aberto: false })), []);
  const fecharSmart = useCallback(() => setSmart({ aberto: false, ouvir: false }), []);

  return (
    <Ctx.Provider value={{ abrirSmart, abrirEditor }}>
      {children}
      <Dialog open={editor.aberto} onOpenChange={(o) => !o && fecharEditor()} title={editor.titulo ?? 'Novo lançamento'}>
        <EditorLancamento
          key={editor.chave}
          tipo={editor.tipo}
          onTipo={(tipo) => setEditor((e) => ({ ...e, tipo }))}
          rascunhos={editor.rascunhos}
          travarTipo={editor.travarTipo}
          onSalvo={fecharEditor}
        />
      </Dialog>
      {smart.aberto && <SmartInputDialog ouvirAoAbrir={smart.ouvir} onClose={fecharSmart} />}
    </Ctx.Provider>
  );
}

// ------------------------------------------------------------ Smart Input

const EXEMPLOS = [
  'Paguei 123 reais em Livros de Filosofia no Nubank do Ramon parcelado em 4 vezes pro Denilson pagar',
  'Mercado 350,90 no Itaú da Hevellyn dividido',
  'Feira 80 reais no pix, a Hevellyn pagou, meio a meio',
  'Spotify 21,90 todo mês no Nubank do Denilson',
  'Geladeira R$ 3.899 no cartão do pai em 10x',
];

export function paraRascunhos(r: ResultadoParse): Rascunhos {
  return {
    cartao: {
      data: r.data,
      descricao: r.descricao,
      categoria: r.categoria,
      cartaoId: r.cartaoId,
      valorTotal: r.valorTotal,
      parcelas: r.parcelas,
      responsavel: r.responsavel,
    },
    avulso: {
      data: r.data,
      mesReferencia: mesDe(r.data),
      descricao: r.descricao,
      categoria: r.categoria,
      valor: r.valorTotal,
      formaPagamento: r.formaPagamento === 'cartao' ? 'pix' : r.formaPagamento,
      responsavel: r.responsavel,
      pagoPor: r.pagoPor,
    },
    recorrente: {
      descricao: r.descricao,
      categoria: r.categoria,
      valor: r.valorTotal,
      formaPagamento: r.formaPagamento,
      cartaoId: r.cartaoId,
      diaVencimento: Number(r.data.slice(8, 10)),
      responsavel: r.responsavel,
      pagoPor: r.pagoPor,
      inicio: mesDe(r.data),
    },
  };
}

function SmartInputDialog({ ouvirAoAbrir, onClose }: { ouvirAoAbrir: boolean; onClose: () => void }) {
  const state = useAppState();
  const [texto, setTexto] = useState('');
  const [confirmado, setConfirmado] = useState<{ r: ResultadoParse; tipo: TipoLancamento } | null>(null);

  const ctx = useMemo(() => ({ pessoas: state.pessoas, cartoes: state.cartoes, categorias: state.categorias }), [state.pessoas, state.cartoes, state.categorias]);
  const previa = useMemo(() => (texto.trim().length >= 3 ? parseSmartInput(texto, ctx) : null), [texto, ctx]);

  const processar = useCallback(
    (frase: string, origem: 'voz' | 'texto') => {
      const r = parseSmartInput(frase, ctx);
      if (!r.valorTotal) {
        toast.warning('Não consegui entender o valor', { description: 'Tente algo como "45 reais" ou "R$ 45,90".' });
        return;
      }
      setConfirmado({ r, tipo: r.tipo });
      toast.success(origem === 'voz' ? 'Áudio processado!' : 'Frase interpretada!', {
        description: `${r.campos.filter((c) => c.trecho).length} campos preenchidos. Confira e salve.`,
      });
    },
    [ctx],
  );

  const voz = useReconhecimentoVoz((final) => {
    setTexto(final);
    processar(final, 'voz');
  });

  useEffect(() => {
    if (ouvirAoAbrir && voz.disponivel) voz.iniciar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      className="max-w-xl"
      title={
        <span className="inline-flex items-center gap-2">
          <Sparkles className="size-5 text-primary" /> Smart Input
        </span>
      }
      description={confirmado ? 'Confira o que eu entendi antes de salvar.' : 'Fale ou digite o gasto do jeito que você falaria para alguém.'}
    >
      {confirmado ? (
        <div className="grid gap-4">
          <div className="flex items-start gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div className="grid gap-1">
              <p className="font-medium">Entendi! Preenchi o formulário para você.</p>
              <p className="text-muted-foreground">“{confirmado.r.textoInterpretado}”</p>
              {confirmado.r.avisos.map((a) => (
                <p key={a} className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="size-3.5" /> {a}
                </p>
              ))}
            </div>
          </div>
          <EditorLancamento
            tipo={confirmado.tipo}
            onTipo={(tipo) => setConfirmado({ ...confirmado, tipo })}
            rascunhos={paraRascunhos(confirmado.r)}
            onSalvo={onClose}
          />
          <Button variant="ghost" onClick={() => setConfirmado(null)}>
            <ArrowLeft /> Voltar e reescrever
          </Button>
        </div>
      ) : (
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (texto.trim()) processar(texto, 'texto');
          }}
        >
          <div className="relative">
            <Textarea
              value={voz.ouvindo ? voz.parcial : texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (texto.trim()) processar(texto, 'texto');
                }
              }}
              placeholder="Ex.: Paguei 123 reais em livros no Nubank do Ramon em 4x pro Denilson pagar"
              className="min-h-[110px] pr-14 text-base"
              readOnly={voz.ouvindo}
            />
            <button
              type="button"
              onClick={voz.ouvindo ? voz.parar : voz.iniciar}
              disabled={!voz.disponivel}
              title={voz.disponivel ? (voz.ouvindo ? 'Parar' : 'Falar') : 'Ditado não suportado neste navegador'}
              className={cn(
                'absolute bottom-3 right-3 grid size-10 place-items-center rounded-full transition-colors disabled:opacity-40',
                voz.ouvindo ? 'animate-pulse-ring bg-red-500 text-white' : 'bg-primary text-primary-foreground hover:bg-primary/90',
              )}
              aria-label={voz.ouvindo ? 'Parar gravação' : 'Gravar áudio'}
            >
              {voz.ouvindo ? <Square className="size-4" /> : <Mic className="size-5" />}
            </button>
          </div>
          {voz.ouvindo && <p className="text-sm text-red-600 dark:text-red-400">Ouvindo… fale o gasto e faça uma pausa no final.</p>}
          {voz.erro && <p className="text-sm text-destructive">{voz.erro}</p>}

          {previa ? (
            <div className="grid gap-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Entendendo em tempo real</span>
                <span className="tabular">{Math.round(previa.confianca * 100)}% completo</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {previa.campos.map((c) => (
                  <Badge key={c.campo} variant={c.trecho ? 'success' : 'secondary'} title={c.trecho ? `De: “${c.trecho}”` : 'Sugerido'}>
                    <span className="opacity-70">{c.campo}:</span> {c.valor}
                  </Badge>
                ))}
                <Badge variant={previa.responsavel}>
                  <span className="opacity-70">Rateio:</span>{' '}
                  {previa.responsavel === 'casal' ? '50/50' : previa.responsavel === 'denilson' ? 'Denilson' : 'Hevellyn'}
                  {previa.responsavelOrigem !== 'explicito' && ' (padrão)'}
                </Badge>
              </div>
            </div>
          ) : (
            <div className="grid gap-2">
              <p className="text-xs font-medium text-muted-foreground">Experimente:</p>
              <div className="flex flex-col gap-1.5">
                {EXEMPLOS.map((ex) => (
                  <button key={ex} type="button" onClick={() => setTexto(ex)} className="rounded-md border px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Button type="submit" size="lg" disabled={!texto.trim() || voz.ouvindo}>
            <Wand2 /> Interpretar e preencher
          </Button>
        </form>
      )}
    </Dialog>
  );
}
