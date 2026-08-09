import { REVIEWS, TRUST, GUARANTEE } from '@/lib/proof';

// ════════════════════════════════════════════════════════════════════════════
//  Bandeau de réassurance + engagement de reprise + avis Google.
//  Rendu côté serveur (aucune interactivité) : pas de JS ajouté au chargement.
//  Icônes ligne SVG, aucun emoji — cohérent avec le reste de la vitrine.
// ════════════════════════════════════════════════════════════════════════════

const GOLD = '#C9A84C', INK = '#1A1A1A', CREAM = '#FAFAF8', MUTED = '#7A7068', BORDER = '#E8E4DC';

const ICONS = [
  // Document / devis
  (<><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h4" /></>),
  // Bouclier / assurance
  (<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>),
  // Flèche de reprise / garantie
  (<><path d="M3 12a9 9 0 0 1 15.3-6.4L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15.3 6.4L3 16" /><path d="M3 21v-5h5" /></>),
  // Personne / interlocuteur
  (<><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>),
];

function Star({ filled }: { filled: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"
      fill={filled ? GOLD : 'none'} stroke={GOLD} strokeWidth={1.5} strokeLinejoin="round">
      <path d="m12 3 2.6 5.6 6 .8-4.4 4.2 1.1 6L12 16.8 6.7 19.6l1.1-6L3.4 9.4l6-.8Z" />
    </svg>
  );
}

// Ligne d'avis réutilisable. `tone="dark"` pour les fonds sombres (hero des
// pages SEO) : une note 5/5 sur 36 avis est l'argument le plus fort de la page,
// elle doit être visible à côté du bouton de devis, pas seulement en milieu de page.
export function ReviewsInline({ tone = 'light' }: { tone?: 'light' | 'dark' }) {
  if (!REVIEWS.count) return null;
  const r = REVIEWS.rating;
  const strong = tone === 'dark' ? '#FFFFFF' : INK;
  const soft = tone === 'dark' ? '#B8B2A8' : MUTED;
  const inner = (
    <span className="inline-flex flex-wrap items-center gap-x-2.5 gap-y-1">
      {r !== null && (
        <span className="inline-flex items-center gap-0.5" aria-hidden="true">
          {[1, 2, 3, 4, 5].map(i => <Star key={i} filled={i <= Math.round(r)} />)}
        </span>
      )}
      <span className="text-sm font-semibold" style={{ color: strong }}>
        {r !== null ? `${r.toFixed(1).replace('.', ',')} sur 5` : 'Avis vérifiés'}
      </span>
      <span className="text-sm" style={{ color: soft }}>
        · {REVIEWS.count} avis Google
      </span>
    </span>
  );
  return REVIEWS.url
    ? <a href={REVIEWS.url} target="_blank" rel="noopener noreferrer" className="mcp-link hover:opacity-80">{inner}</a>
    : inner;
}

export default function TrustBar({ withGuarantee = true }: { withGuarantee?: boolean }) {
  return (
    <section aria-label="Nos engagements" style={{ backgroundColor: CREAM, borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
      <div className="max-w-5xl mx-auto px-5 py-10 sm:py-12">
        {REVIEWS.count > 0 && (
          <div className="text-center mb-8"><ReviewsInline /></div>
        )}

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST.map((t, i) => (
            <div key={t.title} className="flex gap-3">
              <span className="shrink-0 inline-flex items-center justify-center rounded-xl"
                style={{ width: 38, height: 38, backgroundColor: 'rgba(201,168,76,.13)', color: GOLD }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {ICONS[i % ICONS.length]}
                </svg>
              </span>
              <div>
                <p className="text-sm font-bold" style={{ color: INK }}>{t.title}</p>
                <p className="mt-1 text-sm leading-relaxed" style={{ color: MUTED }}>{t.text}</p>
              </div>
            </div>
          ))}
        </div>

        {withGuarantee && (
          <div className="mt-8 rounded-2xl p-5 sm:p-6" style={{ backgroundColor: '#FFFFFF', border: `1px solid ${BORDER}` }}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: GOLD }}>{GUARANTEE.title}</p>
            <p className="mt-2 text-sm sm:text-[15px] leading-relaxed" style={{ color: '#3F3A34' }}>{GUARANTEE.text}</p>
          </div>
        )}
      </div>
    </section>
  );
}
