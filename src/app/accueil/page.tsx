import type { Metadata } from 'next';
import Motion from './Motion';
import { SEO_PAGES, SERVED_CITIES, getCityGeo } from '@/lib/seoPages';

// ════════════════════════════════════════════════════════════════════════════
//  Vitrine publique MonCleanerPro (remplace le site Hostinger Horizons).
//  Contenu rendu côté serveur (SEO + perf) ; les animations sont une couche
//  d'amélioration progressive (Motion.tsx) — sans JS, tout reste visible.
//  Charte : or #C9A84C, encre #1A1A1A, crème #FAFAF8. Aucun emoji, icônes ligne.
//  NB : la livraison est un usage interne, jamais un service vendu → non listée.
// ════════════════════════════════════════════════════════════════════════════

const APP_URL = 'https://app.moncleanerpro.fr';
const PHONE = '07 83 43 17 00';
const PHONE_HREF = 'tel:+33783431700';
const EMAIL = 'info@moncleanerpro.fr';

const TITLE = 'MonCleanerPro — Nettoyage professionnel à Lyon & Rhône-Alpes';
const DESC =
  "Société de nettoyage professionnel à Lyon et dans le Rhône-Alpes : hôtellerie, EHPAD, conciergeries & Airbnb, particuliers et fin de chantier. Équipe formée, contrôle qualité, devis gratuit sous 24h.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  keywords: [
    'nettoyage Lyon', 'société de nettoyage Lyon', 'ménage professionnel Lyon',
    'nettoyage hôtel Lyon', 'nettoyage EHPAD', 'ménage Airbnb Lyon', 'conciergerie Airbnb',
    'ménage entre voyageurs', 'nettoyage fin de chantier Lyon', 'grand ménage Lyon',
    'entreprise de nettoyage Rhône-Alpes', 'devis nettoyage Lyon',
  ],
  alternates: { canonical: 'https://moncleanerpro.fr/' },
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: 'https://moncleanerpro.fr/',
    siteName: 'MonCleanerPro',
    title: TITLE,
    description: DESC,
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'MonCleanerPro — Nettoyage professionnel à Lyon' }],
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESC, images: ['/og-image.png'] },
  applicationName: 'MonCleanerPro',
  authors: [{ name: 'MonCleanerPro' }],
  creator: 'MonCleanerPro',
  publisher: 'MonCleanerPro',
  category: 'Services de nettoyage',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
};

const GOLD = '#C9A84C';
const INK = '#1A1A1A';
const VOID = '#0D0D0D';
const CREAM = '#FAFAF8';
const MUTED = '#7A7068';
const BORDER = '#E8E4DC';

// ── Icônes ligne (SVG sobres) ───────────────────────────────────────────────────
function Icon({ path, size = 24 }: { path: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">{path}</svg>
  );
}
const IconHotel = <><path d="M3 21h18" /><path d="M5 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16" /><path d="M16 8h3a1 1 0 0 1 1 1v12" /><path d="M9 8h.01M12 8h.01M9 12h.01M12 12h.01M9 16h.01M12 16h.01" /></>;
const IconHeart = <><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" /></>;
const IconKey = <><circle cx="7.5" cy="15.5" r="4.5" /><path d="m10.7 12.3 8.3-8.3M17 6l2 2M15 8l2 2" /></>;
const IconHome = <><path d="m3 10 9-7 9 7v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z" /><path d="M9 20v-6h6v6" /></>;
const IconTool = <><path d="M14.5 5.5a3.5 3.5 0 0 0-4.9 4.5L3 16.6 5.4 19l6.6-6.6a3.5 3.5 0 0 0 4.5-4.9l-2.3 2.3-2-2 2.3-2.3Z" /></>;
const IconCheck = <><path d="M20 6 9 17l-5-5" /></>;
const IconShield = <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>;
const IconClock = <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>;
const IconSpark = <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2" /></>;
const IconPin = <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>;
const IconPhone = <><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.1-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z" /></>;
const IconMail = <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m2 7 10 6 10-6" /></>;
const IconWhatsApp = <><path d="M12 3a8.5 8.5 0 0 0-7.3 12.9L3.5 21l5.3-1.3A8.5 8.5 0 1 0 12 3Z" /><path d="M9 8.9c-.2 1.6.4 3.2 1.6 4.4s2.8 1.8 4.4 1.6c.3 0 .5-.3.5-.6v-1c0-.3-.2-.5-.5-.6l-1.3-.3c-.2 0-.4 0-.6.2l-.4.5a6 6 0 0 1-2.3-2.3l.5-.4c.2-.2.2-.4.2-.6l-.3-1.3c0-.3-.3-.5-.6-.5h-1c-.3 0-.6.2-.6.5Z" /></>;
const IconMonitor = <><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></>;
const IconUsers = <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6" /></>;

