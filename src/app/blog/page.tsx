import type { Metadata } from 'next';
import Motion from '../accueil/Motion';
import { BLOG_POSTS } from '@/lib/blogPosts';

const GOLD = '#C9A84C', INK = '#1A1A1A', VOID = '#0D0D0D', CREAM = '#FAFAF8', MUTED = '#7A7068', BORDER = '#E8E4DC';

export const metadata: Metadata = {
  title: 'Blog — Conseils nettoyage & entretien | MonCleanerPro Lyon',
  description: "Conseils et guides pratiques sur le nettoyage professionnel à Lyon : ménage Airbnb, fin de chantier, hôtellerie, EHPAD et entretien des locaux.",
  alternates: { canonical: 'https://moncleanerpro.fr/blog' },
  openGraph: {
    type: 'website', locale: 'fr_FR', url: 'https://moncleanerpro.fr/blog', siteName: 'MonCleanerPro',
    title: 'Blog MonCleanerPro — Conseils nettoyage à Lyon',
    description: "Conseils et guides pratiques sur le nettoyage professionnel à Lyon.",
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Blog MonCleanerPro' }],
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

const STYLES = `
.mcp-js [data-reveal]{opacity:0;transform:translateY(28px);transition:opacity .8s cubic-bezier(.16,.84,.24,1),transform .8s cubic-bezier(.16,.84,.24,1)}
.mcp-js [data-reveal].mcp-in{opacity:1;transform:none}
@media (prefers-reduced-motion:reduce){.mcp-js [data-reveal]{opacity:1!important;transform:none!important;transition:none}}
.mcp-card{transition:transform .35s cubic-bezier(.16,.84,.24,1),box-shadow .35s ease,border-color .35s ease}
.mcp-card:hover{transform:translateY(-5px);box-shadow:0 22px 45px -20px rgba(26,26,26,.28);border-color:rgba(201,168,76,.55)}
`;

export default function BlogIndexPage() {
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'Blog',
    name: 'Blog MonCleanerPro', url: 'https://moncleanerpro.fr/blog',
    publisher: { '@type': 'Organization', name: 'MonCleanerPro', logo: 'https://moncleanerpro.fr/icon-512.png' },
    blogPost: BLOG_POSTS.map(p => ({
      '@type': 'BlogPosting', headline: p.title, url: `https://moncleanerpro.fr/blog/${p.slug}`,
      datePublished: p.date, description: p.description,
    })),
  };
  const posts = [...BLOG_POSTS].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <main style={{ backgroundColor: CREAM, color: INK, minHeight: '100vh' }}>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Motion />

      <header className="sticky top-0 z-40 border-b" style={{ backgroundColor: 'rgba(250,250,248,0.85)', borderColor: BORDER, backdropFilter: 'saturate(180%) blur(10px)' }}>
        <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <img src="/logo-mark.png" alt="MonCleanerPro" width={34} height={34} style={{ width: 34, height: 34, borderRadius: 8 }} />
            <span className="font-bold text-[15px]" style={{ letterSpacing: '-0.01em' }}>MonCleaner<span style={{ color: GOLD }}>Pro</span></span>
          </a>
          <a href="/devis-en-ligne" className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-semibold" style={{ backgroundColor: GOLD, color: INK }}>Devis gratuit</a>
        </div>
      </header>

      <section style={{ backgroundColor: VOID, color: '#FFFFFF' }}>
        <div className="max-w-5xl mx-auto px-5 py-16 md:py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: GOLD }}>Le blog MonCleanerPro</p>
          <h1 className="mt-3 text-4xl md:text-5xl font-bold" style={{ letterSpacing: '-0.02em' }}>Conseils &amp; guides de nettoyage</h1>
          <p className="mt-5 max-w-2xl text-lg" style={{ color: '#B8B2A8' }}>
            Nos méthodes de professionnels pour un entretien impeccable — Airbnb, hôtellerie, EHPAD,
            fin de chantier et grand ménage, à Lyon et dans le Rhône-Alpes.
          </p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-5 py-14 md:py-20 grid gap-6 md:grid-cols-2">
        {posts.map(p => (
          <a key={p.slug} href={`/blog/${p.slug}`} data-reveal className="mcp-card flex flex-col rounded-2xl border p-7" style={{ backgroundColor: '#FFFFFF', borderColor: BORDER }}>
            <div className="text-xs" style={{ color: MUTED }}>{fmtDate(p.date)} · {p.readingMinutes} min de lecture</div>
            <h2 className="mt-2 text-xl font-bold leading-snug">{p.title}</h2>
            <p className="mt-3 text-sm leading-relaxed flex-1" style={{ color: MUTED }}>{p.description}</p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: GOLD }}>Lire l’article <span aria-hidden>→</span></span>
          </a>
        ))}
      </section>

      <footer style={{ backgroundColor: INK, color: '#B8B2A8' }}>
        <div className="max-w-5xl mx-auto px-5 py-10 flex flex-wrap items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-2.5">
            <img src="/logo-mark.png" alt="MonCleanerPro" width={32} height={32} style={{ width: 32, height: 32, borderRadius: 8 }} />
            <span className="font-bold" style={{ color: '#FFFFFF' }}>MonCleaner<span style={{ color: GOLD }}>Pro</span></span>
          </a>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <a href="/" className="hover:opacity-80">Accueil</a>
            <a href="/devis-en-ligne" className="hover:opacity-80">Devis gratuit</a>
            <a href="/mentions-legales" className="hover:opacity-80">Mentions légales</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
