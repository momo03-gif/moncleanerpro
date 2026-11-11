// Sentry — initialisation côté CLIENT (navigateur). Capture les erreurs JS des
// utilisateurs (cleaners, hôtels, admin) en conditions réelles.
//
// Perf : le SDK @sentry/nextjs pèse ~440 Ko et était chargé sur CHAQUE page dans
// le bundle critique, ce qui ralentissait le premier affichage. On le charge
// désormais en DIFFÉRÉ (dynamic import après que la page soit interactive) : il
// devient un chunk asynchrone hors du chemin critique. La surveillance des
// erreurs reste active dès que le navigateur est au repos ; seules d'éventuelles
// erreurs dans les toutes premières secondes ne sont pas capturées (compromis
// assumé pour la rapidité).
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Vitrine (moncleanerpro.fr : accueil, pages SEO, blog, devis) : PAS de Sentry.
// Même différé, son exécution bloquait le téléphone ~0,5 s pendant la mesure de
// vitesse de Google — pour surveiller des pages statiques qui ne plantent pas.
// Il reste chargé là où il sert : l'APPLICATION (app.moncleanerpro.fr et les
// espaces connectés).
const estApplication = typeof window !== 'undefined' && (
  window.location.hostname.startsWith('app.')
  || /^\/(?:(?:admin|cleaner|airbnb|hotel|prestataire|login|register|reset)(?:\/|$)|devis\/)/.test(window.location.pathname)
);

if (dsn && typeof window !== 'undefined' && estApplication) {
  const loadSentry = () =>
    import('@sentry/nextjs').then((Sentry) => {
      Sentry.init({ dsn, enabled: true, tracesSampleRate: 0, sendDefaultPii: false });
    });

  if ('requestIdleCallback' in window) {
    (window as unknown as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(loadSentry);
  } else {
    setTimeout(loadSentry, 2000);
  }
}
