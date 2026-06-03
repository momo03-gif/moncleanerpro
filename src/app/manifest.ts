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
      { src: '/icon/192', sizes: '192x192', type: 'image/png' },
      { src: '/icon/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icon/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
    shortcuts: [
      { name: 'Missions', url: '/cleaner', icons: [{ src: '/icon/96', sizes: '96x96' }] },
      { name: 'Admin', url: '/admin', icons: [{ src: '/icon/96', sizes: '96x96' }] },
    ],
  };
}
