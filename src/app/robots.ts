import type { MetadataRoute } from 'next';

// robots.txt — on autorise l'indexation de la vitrine publique, mais on exclut
// tout l'espace applicatif privé (admin, cleaner, hôtel, API, comptes).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin', '/cleaner', '/hotel', '/airbnb',
        '/api/', '/login', '/register', '/reset', '/offline', '/devis/',
      ],
    },
    sitemap: 'https://moncleanerpro.fr/sitemap.xml',
    host: 'https://moncleanerpro.fr',
  };
}
