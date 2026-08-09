import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Motion from '../accueil/Motion';
import { SEO_PAGES, SEO_SLUGS, getSeoPage, getCityGeo } from '@/lib/seoPages';
import { getBlogPost } from '@/lib/blogPosts';
import TrustBar, { ReviewsInline } from '@/components/TrustBar';
import QuickQuote from '@/components/QuickQuote';
import FloatingContact from '@/components/FloatingContact';

// Pages d'atterrissage SEO (service × Lyon) — rendu 100 % statique.
// dynamicParams=false : seuls les slugs connus existent, tout le reste → 404
// (les routes statiques comme /admin, /login gardent la priorité).
export const dynamicParams = false;
export function generateStaticParams() {
  return SEO_SLUGS.map(slug => ({ slug }));
}

const APP_URL = 'https://app.moncleanerpro.fr';
const PHONE = '07 83 43 17 00';
const PHONE_HREF = 'tel:+33783431700';
const EMAIL = 'info@moncleanerpro.fr';
const GOLD = '#C9A84C', INK = '#1A1A1A', VOID = '#0D0D0D', CREAM = '#FAFAF8', MUTED = '#7A7068', BORDER = '#E8E4DC';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = getSeoPage(slug);
  if (!p) return {};
  const url = `https://moncleanerpro.fr/${p.slug}`;
  return {
    title: p.title,
    description: p.description,
    // Les mots-clés d'appui suivent la portée de la page : accoler « nettoyage
    // Lyon » à une page qui vise les chantiers nationaux brouille son sujet.
    keywords: p.scope === 'national'
      ? [p.keyword, `entreprise ${p.keyword}`, `société ${p.keyword}`, 'nettoyage fin de chantier France', 'nettoyage gros chantier', 'devis nettoyage chantier']
      : [p.keyword, `${p.keyword} pas cher`, `société ${p.keyword}`, 'nettoyage Lyon', 'devis nettoyage Lyon'],
    alternates: { canonical: url },
    openGraph: {
      type: 'website', locale: 'fr_FR', url, siteName: 'MonCleanerPro',
      title: p.title, description: p.description,
      images: [{ url: '/og-image.png', width: 1200, height: 630, alt: p.h1 }],
    },
    twitter: { card: 'summary_large_image', title: p.title, description: p.description, images: ['/og-image.png'] },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
  };
}

