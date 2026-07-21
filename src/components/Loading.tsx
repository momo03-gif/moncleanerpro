// Indicateur de chargement sobre et réutilisable (charte : discret, pas d'effet
// « IA »). Deux variantes :
//   • 'spinner' (défaut) : petit rond qui tourne + « Chargement… » — pour les
//     emplacements en ligne / compacts.
//   • 'skeleton' : cartes grisées animées (effet « shimmer ») — pour les grandes
//     listes (planning, missions…). L'app paraît plus rapide pendant le chargement.

interface Props {
  className?: string;
  variant?: 'spinner' | 'skeleton';
  rows?: number;   // squelette : nombre de cartes fantômes (défaut 4)
}

export default function Loading({ className = '', variant = 'spinner', rows = 4 }: Props) {
  if (variant === 'skeleton') {
    return (
      <div role="status" aria-live="polite" aria-label="Chargement" className={className}>
        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="rounded-2xl border overflow-hidden" style={{ borderColor: '#EDEAE3', backgroundColor: '#FFFFFF' }}>
              <div className="px-5 py-4 space-y-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="mcp-sk" style={{ width: '45%', height: 14, borderRadius: 6 }} />
                  <span className="mcp-sk" style={{ width: 64, height: 22, borderRadius: 999 }} />
                </div>
                <span className="mcp-sk block" style={{ width: '70%', height: 11, borderRadius: 6 }} />
                <div className="flex gap-2 pt-1">
                  <span className="mcp-sk" style={{ width: 70, height: 20, borderRadius: 8 }} />
                  <span className="mcp-sk" style={{ width: 54, height: 20, borderRadius: 8 }} />
                </div>
              </div>
            </div>
          ))}
        </div>
        <style>{`
          .mcp-sk {
            display: inline-block;
            background: linear-gradient(90deg, #F2EFE9 25%, #EAE6DE 37%, #F2EFE9 63%);
            background-size: 400% 100%;
            animation: mcp-shimmer 1.4s ease-in-out infinite;
          }
          @keyframes mcp-shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }
          @media (prefers-reduced-motion: reduce) { .mcp-sk { animation: none; } }
        `}</style>
      </div>
    );
  }

  return (
    <div role="status" aria-live="polite" className={`flex items-center gap-2 text-sm ${className}`} style={{ color: '#A8A09A' }}>
      <span
        aria-hidden="true"
        className="animate-spin"
        style={{ width: 14, height: 14, border: '2px solid #E8E4DC', borderTopColor: '#C9A84C', borderRadius: '50%', display: 'inline-block', flexShrink: 0 }}
      />
      <span>Chargement…</span>
    </div>
  );
}
