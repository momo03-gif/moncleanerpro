// Indicateur de chargement sobre et réutilisable (charte : discret, pas d'effet
// « IA »). Remplace les anciens « Chargement... » en texte brut. Le `className`
// reprend l'espacement de l'emplacement d'origine.
export default function Loading({ className = '' }: { className?: string }) {
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
