// ── La fiche d'accueil d'un logement (logique PURE) ──────────────────────────
//
//  Ce qu'une conciergerie répète vingt fois par semaine : le code du wifi, où
//  sont les poubelles, à quelle heure il faut partir. Une fiche posée dans le
//  logement y répond une fois, et un QR wifi évite au voyageur de recopier une
//  clé de vingt caractères sur un téléphone.
//
//  DEUX FICHES, ET LA DISTINCTION N'EST PAS COSMÉTIQUE :
//   · la fiche VOYAGEUR est affichée dans le logement. Elle ne porte JAMAIS les
//     codes d'accès : le voyageur est déjà entré, et les y écrire revient à
//     donner l'accès à tous ceux qui viendront après lui ;
//   · la fiche INTERVENANT ne quitte pas nos écrans. Elle porte les codes, le
//     contact de secours, la vidéo d'accès — ce qu'il faut pour entrer et
//     travailler.

/** Ce dont une fiche a besoin, quelle que soit sa destination. */
export interface DonneesFiche {
  name: string;
  address: string;
  wifiSsid?: string;
  wifiPassword?: string;
  wifiSecurity?: 'WPA' | 'WEP' | 'nopass';
  checkinTime?: string;
  checkoutTime?: string;
  poubelles?: string;
  parking?: string;
  equipements?: string;
  consignesDepart?: string;
  aProximite?: string;
  onSiteContactName?: string;
  onSiteContactPhone?: string;
  // Réservés à la fiche interne.
  portalCode?: string;
  keyboxCode?: string;
  entryDirectives?: string;
  accessVideoUrl?: string;
}

/**
 * Échappement du format QR wifi.
 *
 * `;` `,` `:` et `\` séparent les champs : une clé qui en contient un casserait
 * le QR, et le téléphone afficherait un mot de passe tronqué sans rien dire.
 * Ces caractères sont fréquents dans les clés des box françaises.
 */
