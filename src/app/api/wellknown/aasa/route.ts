// ── /.well-known/apple-app-site-association (Universal Links — iOS) ──────────────
// Permet à iOS d'ouvrir l'application quand on clique sur un lien
// app.moncleanerpro.fr (email de mission, lien de devis, notification…) au lieu
// d'ouvrir Safari. Sans ce fichier, tous les liens sortent de l'app.
//
// ⚠️ Contraintes Apple : servi en application/json, SANS redirection, SANS
// extension .json dans l'URL, et accessible en HTTPS sans authentification.
//
// Variables :
//   APPLE_TEAM_ID    — identifiant d'équipe du compte Apple Developer (10 car.)
//   IOS_BUNDLE_ID    — identifiant du bundle (défaut : fr.moncleanerpro.app)
// Tant que APPLE_TEAM_ID n'est pas renseignée, on renvoie une liste vide : c'est
// un fichier valide et inerte, jamais une erreur 500.

export const dynamic = 'force-dynamic';

const BUNDLE_ID = process.env.IOS_BUNDLE_ID || 'fr.moncleanerpro.app';

export function GET() {
  const team = (process.env.APPLE_TEAM_ID ?? '').trim();
  const appIDs = team ? [`${team}.${BUNDLE_ID}`] : [];

  const body = {
    applinks: {
      details: appIDs.length
        ? [
            {
              appIDs,
              components: [
                // Les espaces privés s'ouvrent dans l'app…
                { '/': '/cleaner/*' },
                { '/': '/admin/*' },
                { '/': '/hotel/*' },
                { '/': '/airbnb/*' },
                { '/': '/login' },
                // …mais PAS la vitrine ni les pages SEO : elles doivent rester
                // dans le navigateur (partage, référencement, aperçus).
              ],
            },
          ]
        : [],
    },
    // Autorise le remplissage du mot de passe enregistré par iOS sur /login.
    webcredentials: { apps: appIDs },
  };

  return new Response(JSON.stringify(body, null, 2), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
  });
}
