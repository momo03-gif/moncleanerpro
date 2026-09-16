// ── /.well-known/assetlinks.json (Digital Asset Links — Android) ─────────────────
// Prouve à Android que l'app du Play Store et ce domaine appartiennent au même
// éditeur. SANS ce fichier valide, l'application Android (TWA) affiche une barre
// d'adresse Chrome en haut de l'écran : elle ne ressemble plus à une application.
//
// Servi par une ROUTE et non par un fichier statique dans `public/`, pour deux
// raisons :
//   • l'empreinte du certificat n'est connue qu'APRÈS le 1er envoi sur le Play
//     Console (c'est Google qui signe l'app, via Play App Signing) ;
//   • on peut donc la renseigner dans une variable Vercel, sans toucher au code.
//
// Variable : ANDROID_SHA256_FINGERPRINTS — une ou plusieurs empreintes séparées
// par des virgules (format AA:BB:CC:…). Mettre AU MOINS celle de « Play App
// Signing », et idéalement aussi celle de la clé d'upload (tests locaux).
// Le mapping d'URL vers cette route est déclaré dans next.config.ts.

export const dynamic = 'force-dynamic';

const PACKAGE_NAME = process.env.ANDROID_PACKAGE_NAME || 'fr.moncleanerpro.app';

export function GET() {
  const fingerprints = (process.env.ANDROID_SHA256_FINGERPRINTS ?? '')
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(Boolean);

  const body = [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: PACKAGE_NAME,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      // Court : tant que l'empreinte n'est pas renseignée, on veut que la
      // correction soit prise en compte vite (Android revalide régulièrement).
      'Cache-Control': 'public, max-age=300',
    },
  });
}
