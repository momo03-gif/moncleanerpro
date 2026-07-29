import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Motion from '../../accueil/Motion';
import { BLOG_POSTS, BLOG_SLUGS, getBlogPost } from '@/lib/blogPosts';

export const dynamicParams = false;
export function generateStaticParams() {
  return BLOG_SLUGS.map(slug => ({ slug }));
}

const GOLD = '#C9A84C', INK = '#1A1A1A', VOID = '#0D0D0D', CREAM = '#FAFAF8', MUTED = '#7A7068', BORDER = '#E8E4DC';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = getBlogPost(slug);
  if (!p) return {};
  const url = `https://moncleanerpro.fr/blog/${p.slug}`;
  return {
    title: p.metaTitle,
    description: p.description,
    keywords: [p.keyword, 'nettoyage Lyon', 'conseils nettoyage'],
    alternates: { canonical: url },
    openGraph: {
      type: 'article', locale: 'fr_FR', url, siteName: 'MonCleanerPro',
      title: p.metaTitle, description: p.description, publishedTime: p.date,
      images: [{ url: '/og-image.png', width: 1200, height: 630, alt: p.title }],
    },
    twitter: { card: 'summary_large_image', title: p.metaTitle, description: p.description, images: ['/og-image.png'] },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
  };
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

const STYLES = `
.mcp-js [data-reveal]{opacity:0;transform:translateY(24px);transition:opacity .7s cubic-bezier(.16,.84,.24,1),transform .7s cubic-bezier(.16,.84,.24,1)}
.mcp-js [data-reveal].mcp-in{opacity:1;transform:none}
@media (prefers-reduced-motion:reduce){.mcp-js [data-reveal]{opacity:1!important;transform:none!important;transition:none}}
.article-body h2{font-size:1.35rem;font-weight:700;margin:2.2rem 0 .7rem;color:${INK};letter-spacing:-.01em}
.article-body p{font-size:1.02rem;line-height:1.8;color:#3F3A34;margin:.7rem 0}
.article-body ul{margin:.7rem 0 .7rem 1.2rem;list-style:disc}
.article-body li{font-size:1.02rem;line-height:1.7;color:#3F3A34;margin:.35rem 0}
.article-links{margin:1.8rem 0;padding:1.1rem 1.3rem;border:1px solid ${BORDER};border-left:3px solid ${GOLD};border-radius:12px;background:#FFFFFF}
.article-links-intro{font-size:.86rem!important;font-weight:600;color:${INK}!important;margin:0 0 .5rem!important}
.article-links ul{margin:0 0 0 1.1rem;list-style:disc}
.article-links li{margin:.3rem 0;font-size:.96rem}
.article-links a{color:${INK};text-decoration:underline;text-decoration-color:${GOLD};text-underline-offset:3px;font-weight:600}
.article-links a:hover{color:#8A6F26}
.mcp-card{transition:transform .35s cubic-bezier(.16,.84,.24,1),box-shadow .35s ease,border-color .35s ease}
.mcp-card:hover{transform:translateY(-4px);box-shadow:0 18px 40px -20px rgba(26,26,26,.25);border-color:rgba(201,168,76,.5)}
`;