function echapper(v: string): string {
  return v.replace(/([\\;,:"])/g, '\\$1');
}

/**
 * Le contenu d'un QR code wifi, au format que lisent iOS et Android.
 *
 *     WIFI:T:WPA;S:MonReseau;P:maclef;;
 *
 * Renvoie `null` quand il manque le nom du réseau : un QR incomplet est pire
 * qu'une absence de QR — le voyageur le scanne, rien ne se passe, et il appelle.
 */
export function qrWifi(d: Pick<DonneesFiche, 'wifiSsid' | 'wifiPassword' | 'wifiSecurity'>): string | null {
  const ssid = (d.wifiSsid ?? '').trim();
  if (!ssid) return null;

  const motDePasse = (d.wifiPassword ?? '').trim();
  // Un réseau sans clé se déclare explicitement : sans `T:nopass`, le téléphone
  // attend un mot de passe et la connexion échoue.
  const type = motDePasse ? (d.wifiSecurity ?? 'WPA') : 'nopass';

  const champs = [`T:${type}`, `S:${echapper(ssid)}`];
  if (motDePasse) champs.push(`P:${echapper(motDePasse)}`);
  return `WIFI:${champs.join(';')};;`;
}

/** Une rubrique de la fiche : un titre, et ce qu'il y a à dire. */
export interface Rubrique { titre: string; texte: string }

/**
 * Les rubriques d'une fiche VOYAGEUR, dans l'ordre où on les lit.
 *
 * Une rubrique vide n'est pas affichée : une fiche à moitié remplie, avec des
 * titres suivis de rien, donne l'impression d'un logement mal tenu.
 */
export function rubriquesVoyageur(d: DonneesFiche): Rubrique[] {
  const horaires = [
    d.checkinTime ? `Arrivée : ${d.checkinTime}` : null,
    d.checkoutTime ? `Départ : ${d.checkoutTime}` : null,
  ].filter(Boolean).join('   ·   ');

  return ([
    { titre: 'Horaires', texte: horaires },
    { titre: 'Au départ', texte: d.consignesDepart ?? '' },
    { titre: 'Poubelles', texte: d.poubelles ?? '' },
    { titre: 'Stationnement', texte: d.parking ?? '' },
    { titre: 'Équipements', texte: d.equipements ?? '' },
    { titre: 'À proximité', texte: d.aProximite ?? '' },
  ] as Rubrique[]).filter(r => r.texte.trim() !== '');
}

/**
 * Les rubriques d'une fiche INTERVENANT.
 *
 * Elle porte les codes, ce que la fiche voyageur ne fera jamais. Elle ne quitte
 * pas nos écrans : ni impression laissée sur place, ni envoi au client.
 */
export function rubriquesIntervenant(d: DonneesFiche): Rubrique[] {
  const acces = [
    d.portalCode ? `Portail : ${d.portalCode}` : null,
    d.keyboxCode ? `Boîte à clé : ${d.keyboxCode}` : null,
  ].filter(Boolean).join('   ·   ');

  const contact = d.onSiteContactName || d.onSiteContactPhone
    ? [d.onSiteContactName, d.onSiteContactPhone].filter(Boolean).join(' — ')
    : '';

  return ([
    { titre: 'Codes d’accès', texte: acces },
    { titre: 'Comment entrer', texte: d.entryDirectives ?? '' },
    { titre: 'Contact sur place', texte: contact },
    { titre: 'Poubelles', texte: d.poubelles ?? '' },
    { titre: 'Stationnement', texte: d.parking ?? '' },
    { titre: 'Équipements', texte: d.equipements ?? '' },
  ] as Rubrique[]).filter(r => r.texte.trim() !== '');
}

/**
 * Ce qui manque pour que la fiche voyageur soit utile.
 *
 * On le dit à l'exploitant AVANT qu'il imprime, pas après : une fiche sans wifi
 * ni horaires ne répond à aucune des questions qu'on lui pose.
 */
export function manquesFiche(d: DonneesFiche): string[] {
  const manques: string[] = [];
  if (!(d.wifiSsid ?? '').trim()) manques.push('le réseau wifi');
  if (!(d.checkoutTime ?? '').trim()) manques.push('l’heure de départ');
  if (!(d.consignesDepart ?? '').trim()) manques.push('les consignes de départ');
  if (!(d.onSiteContactPhone ?? '').trim()) manques.push('un numéro à joindre');
  return manques;
}

// ── Aider à la remplir ───────────────────────────────────────────────────────
//
//  Une page de champs vides ne dit pas ce qu'on attend. « Poubelles » peut
//  vouloir dire l'étage du local, le jour de collecte, ou la couleur du bac —
//  et une conciergerie qui hésite laisse le champ vide, donc reçoit l'appel.
//
//  D'où un exemple par champ, rédigé comme une vraie réponse : elle le lit, le
//  modifie, et sa fiche est juste. Les exemples sont volontairement lyonnais
//  (bacs du Grand Lyon, zone résidentielle, métro) parce que c'est là que sont
//  les logements qu'on gère.

/** Les champs qu'une conciergerie écrit elle-même, et ce qu'on y attend. */
export type ChampFiche =
  | 'checkinTime' | 'checkoutTime'
  | 'consignesDepart' | 'poubelles' | 'parking' | 'equipements' | 'aProximite';

export const EXEMPLES_FICHE: Record<ChampFiche, string> = {
  checkinTime: 'à partir de 16h',
  checkoutTime: 'avant 11h',
  consignesDepart:
    'Merci de laisser les clés sur la table de la cuisine, de fermer les fenêtres '
    + 'et de lancer le lave-vaisselle s’il est plein. Pas besoin de faire le lit.',
  poubelles:
    'Local poubelles au fond de la cour, à droite. Bac gris pour le tout-venant, '
    + 'bac jaune pour le carton et le plastique. Collecte le mardi et le vendredi matin.',
  parking:
    'Stationnement en zone résidentielle dans la rue, gratuit le dimanche et après 19h. '
    + 'Parking payant le plus proche à 3 minutes à pied.',
  equipements:
    'Lave-linge dans la salle de bain, lessive sous l’évier. Chauffage réglable sur le '
    + 'boîtier du couloir. Télévision avec Netflix, sèche-cheveux dans le tiroir du meuble.',
  aProximite:
    'Boulangerie et supermarché à 2 minutes. Métro à 5 minutes à pied. '
    + 'Pharmacie au bout de la rue, restaurants sur la place.',
};

/**
 * Ce qui se recopie d'un logement à l'autre.
 *
 * Une conciergerie qui gère quatorze appartements dans la même ville répond
 * quatorze fois la même chose aux horaires, au départ, aux équipements. Le wifi,
 * lui, NE SE RECOPIE JAMAIS : chaque logement a sa box, et un QR qui mène au
 * réseau du voisin est un faux renseignement imprimé sur du papier.
 */
export function reprendreFiche(source: DonneesFiche): Partial<DonneesFiche> {
  return {
    checkinTime: source.checkinTime ?? '',
    checkoutTime: source.checkoutTime ?? '',
    consignesDepart: source.consignesDepart ?? '',
    poubelles: source.poubelles ?? '',
    parking: source.parking ?? '',
    equipements: source.equipements ?? '',
    aProximite: source.aProximite ?? '',
  };
}

/** Une fiche a-t-elle de quoi servir de modèle ? */
export function ficheRemplie(d: DonneesFiche): boolean {
  return [d.checkinTime, d.checkoutTime, d.consignesDepart, d.poubelles, d.parking,
    d.equipements, d.aProximite].some(v => (v ?? '').trim() !== '');
}
