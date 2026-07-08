import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Perf : tree-shaking ciblé des grosses libs pour n'embarquer que ce qui est
  // réellement utilisé dans chaque page (réduit le bundle initial).
  experimental: {
    optimizePackageImports: ['@sentry/nextjs', 'leaflet', '@supabase/supabase-js'],
  },

  // Adresse canonique unique : on redirige www → sans-www (301), sur toutes les
  // pages. Évite le contenu dupliqué (SEO) et une seule URL officielle.
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.moncleanerpro.fr' }],
        destination: 'https://moncleanerpro.fr/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