function Check({ size = 18 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>;
}

const STYLES = `
.mcp-js [data-reveal]{opacity:0;transform:translateY(28px);transition:opacity .8s cubic-bezier(.16,.84,.24,1),transform .8s cubic-bezier(.16,.84,.24,1)}
.mcp-js [data-reveal].mcp-in{opacity:1;transform:none}
@media (prefers-reduced-motion:reduce){.mcp-js [data-reveal]{opacity:1!important;transform:none!important;transition:none}}
.mcp-card{transition:transform .35s cubic-bezier(.16,.84,.24,1),box-shadow .35s ease,border-color .35s ease}
.mcp-card:hover{transform:translateY(-5px);box-shadow:0 22px 45px -20px rgba(26,26,26,.28);border-color:rgba(201,168,76,.55)}
.mcp-btn{transition:transform .2s ease,box-shadow .25s ease}.mcp-btn:hover{transform:translateY(-2px)}
.mcp-btn-gold:hover{box-shadow:0 14px 30px -10px rgba(201,168,76,.75)}
.mcp-gold-grad{background:linear-gradient(100deg,#E7C868,#C9A84C 55%,#A8873B);-webkit-background-clip:text;background-clip:text;color:transparent}
.mcp-hero{position:relative;overflow:hidden}
.mcp-glow{position:absolute;border-radius:9999px;filter:blur(72px);opacity:.5;pointer-events:none;width:480px;height:480px;background:radial-gradient(circle,rgba(201,168,76,.4),transparent 65%);top:-160px;right:-120px;animation:mcpFloat 15s ease-in-out infinite}
@keyframes mcpFloat{0%,100%{transform:translate(0,0)}50%{transform:translate(30px,26px)}}
.mcp-js .mcp-rise{opacity:0;transform:translateY(22px);animation:mcpRise .9s cubic-bezier(.16,.84,.24,1) forwards}
@keyframes mcpRise{to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.mcp-glow{animation:none}.mcp-js .mcp-rise{opacity:1;transform:none;animation:none}}
.seo-prose h2{font-size:1.5rem;font-weight:700;letter-spacing:-.02em;color:${INK};margin:0 0 .8rem}
.seo-prose p{font-size:1.02rem;line-height:1.8;color:#3F3A34;margin:.8rem 0}
.seo-prose ul{margin:.9rem 0 0 1.15rem;list-style:disc}
.seo-prose li{font-size:1.02rem;line-height:1.75;color:#3F3A34;margin:.45rem 0}
@media (min-width:768px){.seo-prose h2{font-size:1.7rem}}
`;

export default async function SeoLandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = getSeoPage(slug);
  if (!p) notFound();

  const url = `https://moncleanerpro.fr/${p.slug}`;
  // Maillage interne : on privilégie les liens curatés (`related`), puis les pages
  // du même cluster, et on complète avec d'autres prestations. Déverser les 20+
  // pages dilue le jus et brouille le signal thématique.
  const pick = (slug: string) => SEO_PAGES.find(x => x.slug === slug && x.slug !== p.slug);
  const curated = (p.related ?? []).map(pick).filter((x): x is typeof SEO_PAGES[number] => !!x);
  const sameCluster = p.cluster
    ? SEO_PAGES.filter(x => x.cluster === p.cluster && x.slug !== p.slug && !curated.includes(x))
    : [];
  const fill = SEO_PAGES.filter(x => x.slug !== p.slug && !curated.includes(x) && !sameCluster.includes(x));
  const others = [...curated, ...sameCluster, ...fill].slice(0, 6);
  const posts = (p.relatedPosts ?? []).map(getBlogPost).filter((x): x is NonNullable<ReturnType<typeof getBlogPost>> => !!x);

  // Zone desservie : la commune réelle de la page (+ coordonnées) pour un signal
  // géo précis ; « Lyon » par défaut pour les pages de service.
  // Les pages `scope: 'national'` (gros chantiers) desservent la France entière :
  // sans ce cas, une page « fin de chantier à Lille » serait balisée comme
  // desservie depuis le Rhône, ce qui est faux et affaiblit la page.
  const geo = getCityGeo(p.slug);
  const national = p.scope === 'national';
  const areaServed = geo
    ? {
        '@type': 'City', name: geo.city,
        ...(geo.postalCode ? { address: { '@type': 'PostalAddress', addressLocality: geo.city, postalCode: geo.postalCode, addressRegion: geo.region ?? 'Rhône', addressCountry: 'FR' } } : {}),
        geo: { '@type': 'GeoCoordinates', latitude: geo.lat, longitude: geo.lng },
      }
    : national
      ? { '@type': 'Country', name: 'France' }
      : { '@type': 'City', name: 'Lyon' };

  const jsonLd = [
    {
      '@context': 'https://schema.org', '@type': 'Service',
      name: p.h1, serviceType: p.keyword, description: p.description, url,
      areaServed,
      provider: {
        '@type': 'CleaningService', name: 'MonCleanerPro', url: 'https://moncleanerpro.fr',
        telephone: '+33783431700', email: EMAIL,
        // Le prestataire, lui, intervient nationalement sur les gros chantiers :
        // on le déclare au niveau `provider`, pendant que `areaServed` ci-dessus
        // garde le grain fin de la ville visée par la page.
        ...(national
          ? { areaServed: { '@type': 'Country', name: 'France' } }
          : geo ? { areaServed: { '@type': 'City', name: geo.city } } : {}),
      },
    },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://moncleanerpro.fr/' },
        { '@type': 'ListItem', position: 2, name: p.h1, item: url },
      ],
    },
    {
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: p.faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
  ];

  return (
    <main style={{ backgroundColor: CREAM, color: INK }}>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      {jsonLd.map((j, i) => <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(j) }} />)}
      <Motion />

      {/* Nav */}
      <header className="sticky top-0 z-40 border-b" style={{ backgroundColor: 'rgba(250,250,248,0.85)', borderColor: BORDER, backdropFilter: 'saturate(180%) blur(10px)' }}>
        <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <img src="/logo-mark.png" alt="MonCleanerPro" width={34} height={34} style={{ width: 34, height: 34, borderRadius: 8 }} />
            <span className="font-bold text-[15px]" style={{ letterSpacing: '-0.01em' }}>MonCleaner<span style={{ color: GOLD }}>Pro</span></span>
          </a>
          <a href="/devis-en-ligne" className="mcp-btn mcp-btn-gold inline-flex items-center px-4 py-2 rounded-xl text-sm font-semibold" style={{ backgroundColor: GOLD, color: INK }}>Devis gratuit</a>
        </div>
      </header>

      {/* Fil d'Ariane */}
      <nav aria-label="Fil d’Ariane" className="max-w-5xl mx-auto px-5 pt-6 text-xs" style={{ color: MUTED }}>
        <a href="/" className="hover:underline">Accueil</a> <span style={{ color: BORDER }}>/</span> <span style={{ color: INK }}>{p.h1}</span>
      </nav>

      {/* Hero */}
      <section className="mcp-hero" style={{ backgroundColor: VOID, color: '#FFFFFF' }}>
        <div className="mcp-glow" aria-hidden />
        <div className="relative max-w-5xl mx-auto px-5 py-20 md:py-24">
          <p className="mcp-rise text-xs font-semibold uppercase tracking-[0.2em]" style={{ animationDelay: '0ms', color: GOLD }}>{p.eyebrow} · Lyon &amp; Rhône-Alpes</p>
          <h1 className="mcp-rise mt-4 text-4xl md:text-5xl font-bold leading-[1.08]" style={{ animationDelay: '80ms', letterSpacing: '-0.02em' }}>
            {p.h1} <span className="mcp-gold-grad">par MonCleanerPro</span>
          </h1>
          <p className="mcp-rise mt-6 max-w-2xl text-lg leading-relaxed" style={{ animationDelay: '160ms', color: '#B8B2A8' }}>{p.intro}</p>
          <div className="mcp-rise mt-8 flex flex-wrap gap-3" style={{ animationDelay: '240ms' }}>
            <a href="/devis-en-ligne" className="mcp-btn mcp-btn-gold inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold" style={{ backgroundColor: GOLD, color: INK }}>Devis gratuit sous 24h</a>
            <a href={PHONE_HREF} className="mcp-btn inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold" style={{ color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.22)' }}>{PHONE}</a>
          </div>
          {/* Preuve sociale au niveau du bouton : c'est là qu'elle lève l'hésitation. */}
          <div className="mcp-rise mt-6" style={{ animationDelay: '300ms' }}><ReviewsInline tone="dark" /></div>
        </div>
      </section>

      {/* Points forts */}
      <section className="max-w-5xl mx-auto px-5 py-16 md:py-20">
        <div className="grid gap-5 md:grid-cols-3">
          {p.highlights.map((h, i) => (
            <div key={h.title} data-reveal className="mcp-card rounded-2xl border p-7" style={{ backgroundColor: '#FFFFFF', borderColor: BORDER, transitionDelay: `${i * 70}ms` }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: 'rgba(201,168,76,0.12)', color: GOLD }}><Check size={22} /></div>
              <h2 className="text-base font-bold">{h.title}</h2>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: MUTED }}>{h.text}</p>
            </div>
          ))}
        </div>

        {/* Ce qui est inclus */}
        <div data-reveal className="mt-10 rounded-2xl border p-7 md:p-9" style={{ backgroundColor: '#FFFFFF', borderColor: BORDER }}>
          <h2 className="text-xl font-bold">Ce que comprend notre prestation</h2>
          <ul className="mt-5 grid sm:grid-cols-2 gap-3">
            {p.includes.map(item => (
              <li key={item} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 shrink-0" style={{ color: GOLD }}><Check size={18} /></span>
                <span className="font-medium">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Contenu long (pages pilier) — facultatif : les pages courtes n'en ont pas.
          C'est ce qui permet de traiter un mot-clé concurrentiel en profondeur
          plutôt qu'en 250 mots. */}
      {p.sections && p.sections.length > 0 && (
        <section className="max-w-5xl mx-auto px-5 pb-4">
          <div className="seo-prose">
            {p.sections.map(s => (
              <div key={s.h2} data-reveal className="mb-10">
                <h2>{s.h2}</h2>
                {s.paragraphs?.map((t, i) => <p key={i}>{t}</p>)}
                {s.list && <ul>{s.list.map((it, i) => <li key={i}>{it}</li>)}</ul>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="max-w-5xl mx-auto px-5 pb-16 md:pb-20">
        <h2 data-reveal className="text-2xl font-bold" style={{ letterSpacing: '-0.02em' }}>Questions fréquentes — {p.eyebrow.toLowerCase()}</h2>
        <div data-reveal className="mt-6">
          {p.faq.map(f => (
            <details key={f.q} className="group py-5 border-b" style={{ borderColor: BORDER }}>
              <summary className="flex items-center justify-between cursor-pointer list-none font-semibold">
                {f.q}
                <span className="ml-4 shrink-0 transition-transform group-open:rotate-45" style={{ color: GOLD }}>+</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed" style={{ color: MUTED }}>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Réassurance + engagement de reprise. Placé après la FAQ : le visiteur a
          eu ses réponses, c'est le moment où l'objection restante est la confiance. */}
      <TrustBar />

      {/* Formulaire court, au pic de conviction — juste après la réassurance et
          AVANT le maillage interne, qui invite par nature à quitter la page. */}
      <section className="max-w-5xl mx-auto px-5 py-14 md:py-16">
        <div data-reveal className="max-w-2xl mx-auto">
          <QuickQuote service={p.keyword} slug={p.slug} />
        </div>
      </section>

      {/* Maillage interne : pages liées (curatées) */}
      <section className="max-w-5xl mx-auto px-5 pb-16 md:pb-20">
        <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: GOLD }}>
          {p.cluster ? 'À voir aussi sur ce sujet' : 'Nos autres prestations à Lyon'}
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {others.map(o => (
            <a key={o.slug} href={`/${o.slug}`} data-reveal className="mcp-card flex items-center justify-between gap-3 rounded-xl border p-4" style={{ backgroundColor: '#FFFFFF', borderColor: BORDER }}>
              <span className="text-sm font-semibold">{o.h1}</span>
              <span style={{ color: GOLD }} aria-hidden>→</span>
            </a>
          ))}
        </div>

        {/* Vers le blog : les articles captent les requêtes informationnelles et
            renvoient le visiteur vers cette page commerciale. */}
        {posts.length > 0 && (
          <div className="mt-10">
            <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: GOLD }}>Nos conseils</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {posts.map(b => (
                <a key={b.slug} href={`/blog/${b.slug}`} data-reveal className="mcp-card block rounded-xl border p-4" style={{ backgroundColor: '#FFFFFF', borderColor: BORDER }}>
                  <span className="text-sm font-semibold leading-snug">{b.title}</span>
                  <span className="mt-2 block text-xs font-semibold" style={{ color: GOLD }}>Lire l’article →</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* CTA */}
      <section style={{ backgroundColor: VOID, color: '#FFFFFF' }}>
        <div className="max-w-5xl mx-auto px-5 py-16 md:py-20 text-center">
          <h2 className="text-3xl md:text-4xl font-bold" style={{ letterSpacing: '-0.02em' }}>Un devis pour votre {p.eyebrow.toLowerCase()} ?</h2>
          <p className="mt-4 max-w-xl mx-auto" style={{ color: '#B8B2A8' }}>Estimation immédiate en ligne, devis confirmé sous 24h, sans engagement.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href="/devis-en-ligne" className="mcp-btn mcp-btn-gold inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold" style={{ backgroundColor: GOLD, color: INK }}>Demander un devis gratuit</a>
            <a href={`${APP_URL}/login`} target="_blank" rel="noopener noreferrer" className="mcp-btn inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold" style={{ color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.22)' }}>Espace client</a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ backgroundColor: INK, color: '#B8B2A8' }}>
        <div className="max-w-5xl mx-auto px-5 py-10 flex flex-wrap items-center justify-between gap-5">
          <a href="/" className="flex items-center gap-3">
            <img src="/logo-mark.png" alt="MonCleanerPro" width={36} height={36} style={{ width: 36, height: 36, borderRadius: 9 }} />
            <span className="font-bold" style={{ color: '#FFFFFF' }}>MonCleaner<span style={{ color: GOLD }}>Pro</span></span>
          </a>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
            <a href="/mentions-legales" className="hover:opacity-80">Mentions légales</a>
            <a href="/confidentialite" className="hover:opacity-80">Confidentialité</a>
            <span>{PHONE} · {EMAIL}</span>
          </div>
        </div>
      </footer>

      <FloatingContact />
    </main>
  );
}
