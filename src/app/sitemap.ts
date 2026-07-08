import type { MetadataRoute } from 'next';
import { SEO_SLUGS } from '@/lib/seoPages';
import { BLOG_SLUGS } from '@/lib/blogPosts';

// sitemap.xml — pages publiques de la vitrine (domaine moncleanerpro.fr).
// Home + devis IA public + pages d'atterrissage SEO (service × Lyon).
export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://moncleanerpro.fr';
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/devis-en-ligne`, lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    ...SEO_SLUGS.map(slug => ({
      url: `${base}/${slug}`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.8,
    })),
    { url: `${base}/blog`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    ...BLOG_SLUGS.map(slug => ({
      url: `${base}/blog/${slug}`, lastModified: now, changeFrequency: 'monthly' as const, priority: 0.6,
    })),
    { url: `${base}/mentions-legales`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/confidentialite`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
  ];
}