const sectors = [
  { icon: IconHotel, title: 'Hôtellerie', href: '/nettoyage-hotel-lyon', text: "Ménage des chambres et parties communes, remise en état entre les séjours, cadence soutenue et exigences de standing hôtelier." },
  { icon: IconHeart, title: 'EHPAD & résidences', href: '/nettoyage-ehpad-lyon', text: "Entretien rigoureux d'établissements accueillant du public sensible : protocoles d'hygiène stricts, régularité et discrétion." },
  { icon: IconKey, title: 'Conciergeries & Airbnb', href: '/menage-airbnb-lyon', text: "Ménage entre voyageurs, gestion du linge et check-list de mise en place. Idéal pour conciergeries et propriétaires de locations courte durée." },
  { icon: IconHome, title: 'Particuliers', href: '/grand-menage-lyon', text: "Grand ménage, nettoyage en profondeur et prestations ponctuelles pour les particuliers de la métropole lyonnaise." },
  { icon: IconTool, title: 'Fin de chantier', href: '/nettoyage-fin-de-chantier-lyon', text: "Nettoyage de fin de travaux et finitions avant livraison ou mise en vente, pour un bien impeccable dès la remise des clés." },
];

const services = [
  'Ménage entre voyageurs (Airbnb / courte durée)',
  'Nettoyage récurrent hôtellerie & EHPAD',
  'Grand ménage et nettoyage en profondeur',
  'Nettoyage de fin de chantier',
  'Changement et lavage du linge de maison',
  'Interventions ponctuelles (one-shot)',
];

const values = [
  { icon: IconShield, title: 'Fiabilité', text: 'Des équipes formées, encadrées et présentes au rendez-vous, intervention après intervention.' },
  { icon: IconCheck, title: 'Qualité contrôlée', text: 'Check-list systématique et contrôle des finitions pour un résultat impeccable à chaque passage.' },
  { icon: IconClock, title: 'Réactivité', text: 'Devis gratuit sous 24h et planification rapide, y compris pour les cadences hôtelières.' },
  { icon: IconMonitor, title: 'Suivi digital', text: 'Chaque mission est planifiée et suivie sur notre plateforme : traçabilité complète et rapports d’intervention.' },
];

const stats = [
  { value: '24h', label: 'Devis renvoyé' },
  { value: '5', label: 'Secteurs couverts' },
  { value: '100%', label: 'Missions contrôlées' },
  { value: 'Lyon', label: '& Rhône-Alpes' },
];

const steps = [
  { n: '01', title: 'Vous décrivez votre besoin', text: 'En ligne en 2 minutes, ou par téléphone. Type de bien, surface, fréquence : notre assistant intelligent vous propose une estimation immédiate.' },
  { n: '02', title: 'On valide ensemble le devis', text: 'Un devis clair, transparent et sans engagement, ajusté à votre réalité et confirmé sous 24h.' },
  { n: '03', title: 'Nos équipes interviennent', text: 'Un(e) intervenant(e) formé(e) prend en charge la mission, avec check-list qualité et rapport d’intervention à la clé.' },
];

const testimonials = [
  { name: 'Conciergerie Airbnb', role: 'Lyon 3e', text: "Des ménages réguliers, fiables et toujours au rendez-vous entre deux voyageurs. Le suivi digital nous fait gagner un temps fou." },
  { name: 'Résidence hôtelière', role: 'Villeurbanne', text: "Cadence hôtelière tenue sans faille, finitions impeccables. Une équipe sérieuse sur qui on peut compter." },
  { name: 'Propriétaire particulier', role: 'Métropole de Lyon', text: "Grand ménage nickel, devis clair et intervenants soigneux. Exactement le sérieux que je cherchais." },
];

const faq = [
  { q: 'Sous combien de temps ai-je mon devis ?', a: "Une estimation immédiate en ligne via notre assistant, et un devis confirmé et personnalisé sous 24h." },
  { q: 'Intervenez-vous pour les professionnels comme pour les particuliers ?', a: "Oui : hôtels, EHPAD, conciergeries et propriétaires Airbnb, ainsi que les particuliers pour du grand ménage ou des interventions ponctuelles." },
  { q: 'Quelle est votre zone d’intervention ?', a: "Lyon, Villeurbanne et l’ensemble de la métropole lyonnaise, plus une large partie du Rhône-Alpes. Vérifiez votre zone au moment du devis." },
  { q: 'Vos intervenants sont-ils formés et encadrés ?', a: "Oui, nos équipes sont formées, encadrées et suivent une check-list qualité systématique. Chaque mission fait l’objet d’un rapport d’intervention." },
];

