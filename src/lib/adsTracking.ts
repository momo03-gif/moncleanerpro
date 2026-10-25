// ── Conversions Google Ads, sous consentement (côté navigateur) ─────────────
//
// POURQUOI. Une campagne au « CPA cible » apprend de ses conversions : sans
// elles, Google enchérit à l'aveugle. On compte trois gestes — une demande de
// devis envoyée, un rendez-vous pris, un contact (appel ou WhatsApp).
//
// LE CONSENTEMENT. La balise Google Ads dépose des cookies : rien n'est chargé
// avant un « Accepter » explicite (CNIL — pas de dépôt ni d'envoi avant accord,
// refuser aussi simple qu'accepter, choix redemandé au bout de 6 mois). On a
// préféré ce mode « basique » au mode avancé de Google, qui envoie des signaux
// sans cookie avant l'accord : sa conformité n'est pas tranchée en France.
//
// LA CONFIGURATION vit dans les variables d'environnement (Vercel) : tant que
// NEXT_PUBLIC_GOOGLE_ADS_ID est vide, tout ce module est muet et le bandeau
// ne s'affiche pas. Chaque conversion a son libellé, créé dans Google Ads.

export const ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID ?? '';

const LABELS = {
  devis: process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL_DEVIS ?? '',
  rendezvous: process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL_RDV ?? '',
  contact: process.env.NEXT_PUBLIC_GOOGLE_ADS_LABEL_CONTACT ?? '',
};
export type ConversionKind = keyof typeof LABELS;

// ── Le choix du visiteur ─────────────────────────────────────────────────────

const CLE = 'mcp-consent-ads';
const VALIDITE_MS = 182 * 24 * 3_600_000;   // ≈ 6 mois, recommandation CNIL
/** Événement qui rouvre le bandeau (lien « Gérer les cookies »). */
export const CONSENT_OPEN_EVENT = 'mcp:consent-open';
/** Événement émis après un choix, pour que la balise se charge sans recharger la page. */
export const CONSENT_CHANGE_EVENT = 'mcp:consent-change';

export type ConsentChoice = 'granted' | 'denied';

/** Le choix en cours de validité, ou null s'il faut (re)demander. */
export function readConsent(): ConsentChoice | null {
  try {
    const v = JSON.parse(localStorage.getItem(CLE) ?? 'null') as { c?: string; at?: number } | null;
    if (!v || (v.c !== 'granted' && v.c !== 'denied') || !v.at || Date.now() - v.at > VALIDITE_MS) return null;
    return v.c;
  } catch { return null; }
}

export function saveConsent(c: ConsentChoice) {
  try { localStorage.setItem(CLE, JSON.stringify({ c, at: Date.now() })); } catch { /* navigation privée */ }
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGE_EVENT, { detail: c }));
}

export function openConsent() {
  window.dispatchEvent(new Event(CONSENT_OPEN_EVENT));
}

// ── La balise ────────────────────────────────────────────────────────────────

type Gtag = (...args: unknown[]) => void;
declare global {
  interface Window { dataLayer?: unknown[]; gtag?: Gtag }
}

/** Charge gtag.js une seule fois — à n'appeler qu'après consentement. */
export function loadAdsTag() {
  if (!ADS_ID || typeof window === 'undefined' || window.gtag) return;
  window.dataLayer = window.dataLayer ?? [];
  // gtag attend l'objet `arguments` lui-même, pas un tableau.
  // eslint-disable-next-line prefer-rest-params
  window.gtag = function gtag() { window.dataLayer!.push(arguments); } as Gtag;
  window.gtag('js', new Date());
  window.gtag('config', ADS_ID);
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ADS_ID)}`;
  document.head.appendChild(s);
}

/**
 * Compte une conversion. Muet si la balise n'est pas configurée, si le libellé
 * manque ou si le visiteur n'a pas accepté : jamais d'erreur sur le parcours.
 */
export function trackConversion(kind: ConversionKind) {
  try {
    const label = LABELS[kind];
    if (!ADS_ID || !label || readConsent() !== 'granted' || !window.gtag) return;
    window.gtag('event', 'conversion', { send_to: `${ADS_ID}/${label}` });
  } catch { /* la mesure ne doit jamais gêner un client */ }
}