export default async function BlogArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = getBlogPost(slug);
  if (!p) notFound();

  const url = `https://moncleanerpro.fr/blog/${p.slug}`;
  const others = BLOG_POSTS.filter(x => x.slug !== p.slug).slice(0, 2);

  const jsonLd = [
    {
      '@context': 'https://schema.org', '@type': 'BlogPosting',
      headline: p.title, description: p.description, datePublished: p.date, dateModified: p.date,
      inLanguage: 'fr-FR', mainEntityOfPage: url, image: 'https://moncleanerpro.fr/og-image.png',
      author: { '@type': 'Organization', name: 'MonCleanerPro' },
      publisher: { '@type': 'Organization', name: 'MonCleanerPro', logo: { '@type': 'ImageObject', url: 'https://moncleanerpro.fr/icon-512.png' } },
    },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://moncleanerpro.fr/' },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://moncleanerpro.fr/blog' },
        { '@type': 'ListItem', position: 3, name: p.title, item: url },
      ],
    },
  ];

  return (
    <main style={{ backgroundColor: CREAM, color: INK, minHeight: '100vh' }}>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      {jsonLd.map((j, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(j) }} />)}
      <Motion />

      <header className="sticky top-0 z-40 border-b" style={{ backgroundColor: 'rgba(250,250,248,0.85)', borderColor: BORDER, backdropFilter: 'saturate(180%) blur(10px)' }}>
        <div className="max-w-3xl mx-auto px-5 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <img src="/logo-mark.png" alt="MonCleanerPro" width={34} height={34} style={{ width: 34, height: 34, borderRadius: 8 }} />
            <span className="font-bold text-[15px]" style={{ letterSpacing: '-0.01em' }}>MonCleaner<span style={{ color: GOLD }}>Pro</span></span>
          </a>
          <a href="/devis-en-ligne" className="inline-flex items-center px-4 py-2 rounded-xl text-sm font-semibold" style={{ backgroundColor: GOLD, color: INK }}>Devis gratuit</a>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-5 py-12 md:py-16">
        <nav aria-label="Fil d’Ariane" className="text-xs" style={{ color: MUTED }}>
          <a href="/" className="hover:underline">Accueil</a> <span style={{ color: BORDER }}>/</span>{' '}
          <a href="/blog" className="hover:underline">Blog</a>
        </nav>
        <h1 className="mt-4 text-3xl md:text-4xl font-bold leading-tight" style={{ letterSpacing: '-0.02em' }}>{p.title}</h1>
        <p className="mt-3 text-sm" style={{ color: MUTED }}>{fmtDate(p.date)} · {p.readingMinutes} min de lecture</p>

        <div className="article-body mt-8">
          {p.body.map((b, i) => {
            if (b.type === 'h2') return <h2 key={i}>{b.text}</h2>;
            if (b.type === 'ul') return <ul key={i}>{b.items.map((it, j) => <li key={j}>{it}</li>)}</ul>;
            if (b.type === 'links') return (
              <aside key={i} className="article-links">
                {b.intro && <p className="article-links-intro">{b.intro}</p>}
                <ul>{b.items.map((l, j) => <li key={j}><a href={l.href}>{l.label}</a></li>)}</ul>
              </aside>
            );
            return <p key={i}>{b.text}</p>;
          })}
        </div>

        {/* CTA */}
        <div className="mt-10 rounded-2xl p-7 md:p-8 text-center" style={{ backgroundColor: VOID, color: '#FFFFFF' }}>
          <p className="text-lg font-bold">Besoin d’un nettoyage professionnel à Lyon ?</p>
          <p className="mt-2 text-sm" style={{ color: '#B8B2A8' }}>Devis gratuit et transparent sous 24h, sans engagement.</p>
          <a href="/devis-en-ligne" className="mt-5 inline-flex items-center px-6 py-3 rounded-xl text-sm font-semibold" style={{ backgroundColor: GOLD, color: INK }}>Demander un devis gratuit</a>
        </div>
      </article>

      {/* Articles liés */}
      {others.length > 0 && (
        <section className="max-w-3xl mx-auto px-5 pb-16">
          <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: GOLD }}>À lire aussi</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {others.map(o => (
              <a key={o.slug} href={`/blog/${o.slug}`} className="mcp-card block rounded-xl border p-5" style={{ backgroundColor: '#FFFFFF', borderColor: BORDER }}>
                <h3 className="text-sm font-bold leading-snug">{o.title}</h3>
                <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: GOLD }}>Lire <span aria-hidden>→</span></span>
              </a>
            ))}
          </div>
        </section>
      )}

      <footer style={{ backgroundColor: INK, color: '#B8B2A8' }}>
        <div className="max-w-3xl mx-auto px-5 py-10 flex flex-wrap items-center justify-between gap-4 text-sm">
          <a href="/blog" className="hover:opacity-80">← Tous les articles</a>
          <span>07 83 43 17 00 · info@moncleanerpro.fr</span>
        </div>
      </footer>
    </main>
  );
}