// ── Données structurées (SEO) ───────────────────────────────────────────────────
const jsonLdBusiness = {
  '@context': 'https://schema.org', '@type': 'CleaningService',
  name: 'MonCleanerPro', description: DESC, url: 'https://moncleanerpro.fr',
  telephone: '+33783431700', email: EMAIL,
  image: 'https://moncleanerpro.fr/og-image.png', logo: 'https://moncleanerpro.fr/icon-512.png',
  priceRange: '€€',
  // SERVED_CITIES est déjà dédupliqué et inclut Villeurbanne (page fin de chantier).
  areaServed: [
    ...SERVED_CITIES.map(name => ({ '@type': 'City', name })),
    { '@type': 'AdministrativeArea', name: 'Métropole de Lyon' }, { '@type': 'AdministrativeArea', name: 'Rhône-Alpes' },
  ],
  address: { '@type': 'PostalAddress', addressLocality: 'Lyon', addressRegion: 'Auvergne-Rhône-Alpes', addressCountry: 'FR' },
  serviceType: ['Nettoyage hôtelier', 'Nettoyage EHPAD', 'Ménage Airbnb et conciergerie', 'Grand ménage', 'Nettoyage de fin de chantier', 'Nettoyage de bureaux', 'Nettoyage de copropriété', 'Nettoyage de vitres'],
};
const jsonLdFaq = {
  '@context': 'https://schema.org', '@type': 'FAQPage',
  mainEntity: faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
};
const jsonLdOrg = {
  '@context': 'https://schema.org', '@type': 'Organization',
  name: 'MonCleanerPro', url: 'https://moncleanerpro.fr',
  logo: 'https://moncleanerpro.fr/icon-512.png',
  image: 'https://moncleanerpro.fr/og-image.png',
  email: EMAIL,
  contactPoint: [{ '@type': 'ContactPoint', telephone: '+33783431700', contactType: 'customer service', areaServed: 'FR', availableLanguage: 'French' }],
};
const jsonLdWebsite = {
  '@context': 'https://schema.org', '@type': 'WebSite',
  name: 'MonCleanerPro', url: 'https://moncleanerpro.fr',
  inLanguage: 'fr-FR', publisher: { '@type': 'Organization', name: 'MonCleanerPro' },
};

// ── Styles d'animation/finitions (scopés « mcp- », injectés en SSR) ──────────────
const STYLES = `
.mcp-js [data-reveal]{opacity:0;transform:translateY(30px);transition:opacity .8s cubic-bezier(.16,.84,.24,1),transform .8s cubic-bezier(.16,.84,.24,1);will-change:opacity,transform}
.mcp-js [data-reveal].mcp-in{opacity:1;transform:none}
@media (prefers-reduced-motion:reduce){.mcp-js [data-reveal]{opacity:1!important;transform:none!important;transition:none}}
#mcp-header{transition:box-shadow .3s ease,background-color .3s ease}
#mcp-header.mcp-scrolled{box-shadow:0 8px 30px rgba(26,26,26,.07)}
.mcp-card{transition:transform .35s cubic-bezier(.16,.84,.24,1),box-shadow .35s ease,border-color .35s ease}
.mcp-card:hover{transform:translateY(-5px);box-shadow:0 22px 45px -20px rgba(26,26,26,.28);border-color:rgba(201,168,76,.55)}
.mcp-btn{transition:transform .2s ease,box-shadow .25s ease,opacity .2s ease}
.mcp-btn:hover{transform:translateY(-2px)}
.mcp-btn-gold:hover{box-shadow:0 14px 30px -10px rgba(201,168,76,.75)}
.mcp-link{transition:color .2s ease,opacity .2s ease}
.mcp-gold-grad{background:linear-gradient(100deg,#E7C868,#C9A84C 55%,#A8873B);-webkit-background-clip:text;background-clip:text;color:transparent}
.mcp-hero{position:relative;overflow:hidden}
.mcp-glow{position:absolute;border-radius:9999px;filter:blur(72px);opacity:.5;pointer-events:none}
.mcp-glow-1{width:540px;height:540px;background:radial-gradient(circle,rgba(201,168,76,.45),transparent 65%);top:-170px;right:-130px;animation:mcpFloat 15s ease-in-out infinite}
.mcp-glow-2{width:440px;height:440px;background:radial-gradient(circle,rgba(201,168,76,.20),transparent 65%);bottom:-170px;left:-110px;animation:mcpFloat 19s ease-in-out infinite reverse}
@keyframes mcpFloat{0%,100%{transform:translate(0,0)}50%{transform:translate(34px,28px)}}
.mcp-js .mcp-rise{opacity:0;transform:translateY(24px);animation:mcpRise .9s cubic-bezier(.16,.84,.24,1) forwards}
@keyframes mcpRise{to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.mcp-glow{animation:none}.mcp-js .mcp-rise{opacity:1;transform:none;animation:none}}
details.mcp-faq summary::-webkit-details-marker{display:none}
.mcp-chip{transition:transform .35s cubic-bezier(.16,.84,.24,1),box-shadow .35s ease}
.mcp-chip:hover{transform:translateY(-3px);box-shadow:0 14px 30px -16px rgba(26,26,26,.25)}
`;

