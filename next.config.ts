import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Perf : tree-shaking ciblé des grosses libs pour n'embarquer que ce qui est
  // réellement utilisé dans chaque page (réduit le bundle initial).
  experimental: {
    optimizePackageImports: ['@sentry/nextjs', 'leaflet', '@supabase/supabase-js'],
  },

  // Redirections des adresses « attendues » vers les pages réelles.
  // Ces URL sont celles que les visiteurs (et nous-mêmes) tapent spontanément :
  // sans redirection elles renvoient un 404. Créer une seconde page au contenu
  // identique serait pire — c'est du contenu dupliqué. Redirection permanente
  // (308) : Google transfère le référencement vers l'URL canonique.
  async redirects() {
    return [
      { source: '/politique-confidentialite', destination: '/confidentialite', permanent: true },
      { source: '/politique-de-confidentialite', destination: '/confidentialite', permanent: true },
      { source: '/donnees-personnelles', destination: '/confidentialite', permanent: true },
      { source: '/mentions', destination: '/mentions-legales', permanent: true },
      { source: '/cgv', destination: '/conditions-generales', permanent: true },
      { source: '/conditions-generales-de-vente', destination: '/conditions-generales', permanent: true },
      { source: '/cgu', destination: '/conditions-generales', permanent: true },
    ];
  },
};

export default nextConfig;
