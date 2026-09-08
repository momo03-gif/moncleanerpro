// ══════════════════════════════════════════════════════════════════════════════
//  D'où vient une demande de devis.
//
//  Les 15 demandes reçues jusqu'ici portent toutes la même étiquette : impossible
//  de dire si elles viennent d'une page SEO, de l'accueil ou d'un lien direct. On
//  ne peut donc pas savoir quel contenu rapporte, et la prochaine décision de
//  référencement se prendrait au jugé.
//
//  On enregistre UNE chaîne courte et lisible : le chemin interne de la page
//  d'origine (« /femme-de-menage-lyon »), le domaine externe qui a envoyé le
//  visiteur (« google.com »), ou « direct ».
//
//  VIE PRIVÉE : la requête est retirée de l'URL. Un référent peut contenir des
//  paramètres personnels, et ils n'ont rien à faire dans notre base.
// ══════════════════════════════════════════════════════════════════════════════

/** Longueur maximale stockée : au-delà, ce n'est plus une origine mais un log. */
const MAX = 120;

const clean = (v: string) => v.trim().slice(0, MAX);

/**
 * @param referrer  `document.referrer` (peut être vide)
 * @param siteHost  hôte du site, pour distinguer navigation interne et externe
 * @param src       paramètre `?src=` explicite (campagne, QR code, flyer…)
 */
export function resolveOrigin(referrer: string | null | undefined, siteHost: string, src?: string | null): string {
  // Une origine déclarée explicitement l'emporte : c'est la seule qui puisse
  // décrire un canal hors-ligne (flyer, QR code, carte de visite).
  if (src && src.trim()) return clean(src);

  if (!referrer || !referrer.trim()) return 'direct';

  let url: URL;
  try { url = new URL(referrer); } catch { return 'direct'; }

  // Navigation interne : on garde le chemin, c'est LA donnée utile.
  if (url.hostname === siteHost || url.hostname === `www.${siteHost}`) {
    const path = url.pathname.replace(/\/+$/, '') || '/';
    return clean(path);
  }

  // Externe : le domaine suffit, et le « www. » n'apporte rien.
  return clean(url.hostname.replace(/^www\./, ''));
}

/** Libellé lisible pour l'écran d'administration. */
export function originLabel(origine: string | null | undefined): string {
  const v = (origine ?? '').trim();
  if (!v) return 'Non renseignée';
  if (v === 'direct') return 'Accès direct';
  if (v === '/') return 'Page d’accueil';
  if (v.startsWith('/')) return `Page ${v}`;
  return `Depuis ${v}`;
}
