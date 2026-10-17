import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

// Tema compartilhado entre componentes (a classe "dark" no <html> é a fonte da verdade)
const ouvintesTema = new Set<() => void>();
const temaEscuro = () => document.documentElement.classList.contains('dark');

export function useTema() {
  const dark = useSyncExternalStore(
    (fn) => {
      ouvintesTema.add(fn);
      return () => ouvintesTema.delete(fn);
    },
    temaEscuro,
  );
  const alternar = useCallback(() => {
    const novo = !temaEscuro();
    document.documentElement.classList.toggle('dark', novo);
    try {
      localStorage.setItem('financeiro:tema', novo ? 'dark' : 'light');
    } catch {
      /* sem storage */
    }
    ouvintesTema.forEach((fn) => fn());
  }, []);
  return { dark, alternar };
}

// ---------------------------------------------------------- Speech-to-Text

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function criarReconhecedor(): SpeechRecognitionLike | null {
  const w = window as unknown as Record<string, new () => SpeechRecognitionLike>;
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

const ERROS_VOZ: Record<string, string> = {
  'not-allowed': 'Permissão do microfone negada. Libere o acesso nas configurações do navegador.',
  'no-speech': 'Não ouvi nada. Tente de novo, mais perto do microfone.',
  'audio-capture': 'Nenhum microfone encontrado.',
  network: 'O reconhecimento de voz do navegador precisa de internet.',
};

/**
 * Reconhecimento de voz via Web Speech API (Chrome, Edge, Safari) em pt-BR.
 * Entrega texto parcial enquanto o usuário fala e o final em `onFinal`.
 */
export function useReconhecimentoVoz(onFinal: (texto: string) => void) {
  const [ouvindo, setOuvindo] = useState(false);
  const [parcial, setParcial] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const rec = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef('');
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;
  const disponivel = typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const parar = useCallback(() => rec.current?.stop(), []);

  const iniciar = useCallback(() => {
    const r = criarReconhecedor();
    if (!r) {
      setErro('Seu navegador não suporta ditado. Use Chrome/Edge, ou digite a frase.');
      return;
    }
    r.lang = 'pt-BR';
    r.continuous = false;
    r.interimResults = true;
    finalRef.current = '';
    setParcial('');
    setErro(null);
    r.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalRef.current += res[0].transcript;
        else interim += res[0].transcript;
      }
      setParcial((finalRef.current + ' ' + interim).trim());
    };
    r.onerror = (e) => setErro(ERROS_VOZ[e.error] ?? `Erro no reconhecimento de voz (${e.error}).`);
    r.onend = () => {
      setOuvindo(false);
      const texto = finalRef.current.trim();
      if (texto) onFinalRef.current(texto);
    };
    rec.current = r;
    r.start();
    setOuvindo(true);
  }, []);

  useEffect(() => () => rec.current?.abort(), []);

  return { disponivel, ouvindo, parcial, erro, iniciar, parar };
}

/** Lê variáveis CSS de cor (ex.: "--denilson") e atualiza ao trocar o tema. Para SVG/Recharts. */
export function useCoresTema<K extends string>(nomes: readonly K[]): Record<K, string> {
  const ler = useCallback(() => {
    const st = getComputedStyle(document.documentElement);
    return Object.fromEntries(nomes.map((n) => [n, `hsl(${st.getPropertyValue(`--${n}`).trim()})`])) as Record<K, string>;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nomes.join()]);
  const [cores, setCores] = useState(ler);
  useEffect(() => {
    const obs = new MutationObserver(() => setCores(ler()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, [ler]);
  return cores;
}
