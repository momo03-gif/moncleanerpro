// ══════════════════════════════════════════════════════════════════════════════
//  Accès partenaire : le message qu'on transmet à un hôtel ou une conciergerie
//  pour qu'il se connecte (lien de l'application, identifiant, mot de passe).
//
//  Un mot de passe enregistré est HACHÉ (bcrypt) : il est illisible, y compris
//  pour l'administrateur. On ne peut donc jamais « recopier » le mot de passe
//  existant d'un partenaire — on en génère un nouveau, qu'on lui transmet.
//  C'est volontaire : un mot de passe qu'on pourrait relire serait un mot de
//  passe qu'une fuite de base révélerait.
// ══════════════════════════════════════════════════════════════════════════════

/** Adresse publique de l'application (celle que le partenaire doit ouvrir). */
export const APP_URL = 'https://app.moncleanerpro.fr';

/** Page de connexion — le lien exact qu'on colle dans le message. */
export const APP_LOGIN_URL = `${APP_URL}/login`;

// Alphabet sans caractères ambigus : ni O/0, ni I/l/1. Un mot de passe se relit
// souvent au téléphone ou se recopie depuis un SMS — « 0 ou O ? » coûte un appel.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

/**
 * Mot de passe provisoire lisible : 12 caractères tirés au sort, coupés en deux
 * groupes par un tiret pour rester dictable (« mK7q-t4Rn2p »).
 *
 * @param length  longueur totale, 12 par défaut (au-delà du minimum de 6 exigé
 *                par le formulaire, sans devenir impossible à recopier).
 */
export function generatePassword(length = 12): string {
  const n = Math.max(8, Math.floor(length));
  const bytes = new Uint32Array(n);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < n; i++) bytes[i] = Math.floor(Math.random() * 0xffffffff);
  }
  let out = '';
  for (let i = 0; i < n; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

export interface PartnerAccessInfo {
  /** Nom du partenaire — sert à personnaliser le message. */
  name?: string;
  /** Identifiant de connexion : c'est l'email du compte. */
  email: string;
  /** Mot de passe en clair : uniquement celui qu'on vient de définir. */
  password?: string | null;
  /** Lien de l'application (surchargeable pour les tests / un autre domaine). */
  url?: string;
}

/**
 * Message prêt à envoyer (email, SMS, WhatsApp). Rédigé au « nous » et signé au
 * nom de l'équipe : un accès est transmis par l'entreprise, pas par une personne.
 * Sans mot de passe, le message se limite au lien et à l'identifiant.
 */
export function buildAccessMessage({ name, email, password, url = APP_LOGIN_URL }: PartnerAccessInfo): string {
  const lines = [
    `Bonjour${name ? ` ${name}` : ''},`,
    '',
    'Voici vos accès à votre espace MonCleanerPro :',
    '',
    `Lien : ${url}`,
    `Identifiant : ${email}`,
  ];
  if (password) {
    lines.push(`Mot de passe : ${password}`);
    lines.push('');
    lines.push('Nous vous invitons à modifier ce mot de passe après votre première connexion.');
  }
  lines.push('');
  lines.push('Bien à vous,');
  lines.push('L’équipe MonCleanerPro');
  return lines.join('\n');
}

/**
 * Copie un texte dans le presse-papiers. Renvoie `false` plutôt que de lever :
 * l'appel échoue hors HTTPS et dans certains navigateurs mobiles, et l'écran
 * doit alors le dire au lieu de laisser croire que la copie a eu lieu.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* refus du navigateur : on tente la méthode de repli */ }
  try {
    if (typeof document === 'undefined') return false;
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch { return false; }
}
