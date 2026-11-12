import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import './toast.css';

export type ToastKind = 'success' | 'error' | 'warning' | 'info';
type Entry = { id: number; kind: ToastKind; message: string };
type ToastApi = Record<ToastKind, (message: string) => void>;
type ToastContextValue = { toast: ToastApi; entries: Entry[]; dismiss: (id: number) => void };
const Context = createContext<ToastContextValue | null>(null);
const timeout: Record<ToastKind, number> = { success: 5000, info: 5000, warning: 7000, error: 9000 };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const counter = useRef(0);
  const dismiss = useCallback((id: number) => setEntries(current => current.filter(item => item.id !== id)), []);
  const add = useCallback((kind: ToastKind, message: string) => {
    if (message.trim()) setEntries(current => [...current.slice(-3), { id: ++counter.current, kind, message: message.trim() }]);
  }, []);
  const toast = useMemo<ToastApi>(() => ({
    success: message => add('success', message),
    error: message => add('error', message),
    warning: message => add('warning', message),
    info: message => add('info', message)
  }), [add]);
  const value = useMemo(() => ({ toast, entries, dismiss }), [toast, entries, dismiss]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
function context() {
  const value = useContext(Context);
  if (!value) throw Error('ToastProvider is missing');
  return value;
}
export function useToast(): ToastApi { return context().toast; }
function ToastItem({ item, dismiss }: { item: Entry; dismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(item.id), timeout[item.kind]);
    return () => window.clearTimeout(timer);
  }, [dismiss, item.id, item.kind]);
  const Icon = item.kind === 'success' ? CheckCircle2 :
    item.kind === 'error' ? AlertCircle : item.kind === 'warning' ? AlertTriangle : Info;
  return <div className={'gs-toast gs-toast-' + item.kind}
    role={item.kind === 'error' || item.kind === 'warning' ? 'alert' : 'status'} aria-atomic="true">
    <span className="gs-toast-icon" aria-hidden="true"><Icon size={18}/></span>
    <div className="gs-toast-message">{item.message}</div>
    <button type="button" className="gs-toast-close" aria-label="Dismiss notification"
      onClick={() => dismiss(item.id)}><X size={16}/></button>
  </div>;
}
/** Exactly one host in the global themed app shell; toasts survive module navigation. */
export function ToastViewport() {
  const { entries, dismiss } = context();
  return <div className="gs-toast-stack" aria-label="Application notifications">
    {entries.map(item => <ToastItem key={item.id} item={item} dismiss={dismiss}/>)}
  </div>;
}