function Btn({ href, children, variant = 'gold', external = false }: {
  href: string; children: React.ReactNode; variant?: 'gold' | 'outline' | 'dark'; external?: boolean;
}) {
  const cls = 'mcp-btn inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold'
    + (variant === 'gold' ? ' mcp-btn-gold' : '');
  const styles: React.CSSProperties =
    variant === 'gold' ? { backgroundColor: GOLD, color: INK }
    : variant === 'dark' ? { backgroundColor: INK, color: '#FFFFFF' }
    : { backgroundColor: 'transparent', color: INK, border: `1px solid ${BORDER}` };
  return (
    <a href={href} className={cls} style={styles} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
      {children}
    </a>
  );
}

export default function VitrinePage() {
  return (
    <main style={{ backgroundColor: CREAM, color: INK }}>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBusiness) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdOrg) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdWebsite) }} />
      <Motion />

      {/* ── NAV ───────────────────────────────────────────────────────────── */}
      <header id="mcp-header" className="sticky top-0 z-40 border-b" style={{ backgroundColor: 'rgba(250,250,248,0.82)', borderColor: BORDER, backdropFilter: 'saturate(180%) blur(10px)' }}>
        <div className="max-w-7xl mx-auto px-5 h-16 flex items-center justify-between">
          <a href="#top" className="flex items-center gap-2.5 shrink-0">
            <img src="/logo-mark.png" alt="MonCleanerPro" width={34} height={34} style={{ width: 34, height: 34, borderRadius: 8 }} />
            <span className="font-bold text-[15px]" style={{ letterSpacing: '-0.01em' }}>MonCleaner<span style={{ color: GOLD }}>Pro</span></span>
          </a>
          <nav className="hidden md:flex items-center gap-7 text-sm" style={{ color: MUTED }}>
            <a href="#secteurs" className="mcp-link hover:opacity-70">Secteurs</a>
            <a href="#prestations" className="mcp-link hover:opacity-70">Prestations</a>
            <a href="#process" className="mcp-link hover:opacity-70">Déroulé</a>
            <a href="#avis" className="mcp-link hover:opacity-70">Avis</a>
            <a href="/blog" className="mcp-link hover:opacity-70">Blog</a>
            <a href="#faq" className="mcp-link hover:opacity-70">FAQ</a>
          </nav>
          <div className="flex items-center gap-2.5">
            <a href={`${APP_URL}/login`} target="_blank" rel="noopener noreferrer"
              className="mcp-btn hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border"
              style={{ borderColor: BORDER, color: INK }}>Espace client</a>
            <a href="/devis-en-ligne" className="mcp-btn mcp-btn-gold inline-flex items-center px-4 py-2 rounded-xl text-sm font-semibold" style={{ backgroundColor: GOLD, color: INK }}>Devis gratuit</a>
          </div>
        </div>
      </header>

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section id="top" className="mcp-hero" style={{ backgroundColor: VOID, color: '#FFFFFF' }}>
        <div className="mcp-glow mcp-glow-1" aria-hidden />
        <div className="mcp-glow mcp-glow-2" aria-hidden />
        <div className="relative max-w-7xl mx-auto px-5 py-24 md:py-32">
          <div className="max-w-3xl">
            <div className="mcp-rise inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-7" style={{ animationDelay: '0ms', backgroundColor: 'rgba(201,168,76,0.12)', color: GOLD, border: '1px solid rgba(201,168,76,0.25)' }}>
              <span style={{ color: GOLD }}><Icon path={IconPin} size={14} /></span> Lyon &amp; Rhône-Alpes
            </div>
            <h1 className="mcp-rise text-4xl md:text-6xl font-bold leading-[1.05]" style={{ animationDelay: '80ms', letterSpacing: '-0.02em' }}>
              Le nettoyage professionnel<br />
              <span className="mcp-gold-grad">qui tient ses promesses.</span>
            </h1>
            <p className="mcp-rise mt-6 text-lg leading-relaxed" style={{ animationDelay: '160ms', color: '#B8B2A8' }}>
              MonCleanerPro accompagne hôtels, EHPAD, conciergeries et particuliers
              de la métropole lyonnaise. Des équipes formées, un contrôle qualité
              systématique et un suivi digital de chaque intervention.
            </p>
            <div className="mcp-rise mt-9 flex flex-wrap gap-3" style={{ animationDelay: '240ms' }}>
              <Btn href="/devis-en-ligne" variant="gold"><Icon path={IconSpark} size={18} /> Demander un devis gratuit</Btn>
              <a href={PHONE_HREF} className="mcp-btn inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold" style={{ backgroundColor: 'transparent', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.22)' }}>
                <Icon path={IconPhone} size={18} /> {PHONE}
              </a>
            </div>
            <div className="mcp-rise mt-10 flex flex-wrap gap-x-8 gap-y-2 text-sm" style={{ animationDelay: '320ms', color: '#8A857C' }}>
              <span className="inline-flex items-center gap-2"><span style={{ color: GOLD }}><Icon path={IconCheck} size={16} /></span> Devis sous 24h</span>
              <span className="inline-flex items-center gap-2"><span style={{ color: GOLD }}><Icon path={IconCheck} size={16} /></span> Équipe formée &amp; encadrée</span>
              <span className="inline-flex items-center gap-2"><span style={{ color: GOLD }}><Icon path={IconCheck} size={16} /></span> Contrôle qualité systématique</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── CHIFFRES CLÉS ─────────────────────────────────────────────────── */}
      <section style={{ backgroundColor: INK, color: '#FFFFFF' }}>
        <div className="max-w-7xl mx-auto px-5 py-10 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {stats.map((s, i) => (
            <div key={s.label} data-reveal style={{ transitionDelay: `${i * 70}ms` }}>
              <p className="text-3xl md:text-4xl font-bold" data-count={s.value} style={{ color: GOLD, letterSpacing: '-0.02em' }}>{s.value}</p>
              <p className="mt-1 text-sm" style={{ color: '#B8B2A8' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── SECTEURS ──────────────────────────────────────────────────────── */}
      <section id="secteurs" className="max-w-7xl mx-auto px-5 py-20 md:py-28">
        <div data-reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: GOLD }}>Nos secteurs</p>
          <h2 className="mt-3 text-3xl md:text-4xl font-bold" style={{ letterSpacing: '-0.02em' }}>Un savoir-faire adapté à chaque activité</h2>
          <p className="mt-4 max-w-2xl" style={{ color: MUTED }}>
            Du professionnel de l’hébergement au particulier, nous ajustons nos protocoles,
            nos cadences et nos équipes à vos exigences.
          </p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {sectors.map((s, i) => (
            <a key={s.title} href={s.href} data-reveal className="mcp-card block rounded-2xl border p-7" style={{ backgroundColor: '#FFFFFF', borderColor: BORDER, transitionDelay: `${i * 70}ms` }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5" style={{ backgroundColor: 'rgba(201,168,76,0.12)', color: GOLD }}>
                <Icon path={s.icon} size={24} />
              </div>
              <h3 className="text-lg font-bold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: MUTED }}>{s.text}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: GOLD }}>En savoir plus <span aria-hidden>→</span></span>
            </a>
          ))}
        </div>
      </section>

      {/* ── PRESTATIONS ───────────────────────────────────────────────────── */}
      <section id="prestations" style={{ backgroundColor: '#FFFFFF', borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
        <div className="max-w-7xl mx-auto px-5 py-20 md:py-28 grid lg:grid-cols-2 gap-14 items-center">
          <div data-reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: GOLD }}>Nos prestations</p>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold" style={{ letterSpacing: '-0.02em' }}>Des interventions sur mesure, un standard constant</h2>
            <p className="mt-4" style={{ color: MUTED }}>
              Chaque prestation est cadrée, planifiée et contrôlée. Vous obtenez un
              résultat régulier, quel que soit le volume ou la fréquence.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Btn href="/devis-en-ligne" variant="gold"><Icon path={IconSpark} size={18} /> Obtenir mon devis</Btn>
              <Btn href="#contact" variant="outline">Nous contacter</Btn>
            </div>
          </div>
          <ul className="grid sm:grid-cols-2 gap-3">
            {services.map((s, i) => (
              <li key={s} data-reveal className="mcp-chip flex items-start gap-3 rounded-xl border p-4" style={{ borderColor: BORDER, backgroundColor: CREAM, transitionDelay: `${i * 60}ms` }}>
                <span className="mt-0.5 shrink-0" style={{ color: GOLD }}><Icon path={IconCheck} size={18} /></span>
                <span className="text-sm font-medium">{s}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── COMMENT ÇA MARCHE ─────────────────────────────────────────────── */}
      <section id="process" className="max-w-7xl mx-auto px-5 py-20 md:py-28">
        <div data-reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: GOLD }}>Comment ça marche</p>
          <h2 className="mt-3 text-3xl md:text-4xl font-bold" style={{ letterSpacing: '-0.02em' }}>De la demande à l’intervention, en 3 étapes</h2>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {steps.map((s, i) => (
            <div key={s.n} data-reveal className="mcp-card rounded-2xl border p-7" style={{ backgroundColor: '#FFFFFF', borderColor: BORDER, transitionDelay: `${i * 90}ms` }}>
              <p className="text-4xl font-bold" style={{ color: 'rgba(201,168,76,0.35)', letterSpacing: '-0.02em' }}>{s.n}</p>
              <h3 className="mt-3 text-lg font-bold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: MUTED }}>{s.text}</p>
            </div>
          ))}
        </div>
        <p data-reveal className="mt-8 text-sm" style={{ color: MUTED }}>
          Estimation immédiate grâce à notre <span className="font-semibold" style={{ color: INK }}>assistant de devis intelligent</span> — testez-le en ligne, sans engagement.
        </p>
      </section>

      {/* ── POURQUOI NOUS ─────────────────────────────────────────────────── */}
      <section id="pourquoi" className="max-w-7xl mx-auto px-5 pb-20 md:pb-28">
        <div data-reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: GOLD }}>Pourquoi MonCleanerPro</p>
          <h2 className="mt-3 text-3xl md:text-4xl font-bold" style={{ letterSpacing: '-0.02em' }}>Un service premium, pensé pour durer</h2>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {values.map((v, i) => (
            <div key={v.title} data-reveal className="mcp-card rounded-2xl p-7" style={{ backgroundColor: '#FFFFFF', border: `1px solid ${BORDER}`, transitionDelay: `${i * 70}ms` }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5" style={{ backgroundColor: INK, color: GOLD }}>
                <Icon path={v.icon} size={22} />
              </div>
              <h3 className="font-bold">{v.title}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: MUTED }}>{v.text}</p>
            </div>
          ))}
        </div>
        <div data-reveal className="mt-12 rounded-2xl border p-8 flex flex-wrap items-center gap-6 justify-between" style={{ borderColor: BORDER, backgroundColor: '#FFFFFF' }}>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(201,168,76,0.12)', color: GOLD }}>
              <Icon path={IconPin} size={24} />
            </div>
            <div>
              <p className="font-bold">Zone d’intervention</p>
              <p className="text-sm" style={{ color: MUTED }}>Lyon, Villeurbanne et l’ensemble de la métropole lyonnaise &amp; Rhône-Alpes.</p>
            </div>
          </div>
          <Btn href="/devis-en-ligne" variant="dark">Vérifier ma zone</Btn>
        </div>
      </section>

      {/* ── AVIS CLIENTS ──────────────────────────────────────────────────── */}
      <section id="avis" style={{ backgroundColor: '#FFFFFF', borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}` }}>
        <div className="max-w-7xl mx-auto px-5 py-20 md:py-28">
          <div data-reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: GOLD }}>Ils nous font confiance</p>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold" style={{ letterSpacing: '-0.02em' }}>Des clients exigeants, satisfaits durablement</h2>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {testimonials.map((t, i) => (
              <figure key={t.name} data-reveal className="mcp-card rounded-2xl p-7" style={{ backgroundColor: CREAM, border: `1px solid ${BORDER}`, transitionDelay: `${i * 90}ms` }}>
                <div className="flex gap-1 mb-4" style={{ color: GOLD }} aria-label="5 étoiles">
                  {[0, 1, 2, 3, 4].map(k => (
                    <svg key={k} width={16} height={16} viewBox="0 0 24 24" fill="currentColor"><path d="m12 2 2.9 6.3 6.8.7-5 4.6 1.4 6.7L12 17.8 5.9 20.9l1.4-6.7-5-4.6 6.8-.7Z" /></svg>
                  ))}
                </div>
                <blockquote className="text-sm leading-relaxed" style={{ color: INK }}>« {t.text} »</blockquote>
                <figcaption className="mt-4 text-sm"><span className="font-bold">{t.name}</span><span style={{ color: MUTED }}> · {t.role}</span></figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <section id="faq" className="max-w-7xl mx-auto px-5 py-20 md:py-28">
        <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-12">
          <div data-reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: GOLD }}>Questions fréquentes</p>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold" style={{ letterSpacing: '-0.02em' }}>Tout ce qu’il faut savoir</h2>
            <p className="mt-4" style={{ color: MUTED }}>Une autre question ? Appelez-nous, on répond vite.</p>
            <div className="mt-6"><Btn href={PHONE_HREF} variant="outline"><Icon path={IconPhone} size={18} /> {PHONE}</Btn></div>
          </div>
          <div data-reveal>
            {faq.map(f => (
              <details key={f.q} className="mcp-faq group py-5 border-b" style={{ borderColor: BORDER }}>
                <summary className="flex items-center justify-between cursor-pointer list-none font-semibold">
                  {f.q}
                  <span className="ml-4 shrink-0 transition-transform group-open:rotate-45" style={{ color: GOLD }}><Icon path={<><path d="M12 5v14M5 12h14" /></>} size={20} /></span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed" style={{ color: MUTED }}>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA CONTACT ───────────────────────────────────────────────────── */}
      <section id="contact" style={{ backgroundColor: VOID, color: '#FFFFFF' }}>
        <div className="max-w-7xl mx-auto px-5 py-20 md:py-24 text-center">
          <h2 data-reveal className="text-3xl md:text-5xl font-bold" style={{ letterSpacing: '-0.02em' }}>Prêt à confier votre nettoyage ?</h2>
          <p data-reveal className="mt-5 max-w-xl mx-auto text-lg" style={{ color: '#B8B2A8' }}>
            Recevez un devis gratuit et transparent sous 24h, sans engagement.
          </p>
          <div data-reveal className="mt-9 flex flex-wrap justify-center gap-3">
            <Btn href="/devis-en-ligne" variant="gold"><Icon path={IconSpark} size={18} /> Demander un devis gratuit</Btn>
            <a href={`${APP_URL}/login`} target="_blank" rel="noopener noreferrer" className="mcp-btn inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold" style={{ backgroundColor: 'transparent', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.22)' }}>
              <Icon path={IconUsers} size={18} /> Accéder à mon espace
            </a>
          </div>
          <div data-reveal className="mt-10 flex flex-wrap justify-center gap-x-10 gap-y-3 text-sm" style={{ color: '#B8B2A8' }}>
            <a href={PHONE_HREF} className="mcp-link inline-flex items-center gap-2 hover:opacity-80"><span style={{ color: GOLD }}><Icon path={IconPhone} size={16} /></span> {PHONE}</a>
            <a href={`mailto:${EMAIL}`} className="mcp-link inline-flex items-center gap-2 hover:opacity-80"><span style={{ color: GOLD }}><Icon path={IconMail} size={16} /></span> {EMAIL}</a>
          </div>
        </div>
      </section>

      {/* ── ZONES DESSERVIES (SEO local longue traîne) ────────────────────── */}
      <section aria-label="Zones desservies" style={{ backgroundColor: CREAM, borderTop: `1px solid ${BORDER}` }}>
        <div className="max-w-7xl mx-auto px-5 py-12">
          <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: GOLD }}>Zones desservies</p>
          <h2 className="mt-2 text-lg font-bold">Nettoyage professionnel à Lyon, dans la métropole et le Beaujolais</h2>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: MUTED }}>
            {['Lyon 1er', 'Lyon 2e', 'Lyon 3e', 'Lyon 4e', 'Lyon 5e', 'Lyon 6e', 'Lyon 7e', 'Lyon 8e', 'Lyon 9e'].join(' · ')}
          </p>
          {/* Les communes qui ont leur page deviennent des liens : c'est le maillage
              interne le plus utile de la page, il pousse chaque page locale. */}
          <p className="mt-2 text-sm leading-relaxed" style={{ color: MUTED }}>
            {SEO_PAGES.filter(p => getCityGeo(p.slug) && !p.cluster).map((p, i, arr) => (
              <span key={p.slug}>
                <a href={`/${p.slug}`} className="mcp-link hover:opacity-75" style={{ color: INK, textDecorationLine: 'underline', textDecorationColor: BORDER, textUnderlineOffset: 3 }}>
                  {getCityGeo(p.slug)!.city}
                </a>
                {i < arr.length - 1 ? ' · ' : ''}
              </span>
            ))}
            {' '}— ainsi que les communes du Beaujolais et des Pierres Dorées, et l’ensemble du Rhône-Alpes.
          </p>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────────────────── */}
      <footer style={{ backgroundColor: INK, color: '#B8B2A8' }}>
        {/* Maillage interne vers les pages SEO (crawlabilité + référencement).
            Séparé prestations / communes : un bloc unique mélangeant les deux
            envoie un signal thématique flou et vieillit mal quand les pages
            se multiplient. */}
        <div className="max-w-7xl mx-auto px-5 pt-12 pb-2 grid gap-8 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: GOLD }}>Nos prestations à Lyon</p>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {SEO_PAGES.filter(p => !getCityGeo(p.slug) && p.scope !== 'national').map(p => (
                <a key={p.slug} href={`/${p.slug}`} className="mcp-link hover:opacity-80" style={{ color: '#B8B2A8' }}>{p.keyword}</a>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: GOLD }}>Nos interventions par commune</p>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {SEO_PAGES.filter(p => getCityGeo(p.slug) && p.scope !== 'national').map(p => (
                <a key={p.slug} href={`/${p.slug}`} className="mcp-link hover:opacity-80" style={{ color: '#B8B2A8' }}>{p.keyword}</a>
              ))}
            </div>
          </div>
        </div>

        {/* Bloc distinct pour l'activité « gros chantiers » nationale : la mélanger
            aux prestations lyonnaises brouillerait les deux signaux — le local
            porte le récurrent, le national porte les grosses opérations. */}
        <div className="max-w-7xl mx-auto px-5 pt-8 pb-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-3" style={{ color: GOLD }}>Gros chantiers — France entière</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {SEO_PAGES.filter(p => p.scope === 'national').map(p => (
              <a key={p.slug} href={`/${p.slug}`} className="mcp-link hover:opacity-80" style={{ color: '#B8B2A8' }}>{p.keyword}</a>
            ))}
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-5 py-12 flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <img src="/logo-mark.png" alt="MonCleanerPro" width={38} height={38} style={{ width: 38, height: 38, borderRadius: 9 }} />
            <div>
              <p className="font-bold text-[15px]" style={{ color: '#FFFFFF' }}>MonCleaner<span style={{ color: GOLD }}>Pro</span></p>
              <p className="text-xs">Nettoyage professionnel · Lyon &amp; Rhône-Alpes</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-7 gap-y-2 text-sm">
            <a href="#secteurs" className="mcp-link hover:opacity-80">Secteurs</a>
            <a href="#prestations" className="mcp-link hover:opacity-80">Prestations</a>
            <a href="/blog" className="mcp-link hover:opacity-80">Blog</a>
            <a href="/devis-en-ligne" className="mcp-link hover:opacity-80">Devis gratuit</a>
            <a href={`${APP_URL}/login`} target="_blank" rel="noopener noreferrer" className="mcp-link hover:opacity-80">Espace client</a>
          </div>
        </div>
        <div className="border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="max-w-7xl mx-auto px-5 py-5 text-xs flex flex-wrap items-center justify-between gap-3">
            <span>© {new Date().getFullYear()} MonCleanerPro. Tous droits réservés.</span>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
              <a href="/mentions-legales" className="mcp-link hover:opacity-80">Mentions légales</a>
              <a href="/confidentialite" className="mcp-link hover:opacity-80">Confidentialité</a>
              <span>{PHONE} · {EMAIL}</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Boutons flottants — appel & WhatsApp toujours accessibles (surtout mobile).
          Lèvent la friction : un visiteur peut contacter à tout moment sans remonter. */}
      <div className="fixed z-40 right-4 flex flex-col items-end gap-2.5" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 18px)' }}>
        <a href="https://wa.me/33783431700?text=Bonjour%2C%20je%20souhaite%20un%20devis%20de%20nettoyage."
          target="_blank" rel="noopener noreferrer" aria-label="Contacter par WhatsApp"
          className="flex items-center justify-center rounded-full shadow-lg active:scale-95"
          style={{ width: 52, height: 52, backgroundColor: '#25D366', color: '#FFFFFF' }}>
          <Icon path={IconWhatsApp} size={26} />
        </a>
        <a href={PHONE_HREF} aria-label="Appeler MonCleanerPro"
          className="inline-flex items-center gap-2 rounded-full shadow-lg pl-4 pr-5 font-semibold text-sm active:scale-95"
          style={{ height: 52, backgroundColor: GOLD, color: INK }}>
          <Icon path={IconPhone} size={20} /> Appeler
        </a>
      </div>
    </main>
  );
}
