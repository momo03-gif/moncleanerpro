'use client';

import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';

// ════════════════════════════════════════════════════════════════════════════
//  Feedback global — remplace les confirm()/alert() natifs (moches sur mobile,
//  hors-charte, bloquants) par des composants in-app cohérents :
//    • toast(...)      → notification éphémère (succès / erreur / info)
//    • confirm(...)    → modale de confirmation stylée, renvoie une Promise<boolean>
//
//  Un seul provider, monté à la racine. Palette alignée sur l'app (or #C9A84C,
//  vert #5A8A6A, rouge #B85A50, fond crème). Aucune dépendance externe.
// ════════════════════════════════════════════════════════════════════════════

type ToastTone = 'success' | 'error' | 'info';
interface Toast { id: number; message: string; tone: ToastTone }

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;   // action destructive → bouton rouge
}

interface FeedbackValue {
  toast: (message: string, tone?: ToastTone) => void;
  confirm: (opts: ConfirmOptions | string) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackValue>({
  toast: () => {},
  confirm: async () => false,
});

export function useFeedback() { return useContext(FeedbackContext); }

const TONE_STYLE: Record<ToastTone, { bg: string; color: string; icon: string }> = {
  success: { bg: '#5A8A6A', color: '#FFFFFF', icon: '✓' },
  error:   { bg: '#B85A50', color: '#FFFFFF', icon: '!' },
  info:    { bg: '#1A1A1A', color: '#FFFFFF', icon: 'i' },
};

interface PendingConfirm extends ConfirmOptions { resolve: (v: boolean) => void }

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const nextId = useRef(1);

  const toast = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = nextId.current++;
    setToasts(prev => [...prev, { id, message, tone }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3200);
  }, []);

  const confirm = useCallback((opts: ConfirmOptions | string) => {
    const normalized: ConfirmOptions = typeof opts === 'string' ? { message: opts } : opts;
    return new Promise<boolean>(resolve => {
      setPending({ ...normalized, resolve });
    });
  }, []);

  function closeConfirm(result: boolean) {
    pending?.resolve(result);
    setPending(null);
  }

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}

      {/* ── Toasts (empilés en haut, au-dessus de tout) ── */}
      <div className="fixed top-0 left-0 right-0 z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}>
        {toasts.map(t => {
          const s = TONE_STYLE[t.tone];
          return (
            <div key={t.id}
              className="pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg w-full max-w-sm"
              style={{ backgroundColor: s.bg, color: s.color, animation: 'mcp-toast-in 0.18s ease-out' }}>
              <span className="w-5 h-5 shrink-0 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ backgroundColor: 'rgba(255,255,255,0.22)' }}>{s.icon}</span>
              <span className="flex-1">{t.message}</span>
            </div>
          );
        })}
      </div>

      {/* ── Modale de confirmation ── */}
      {pending && (
        <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(26,26,26,0.45)', animation: 'mcp-fade-in 0.15s ease-out' }}
          onClick={() => closeConfirm(false)}>
          <div className="w-full max-w-sm rounded-2xl overflow-hidden shadow-xl"
            style={{ backgroundColor: '#FFFFFF', animation: 'mcp-sheet-in 0.2s ease-out' }}
            onClick={e => e.stopPropagation()}>
            <div className="px-5 pt-5 pb-4">
              {pending.title && (
                <h3 className="font-semibold text-base mb-1" style={{ color: '#1A1A1A' }}>{pending.title}</h3>
              )}
              <p className="text-sm leading-snug" style={{ color: '#7A7068' }}>{pending.message}</p>
            </div>
            <div className="flex gap-2 px-5 pb-5">
              <button onClick={() => closeConfirm(false)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold border"
                style={{ borderColor: '#E8E4DC', color: '#7A7068', backgroundColor: '#FFFFFF' }}>
                {pending.cancelLabel ?? 'Annuler'}
              </button>
              <button onClick={() => closeConfirm(true)}
                className="flex-1 py-3 rounded-xl text-sm font-semibold"
                style={{ backgroundColor: pending.danger ? '#B85A50' : '#C9A84C', color: pending.danger ? '#FFFFFF' : '#1A1A1A' }}>
                {pending.confirmLabel ?? 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes mcp-toast-in { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
        @keyframes mcp-fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes mcp-sheet-in { from { opacity: 0; transform: translateY(12px) scale(0.98); } to { opacity: 1; transform: none; } }
      `}</style>
    </FeedbackContext.Provider>
  );
}
