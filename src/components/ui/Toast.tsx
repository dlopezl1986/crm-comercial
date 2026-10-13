import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { WRITE_ERROR_EVENT } from '@/services/commit';
import { CheckCircle2, XCircle } from 'lucide-react';

type Kind = 'success' | 'error';
interface ToastItem { id: number; kind: Kind; text: string }

const ToastContext = createContext<(text: string, kind?: Kind) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const show = useCallback((text: string, kind: Kind = 'success') => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs, { id, kind, text }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 3500);
  }, []);
  useEffect(() => {
    const onErr = () => show('El servidor no ha aceptado un cambio. Recarga la página y revisa el último cambio.', 'error');
    window.addEventListener(WRITE_ERROR_EVENT, onErr);
    return () => window.removeEventListener(WRITE_ERROR_EVENT, onErr);
  }, [show]);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toasts">
        {items.map((t) => (
          <div key={t.id} className={`toast toast--${t.kind}`}>
            {t.kind === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
