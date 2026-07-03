import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Perf : tree-shaking ciblé des grosses libs pour n'embarquer que ce qui est
  // réellement utilisé dans chaque page (réduit le bundle initial).
  experimental: {
    optimizePackageImports: ['@sentry/nextjs', 'leaflet', '@supabase/supabase-js'],
  },
};

export default nextConfig;
