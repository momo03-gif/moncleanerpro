import type { ReactNode } from 'react';

// Gabarit commun des pages légales de la vitrine (server component).
// Style sobre et lisible, cohérent avec la charte MonCleanerPro.
const GOLD = '#C9A84C', INK = '#1A1A1A', CREAM = '#FAFAF8', MUTED = '#7A7068', BORDER = '#E8E4DC';

const STYLES = `
.legal-body h2{font-size:1.15rem;font-weight:700;margin:2rem 0 .6rem;color:${INK}}
.legal-body p{font-size:.95rem;line-height:1.75;color:#4A443D;margin:.5rem 0}
.legal-body ul{margin:.5rem 0 .5rem 1.1rem;list-style:disc}
.legal-body li{font-size:.95rem;line-height:1.7;color:#4A443D;margin:.25rem 0}
.legal-body a{color:${GOLD};text-decoration:underline}
.legal-body strong{color:${INK}}
`;

export default function LegalLayout({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main style={{ backgroundColor: CREAM, color: INK, minHeight: '100vh' }}>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

      <header className="border-b" style={{ backgroundColor: 'rgba(250,250,248,0.9)', borderColor: BORDER }}>
        <div className="max-w-3xl mx-auto px-5 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <img src="/logo-mark.png" alt="MonCleanerPro" width={32} height={32} style={{ width: 32, height: 32, borderRadius: 8 }} />
            <span className="font-bold text-[15px]" style={{ letterSpacing: '-0.01em' }}>MonCleaner<span style={{ color: GOLD }}>Pro</span></span>
          </a>
          <a href="/devis-en-ligne" className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-semibold" style={{ backgroundColor: GOLD, color: INK }}>Devis gratuit</a>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-5 py-12 md:py-16">
        <a href="/" className="text-sm" style={{ color: GOLD }}>← Retour à l’accueil</a>
        <h1 className="mt-4 text-3xl md:text-4xl font-bold" style={{ letterSpacing: '-0.02em' }}>{title}</h1>
        <p className="mt-2 text-sm" style={{ color: MUTED }}>Dernière mise à jour : {updated}</p>
        <div className="legal-body mt-8">{children}</div>
      </article>

      <footer style={{ backgroundColor: INK, color: '#B8B2A8' }}>
        <div className="max-w-3xl mx-auto px-5 py-8 flex flex-wrap items-center justify-between gap-4 text-sm">
          <a href="/" className="flex items-center gap-2.5">
            <img src="/logo-mark.png" alt="MonCleanerPro" width={30} height={30} style={{ width: 30, height: 30, borderRadius: 8 }} />
            <span className="font-bold" style={{ color: '#FFFFFF' }}>MonCleaner<span style={{ color: GOLD }}>Pro</span></span>
          </a>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <a href="/mentions-legales" className="hover:opacity-80">Mentions légales</a>
            <a href="/confidentialite" className="hover:opacity-80">Confidentialité</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
