import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MonCleanerPro',
    short_name: 'MonCleaner',
    description: 'Plateforme professionnelle de nettoyage hôtelier',
    start_url: '/',
    display: 'standalone',
    background_color: '#FAFAF8',
    theme_color: '#C9A84C',
    orientation: 'portrait-primary',
    categories: ['business', 'productivity'],
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Missions', url: '/cleaner', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
      { name: 'Admin', url: '/admin', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
    ],
  };
}
