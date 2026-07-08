// Manifest PWA servi comme route (et NON via app/manifest.ts) : ainsi Next
// n'injecte pas automatiquement le <link rel="manifest"> sur toutes les pages.
// Le lien est ajouté côté client UNIQUEMENT sur le domaine app (voir PwaSetup),
// pour que la vitrine (moncleanerpro.fr) ne soit jamais installable comme « app ».
export const dynamic = 'force-static';

export function GET() {
  const manifest = {
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
  return new Response(JSON.stringify(manifest), {
    headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'public, max-age=3600' },
  });
}
