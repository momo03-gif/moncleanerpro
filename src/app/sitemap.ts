import type { MetadataRoute } from 'next';

// sitemap.xml — pages publiques de la vitrine (domaine moncleanerpro.fr).
// La home sert la vitrine ; /devis-en-ligne est le devis IA public.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://moncleanerpro.fr';
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: 'monthly', priority: 1 },
    { url: `${base}/devis-en-ligne`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
  ];
}
