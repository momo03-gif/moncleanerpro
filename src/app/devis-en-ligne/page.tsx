import type { Metadata } from 'next';
import PageClient from './PageClient';

// ══════════════════════════════════════════════════════════════════════════════
//  Page publique « Demander un devis ».
//
//  Cette page était un composant CLIENT, et un composant client ne peut pas
//  exporter `metadata` : elle est donc restée sans titre, sans description, sans
//  canonical et sans balisage — alors que c'est la page vers laquelle pointent
//  TOUS les appels à l'action du site. Google la voyait comme une page vide
//  intitulée « MonCleanerPro ».
//
//  L'enveloppe redevient un composant serveur : elle porte les métadonnées et le
//  balisage, et rend le formulaire (client) qui, lui, est désormais rendu côté
//  serveur — le contenu existe dans le HTML au lieu d'apparaître après le JS.
// ══════════════════════════════════════════════════════════════════════════════

const URL = 'https://moncleanerpro.fr/devis-en-ligne';

export const metadata: Metadata = {
  title: 'Devis de nettoyage à Lyon — estimation immédiate en ligne',
  description:
    "Obtenez une estimation de nettoyage en quelques minutes : ménage, Airbnb, bureaux, fin de chantier, fin de bail. Devis écrit sous 24h, sans engagement.",
  alternates: { canonical: URL },
  openGraph: {
    title: 'Devis de nettoyage à Lyon — estimation immédiate',
    description:
      "Décrivez votre besoin, obtenez une fourchette tout de suite et un devis écrit sous 24h. Sans engagement.",
    url: URL,
    siteName: 'MonCleanerPro',
    locale: 'fr_FR',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'Demander un devis de nettoyage à Lyon' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Devis de nettoyage à Lyon — estimation immédiate',
    description: "Décrivez votre besoin, obtenez une fourchette tout de suite et un devis écrit sous 24h.",
    images: ['/og-image.png'],
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 } },
};

// Balisage : c'est un service que l'on demande en ligne. On décrit l'action
// « demander un devis » plutôt que la page, ce qui est ce que Google comprend.
const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Demander un devis de nettoyage à Lyon',
  url: URL,
  description:
    "Estimation immédiate en ligne pour un nettoyage à Lyon et dans la métropole : ménage, location courte durée, bureaux, fin de chantier, fin de bail.",
  inLanguage: 'fr-FR',
  isPartOf: { '@type': 'WebSite', name: 'MonCleanerPro', url: 'https://moncleanerpro.fr' },
  potentialAction: {
    '@type': 'Action',
    name: 'Demander un devis',
    target: URL,
  },
};

export default function DevisEnLignePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <PageClient />
    </>
  );
}
