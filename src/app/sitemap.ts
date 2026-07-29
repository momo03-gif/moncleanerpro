import type { MetadataRoute } from 'next';
import { SEO_PAGES, SEO_CONTENT_UPDATED } from '@/lib/seoPages';
import { BLOG_POSTS } from '@/lib/blogPosts';

// sitemap.xml — pages publiques de la vitrine (domaine moncleanerpro.fr).
// Home + devis IA public + pages d'atterrissage SEO + blog + pages légales.
//
// `lastModified` reflète la dernière révision RÉELLE du contenu (constante pour
// les pages SEO, date de publication pour les articles) et non la date du build :
// un sitemap qui déclare tout modifié à chaque déploiement perd sa crédibilité
// auprès des moteurs.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://moncleanerpro.fr';
  const seoUpdated = new Date(SEO_CONTENT_UPDATED);
  const lastPost = BLOG_POSTS.reduce(
    (acc, p) => (new Date(p.date) > acc ? new Date(p.date) : acc),
    new Date(0),
  );

  return [
    { url: `${base}/`, lastModified: seoUpdated, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/devis-en-ligne`, lastModified: seoUpdated, changeFrequency: 'monthly', priority: 0.9 },
    ...SEO_PAGES.map(p => ({
      url: `${base}/${p.slug}`,
      lastModified: new Date(p.updatedAt ?? SEO_CONTENT_UPDATED),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    { url: `${base}/blog`, lastModified: lastPost, changeFrequency: 'weekly', priority: 0.7 },
    ...BLOG_POSTS.map(p => ({
      url: `${base}/blog/${p.slug}`,
      lastModified: new Date(p.date),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
    { url: `${base}/mentions-legales`, lastModified: seoUpdated, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/confidentialite`, lastModified: seoUpdated, changeFrequency: 'yearly', priority: 0.2 },
  ];
}
