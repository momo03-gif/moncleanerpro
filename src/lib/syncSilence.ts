// ── Connexions « muettes » : synchronisées sans erreur, mais plus alimentées ──
//
// Ce qui est arrivé avec SuperHote (octobre 2026) : le compte de la conciergerie
// est passé à leur nouvelle version, l'ancienne a continué de répondre sans
// erreur… avec des données figées. Chaque synchro affichait « OK », et plus
// aucune réservation n'arrivait — donc plus aucun ménage n'était créé.
//
// Une erreur se voit ; un silence non. On le détecte par conciergerie et par
// logiciel (pas par logement : un logement peut rester une semaine sans
// réservation, toute une conciergerie non).
//
// UNE RÈGLE QUI S'ADAPTE AU RYTHME DE CHACUN
// Un seuil fixe (« 4 jours sans rien ») crierait au loup chez une petite
// conciergerie qui reçoit une réservation par semaine, et réagirait trop tard
// chez une grosse qui en reçoit tous les jours. On mesure donc, pour chaque
// connexion, la part de jours où de nouvelles réservations arrivent (son
// rythme), puis on ne parle que si le silence actuel est INVRAISEMBLABLE pour
// ce rythme : moins de 2 % de chances qu'il soit dû au hasard.
//   · presque tous les jours → alerte au bout de 3 jours ;
//   · une fois par semaine   → il faudrait un mois de silence, et encore.
// Garde-fous : au moins JOURS_ACTIFS_MIN jours d'activité observés pour juger,
// et le jour du premier import (toujours chargé) ne compte jamais.
//
// Logique pure, sans base : testée dans syncSilence.test.ts.

/** Recul maximal pour mesurer le rythme (jours). */
export const RECUL_JOURS = 35;
/** Preuves minimales : jours distincts avec de nouvelles réservations. */
export const JOURS_ACTIFS_MIN = 4;
/** Probabilité sous laquelle un silence est jugé anormal. */
export const SEUIL_HASARD = 0.02;
/** Silence minimal avant toute alerte, même pour une connexion très active. */
export const SILENCE_MIN_JOURS = 2;

export interface FluxSilence {
  partnerId: string | null;
  platform: string;
  /** Création du flux (ISO) : le jour du premier import ne compte pas. */
  createdAt: string;
}

/**
 * Une NOUVELLE réservation reçue. Ne passer que des séjours CONFIRMÉS : les
 * calendriers publient aussi des dates bloquées (Airbnb en crée une chaque jour
 * pour le jour même), qui donneraient un faux rythme quotidien — et une fausse
 * alerte au premier jour sans.
 */
export interface ReservationSilence {
  feedPartnerId: string | null;
  feedPlatform: string;
  /** Création de la réservation chez nous (ISO). */
  createdAt: string;
}

export interface ConnexionMuette {
  partnerId: string | null;
  platform: string;
  flux: number;
  /** Part des jours où de nouvelles réservations arrivaient (0 à 1). */
  rythme: number;
  /** Jours écoulés depuis la dernière nouvelle réservation. */
  joursSilence: number;
  /** Dernière nouvelle réservation reçue (AAAA-MM-JJ). */
  derniereNouvelle: string;
  /** Silence à partir duquel ce rythme rend l'alerte légitime (jours). */
  silenceAttendu: number;
}

const jour = (iso: string) => iso.slice(0, 10);
const cle = (partnerId: string | null, platform: string) => `${partnerId ?? '-'}|${platform}`;
const ecart = (a: string, b: string) =>
  Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
function decaler(date: string, jours: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + jours);
  return d.toISOString().slice(0, 10);
}

/** Jours de silence au-delà desquels un rythme `p` rend le silence invraisemblable. */
export function silenceAnormalDes(p: number): number {
  if (p <= 0) return Infinity;
  if (p >= 1) return SILENCE_MIN_JOURS;
  return Math.max(SILENCE_MIN_JOURS, Math.ceil(Math.log(SEUIL_HASARD) / Math.log(1 - p)));
}

/**
 * Connexions actives devenues muettes, à la date `aujourdhui` (AAAA-MM-JJ).
 * `flux` = flux ACTIFS ; `reservations` = créations des RECUL_JOURS derniers
 * jours au moins.
 */
export function connexionsMuettes(
  flux: FluxSilence[], reservations: ReservationSilence[], aujourdhui: string,
): ConnexionMuette[] {
  const groupes = new Map<string, { partnerId: string | null; platform: string; flux: number; joursImport: Set<string>; premier: string }>();
  for (const f of flux) {
    const k = cle(f.partnerId, f.platform);
    const j = jour(f.createdAt);
    const g = groupes.get(k) ?? { partnerId: f.partnerId, platform: f.platform, flux: 0, joursImport: new Set<string>(), premier: j };
    g.flux++;
    g.joursImport.add(j);
    if (j < g.premier) g.premier = j;
    groupes.set(k, g);
  }

  const joursParGroupe = new Map<string, Set<string>>();
  for (const r of reservations) {
    const k = cle(r.feedPartnerId, r.feedPlatform);
    const g = groupes.get(k);
    if (!g) continue;
    const j = jour(r.createdAt);
    if (j > aujourdhui || g.joursImport.has(j)) continue;   // l'import n'est pas un rythme
    const s = joursParGroupe.get(k) ?? new Set<string>();
    s.add(j);
    joursParGroupe.set(k, s);
  }

  const out: ConnexionMuette[] = [];
  for (const [k, g] of groupes) {
    const debut = [decaler(aujourdhui, -RECUL_JOURS), decaler(g.premier, 1)].sort().pop()!;
    const actifs = Array.from(joursParGroupe.get(k) ?? []).filter(j => j >= debut).sort();
    if (actifs.length < JOURS_ACTIFS_MIN) continue;

    // Rythme mesuré AVANT le silence : de l'ouverture de la fenêtre au dernier
    // jour actif inclus. Compter le silence dedans diluerait le rythme et
    // retarderait l'alerte d'autant.
    const derniere = actifs[actifs.length - 1];
    const joursObserves = ecart(debut, derniere) + 1;
    const p = actifs.length / joursObserves;
    const silence = ecart(derniere, aujourdhui);
    const seuil = silenceAnormalDes(p);
    if (silence < seuil) continue;

    out.push({
      partnerId: g.partnerId, platform: g.platform, flux: g.flux,
      rythme: Math.round(p * 100) / 100, joursSilence: silence,
      derniereNouvelle: derniere, silenceAttendu: seuil,
    });
  }
  return out;
}
