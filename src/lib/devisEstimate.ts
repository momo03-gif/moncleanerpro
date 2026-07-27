import type { Tarif, DevisLine } from './devis';

// ════════════════════════════════════════════════════════════════════════════
//  Agent d'estimation « maison » — 100 % LOCAL (aucune clé, aucune API, pas de
//  Claude). Comprend une description en langage humain et propose les prestations
//  PERTINENTES de la grille (prix fixés par l'entreprise).
//
//  Principe : SCORE DE PERTINENCE plutôt qu'un simple « match / pas match ».
//   • Pondération TF-IDF : un mot-clé présent dans BEAUCOUP de prestations (ex.
//     « maison », « nettoyage », le nom de la catégorie) pèse ~0 ; un mot rare et
//     discriminant (« velux », « diogène », « four ») pèse fort. → supprime le bruit.
//   • Bonus « expression » : une suite de mots (« fin de chantier », « état des
//     lieux ») trouvée telle quelle = signal fort.
//   • Tolérance humaine : singulier/pluriel + préfixe (« vitres » ↔ « vitrerie »).
//   • Seuil + plafond : on ne garde que les lignes proches du meilleur score
//     (top 6). → quelques prestations justes, pas une grosse palette.
//  Module PUR (import type only) → testable et sans dépendance runtime.
// ════════════════════════════════════════════════════════════════════════════

// Mots-outils français ignorés (bruit sans valeur discriminante).
const STOP = new Set([
  'de', 'des', 'du', 'la', 'le', 'les', 'un', 'une', 'et', 'ou', 'au', 'aux', 'en',
  'sur', 'sous', 'par', 'pour', 'avec', 'sans', 'dans', 'a', 'à', 'the', 'mon', 'ma',
  'mes', 'ce', 'cet', 'cette', 'ses', 'son', 'sa', 'nos', 'vos', 'que', 'qui', 'est',
  'il', 'elle', 'je', 'tu', 'nous', 'vous', 'plus', 'tres', 'bien', 'faire', 'svp',
  // Mots trop génériques dans le métier : ne discriminent pas seuls (les
  // EXPRESSIONS « apres travaux », « laver les vitres » restent gérées à part).
  'apres', 'avant', 'laver', 'nettoyer', 'nettoyage', 'faut', 'voudrais', 'besoin',
  'complet', 'complete', 'general', 'generale', 'simple', 'grand', 'petit', 'appartement', 'logement',
  'lave', 'place', 'info', 'pour', 'chaque', 'sur', 'aussi', 'egalement', 'communs',
  'tous', 'toutes', 'jour', 'jours', 'semaine', 'semaines', 'mois', 'fois', 'fin', 'quitte', 'rendre',
]);
// Mots signalant un logement de particulier (≠ local professionnel).
function isResidentialContext(text: string, inferredType: string): boolean {
  return !!inferredType || /\b(maison|villa|pavillon|appartement|studio|duplex|logement|chambre|airbnb|locataire|bail)\b/.test(text);
}
function isProfessional(t: Tarif): boolean {
  return /professionnel/.test(normalizeText(t.categorie ?? ''));
}

function normalizeText(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
// « spaced » : minuscules, sans accents, non-alphanumériques → espaces, bordé
// d'espaces pour tester des expressions entières (' fin de chantier ').
function spaced(s: string): string {
  return ' ' + normalizeText(s).replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
}
// Racine simple : retire un pluriel final (s/x). Suffit pour le français courant.
function stem(w: string): string {
  return w.length > 4 && /[sx]$/.test(w) ? w.slice(0, -1) : w;
}
function tokensOf(s: string): string[] {
  return spaced(s).trim().split(' ').filter(w => w.length >= 2 && !STOP.has(w)).map(stem);
}
// Nombres en toutes lettres → chiffres (« six fenêtres » → « 6 fenetres »), pour
// que la détection de quantité et de pièces marche à l'écrit comme à l'oral.
// « un/une » exclus (articles) → jamais pris pour une quantité.
const NUM_WORDS: Record<string, string> = {
  deux: '2', trois: '3', quatre: '4', cinq: '5', six: '6', sept: '7',
  huit: '8', neuf: '9', dix: '10', onze: '11', douze: '12',
};
function numberWords(s: string): string {
  return s.replace(/\b(deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze)\b/g, m => NUM_WORDS[m]);
}
// Deux racines « correspondent » si égales, ou si l'une est préfixe de l'autre
// avec AU MOINS 6 lettres de part et d'autre → « menage » ↔ « menager »,
// « vitrage » ↔ « vitrages ». Seuil à 6 pour éviter les collisions courtes
// (« entre » ≠ « entrepot », « etat » ≠ « etatique »).
function tokenMatch(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length >= 6 && b.length >= 6 && (a.startsWith(b) || b.startsWith(a))) return true;
  return false;
}

// Catégories « prestation principale » (= un travail sur le logement/local entier).
// On n'en propose qu'UNE (la plus pertinente) : sinon on empile Entretien +
// Airbnb + État des lieux + Fin de chantier pour un seul bien → grosse palette.
// Les autres catégories (Vitrerie, Sols, Textile, Extérieurs, Spécifiques…) sont
// des OPTIONS qui peuvent s'additionner.
function isMainPrestation(t: Tarif): boolean {
  const nom = normalizeText(t.nom);
  // Extras facturés en plus, jamais « la » prestation principale du logement.
  if (/(linge|consommable|\bkit\b|option)/.test(nom)) return false;
  const c = normalizeText(t.categorie ?? '');
  return /(residentiel|airbnb|conciergerie|coliving|colocation|fin de chantier|remise en etat|etat des lieux|professionnel)/.test(c);
}

// Déduit le TYPE DE BIEN (studio / t1…t5 / maison) tel qu'un humain le décrit.
// Règle métier FR : le « T » = nombre de pièces PRINCIPALES = chambres + salon/
// séjour. Cuisine, salle de bain, WC/toilettes, entrée, couloir NE COMPTENT PAS.
//   « 3 chambres, un salon, cuisine et toilettes » → 3 + 1 = T4.
// Renvoie un token synthétique (« t4 ») injecté ensuite dans la recherche, ou ''.
// NB : `text` est déjà normalisé ET les nombres en lettres convertis en chiffres.
function inferBienType(text: string): string {
  // 1) Type explicite : t4, f4, « type 4 ».
  const explicit = text.match(/\b[tf] ?([1-6])\b/) || text.match(/\btype ([1-6])\b/);
  if (explicit) return 't' + Math.min(5, parseInt(explicit[1], 10));
  // 2) Studio / loft (une pièce de vie).
  if (/\b(studio|loft)\b/.test(text)) return 't1';
  // 3) « X pièces » = TX directement (le T compte les pièces principales).
  const mPieces = text.match(/(\d+)\s*(?:piece|pieces|p)\b/);
  if (mPieces) { const p = parseInt(mPieces[1], 10); if (p >= 1 && p <= 6) return 't' + Math.min(5, p); }
  // 4) Duplex sans autre précision ≈ T3.
  if (/\bduplex\b/.test(text) && !/chambre/.test(text)) return 't3';

  // 5) Comptage des chambres → pièces principales = chambres + salon/séjour.
  let chambres = 0;
  const mNum = text.match(/(\d+)\s+chambre/);
  if (mNum) chambres = parseInt(mNum[1], 10);
  else if (/\bune?\s+chambre/.test(text) || /\bchambre/.test(text)) chambres = 1;
  if (chambres <= 0) return '';
  const salon = /(salon|sejour|salle a manger|piece a vivre|living)/.test(text) ? 1 : 1;
  return 't' + Math.min(5, chambres + salon);
}

// Mots de PIÈCES : servent à déduire le type de bien, PAS à matcher une option.
// « salon », « cuisine », « toilettes » dans « T4 avec cuisine et toilettes »
// décrivent le logement — ils ne doivent pas créer de lignes Canapé/Cuisine/etc.
const ROOM = new Set([
  'chambre', 'salon', 'sejour', 'cuisine', 'toilette', 'wc', 'sdb', 'entree',
  'couloir', 'buanderie', 'dressing', 'piece', 'living', 'manger', 'vestibule', 'degagement',
  'douche', 'baignoire', 'lavabo', 'evier', 'salle', 'bain', 'escalier', 'palier',
]);

// Surface (m²) : explicite (« 200 m2 ») sinon estimée d'après le type déduit.
// Sert à donner un TOTAL crédible aux prestations au m² (au lieu du prix/m²).
const SURFACE_PAR_TYPE: Record<string, number> = { t1: 30, t2: 45, t3: 65, t4: 85, t5: 110 };
function inferSurface(text: string, inferredType: string): number | null {
  // « 488.40 m2 » → 488 (on ignore la décimale), « 80m² », « 120 m carre ».
  const m = text.match(/(\d{2,4})(?:[.,]\d+)?\s*m(?:2|\b|\s*carre)/);
  if (m) { const s = parseInt(m[1], 10); if (s >= 8 && s <= 5000) return s; }
  if (inferredType && SURFACE_PAR_TYPE[inferredType]) return SURFACE_PAR_TYPE[inferredType];
  if (/\b(maison|villa|pavillon)\b/.test(text)) return 90; // surface par défaut d'une maison
  if (/\b(appartement|logement|local)\b/.test(text)) return 55; // logement sans type précisé
  return null;
}

interface Indexed { t: Tarif; tokens: string[]; phrases: string[]; }

function indexTarif(t: Tarif): Indexed {
  const tokens = new Set<string>();
  for (const w of tokensOf(t.nom)) tokens.add(w);
  const phrases: string[] = [];
  const nameN = spaced(t.nom).trim();
  if (nameN.includes(' ')) phrases.push(nameN);
  for (const entry of (t.motsCles ?? '').split(',')) {
    const e = spaced(entry).trim();
    if (!e) continue;
    if (e.includes(' ')) phrases.push(e);
    for (const w of tokensOf(entry)) tokens.add(w);
  }
  return { t, tokens: [...tokens], phrases };
}

export function estimateFromDescription(description: string, tarifs: Tarif[]): DevisLine[] {
  const index = tarifs.map(indexTarif);
  const N = index.length || 1;

  // Fréquence documentaire de chaque racine (dans combien de prestations elle apparaît).
  const df = new Map<string, number>();
  for (const it of index) for (const tk of it.tokens) df.set(tk, (df.get(tk) ?? 0) + 1);
  const idf = (tk: string) => Math.max(0, Math.log((N + 1) / ((df.get(tk) ?? 0) + 0.5)));

  // Texte normalisé + nombres en lettres → chiffres (« six »→« 6 »).
  const text = numberWords(spaced(description));
  // Déduction du type de bien AVANT de retirer les mots de pièces (elle s'appuie
  // sur « chambre »/« salon »). « 3 chambres + salon » → t4.
  const inferred = inferBienType(text);
  const surface = inferSurface(text, inferred);

  // Tokens du texte, SANS les mots de pièces (structurels, pas des prestations).
  // Quand on retire un mot de pièce, on retire AUSSI le nombre qui le précède
  // (« 4 chambres » : le 4 compte les chambres, pas une prestation qui suivrait).
  const rawTokens = text.trim().split(' ')
    .filter(w => (w.length >= 2 || /^\d$/.test(w)) && !STOP.has(w))   // garde les chiffres isolés (« 8 »)
    .map(stem);
  const textTokens: string[] = [];
  for (const w of rawTokens) {
    if (ROOM.has(w)) {
      if (textTokens.length && /^\d{1,3}$/.test(textTokens[textTokens.length - 1])) textTokens.pop();
      continue;
    }
    textTokens.push(w);
  }
  if (inferred && !textTokens.includes(inferred)) textTokens.push(inferred);
  const isMaison = /\b(maison|villa|pavillon)\b/.test(text);
  if (isMaison && !textTokens.includes('maison')) textTokens.push('maison');
  if (textTokens.length === 0) return [];

  // Négations : le mot qui suit « pas / sans / aucun … » est interdit. Détecté sur
  // le TEXTE BRUT (car « sans » est un mot vide, retiré des tokens plus haut).
  const negated = new Set<string>();
  const negRe = /\b(?:pas|sans|aucun|aucune|ni|sauf|non|sauf)\b(?:\s+(?:d|de|du|des|le|la|les|l))*\s+([a-z0-9]+)/g;
  let nm: RegExpExecArray | null;
  while ((nm = negRe.exec(text)) !== null) negated.add(stem(nm[1]));
  // Contexte : un logement de particulier n'est pas un local professionnel.
  const residential = isResidentialContext(text, inferred);
  // Contexte COURTE DURÉE / conciergerie → le ménage « entre voyageurs »
  // (Nettoyage Hébergement) prime sur état des lieux / remise en état.
  const conciergerie = /(airbnb|booking|abritel|voyageur|saisonnier|saisonniere|turnover|locative|conciergerie|\bgite\b|meuble touristique|courte duree|entre deux|entre chaque|check ?in|check ?out|checkout|checkin)/.test(text);
  // Contexte COLIVING / COLOCATION → forfait dédié « X chambres + communs ».
  const coliving = /(coliving|colocation|\bcoloc\b|chambre.{0,8}loue|chambres.{0,12}loue|chambres.{0,12}sont.{0,6}loue|maison partagee|chambre meublee|plusieurs chambres.{0,12}loue)/.test(text);
  // Cible coliving selon le nombre de chambres décrit (studio, 1, 2, 3 et +).
  let colivingTarget = '';
  if (coliving) {
    if (/\bstudio\b/.test(text)) colivingTarget = 'studio';
    else {
      const mc = text.match(/(\d+)\s+chambre/);
      const cc = mc ? parseInt(mc[1], 10) : (/\bchambre/.test(text) ? 1 : 0);
      colivingTarget = cc >= 3 ? '3 chambre' : cc === 2 ? '2 chambre' : '1 chambre';
    }
  }

  type Scored = { t: Tarif; score: number; anchor: string; main: boolean };
  const scored: Scored[] = [];
  for (const it of index) {
    let score = 0, anchor = '', anchorW = -1;
    // Score par racines discriminantes communes (pondérées par leur rareté).
    for (const tk of it.tokens) {
      if (!textTokens.some(x => tokenMatch(x, tk))) continue;
      const w = idf(tk);
      score += w;
      if (w > anchorW) { anchorW = w; anchor = tk; }
    }
    // Bonus « expression » : mot-clé multi-mots retrouvé tel quel dans le texte.
    for (const ph of it.phrases) {
      if (text.includes(' ' + ph + ' ')) { const words = ph.split(' ').length; score += 1 + 0.8 * (words - 1); if (anchorW < 2) anchor = ph.split(' ')[0]; }
    }
    // Coup de pouce décisif au ménage « hébergement » en contexte courte durée.
    if (conciergerie && /hebergement/.test(normalizeText(it.t.nom))) { score += 3; if (!anchor) anchor = 'hebergement'; }
    // Type déduit (« maison 3 chambres » = T4) → on privilégie le forfait ENTRETIEN
    // de ce type (qui a un prix) plutôt qu'une ligne générique « Maison » sur devis.
    // Les services explicites (état des lieux, fin de chantier, airbnb) gardent la
    // main via leurs propres mots-clés/expressions.
    if (inferred && /entretien classique/.test(normalizeText(it.t.nom)) && it.tokens.includes(inferred)) { score += 2; if (!anchor) anchor = inferred; }
    // Contexte coliving → on force le forfait coliving correspondant au nb de chambres.
    if (coliving && /coliving/.test(normalizeText(it.t.nom))) {
      const nom = normalizeText(it.t.nom);
      const isTarget = colivingTarget === 'studio' ? /studio/.test(nom) : nom.includes(colivingTarget);
      if (isTarget) { score += 6; anchor = 'coliving'; }
    }
    if (score > 0) scored.push({ t: it.t, score, anchor, main: isMainPrestation(it.t) });
  }
  if (scored.length === 0) return [];

  // Sélection : UNE seule prestation « principale » (la mieux notée, logement/
  // local entier) + les OPTIONS pertinentes. Le seuil des options est ABSOLU
  // (pas relatif au meilleur score) pour qu'elles ne disparaissent pas quand la
  // principale a un très gros score (ex. « fin de bail T3 avec vitres et four »).
  const best = Math.max(...scored.map(s => s.score));
  // Seuil d'option relatif à l'échelle IDF de la grille (robuste quel que soit le
  // nombre de prestations) : ~40 % du poids d'un mot-clé unique.
  const unitIdf = Math.log((N + 1) / 1.5);
  const addonFloor = 0.4 * unitIdf;
  // Prestation principale : la mieux notée ; en contexte résidentiel on écarte les
  // prestations « pro » (bureaux, copropriété, hôtel…) et tout ce qui est nié.
  const mains = scored
    .filter(s => s.main && s.score >= best * 0.4 && !negated.has(s.anchor) && !(residential && isProfessional(s.t)))
    .sort((a, b) => b.score - a.score);
  // Options : au-dessus du seuil, non niées, dédupliquées par MOT REPÉRÉ (anchor).
  // Ainsi un simple « vitres » → 1 ligne vitrerie, mais « canapé et matelas » ou
  // « fenêtre et baie vitrée » (mots repérés différents) → 2 lignes distinctes.
  const addonsSorted = scored
    .filter(s => !s.main && s.score >= addonFloor && !negated.has(s.anchor) && !(residential && isProfessional(s.t)))
    .sort((a, b) => b.score - a.score);
  const seenAnchor = new Set<string>();
  const addons: typeof addonsSorted = [];
  for (const s of addonsSorted) {
    if (seenAnchor.has(s.anchor)) continue;
    seenAnchor.add(s.anchor);
    addons.push(s);
  }
  const selection = [...(mains.length ? [mains[0]] : []), ...addons.slice(0, 4)];
  if (selection.length === 0) return [];

  // Quantité par option : un nombre ADJACENT au mot repéré (« 6 fenêtres » = 6).
  // On n'attrape PAS un nombre lointain (« 300 m² avec sanitaires » ne fait pas
  // 300 sanitaires). La prestation principale n'est jamais multipliée.
  // En français le nombre PRÉCÈDE le nom qu'il compte (« 4 fauteuils »). On ne
  // prend donc que le nombre juste AVANT le mot repéré → « canapé et 4 fauteuils »
  // ne fait pas 4 canapés.
  function adjacentQty(anchor: string): number | null {
    for (let i = 0; i < textTokens.length; i++) {
      if (!tokenMatch(textTokens[i], anchor)) continue;
      const prev = textTokens[i - 1];
      if (prev && /^\d{1,3}$/.test(prev)) return parseInt(prev, 10);
      break;
    }
    return null;
  }

  return selection.map(({ t, anchor, main }) => {
    let qty = 1;
    if (t.unite === 'm2') {
      // Au m² : quantité = SURFACE. Principale → surface du bien ; sinon 1.
      qty = (main && surface ? surface : (adjacentQty(anchor) ?? 1));
    } else if (!main) {
      qty = adjacentQty(anchor) ?? 1;   // options : « 6 fenêtres » = 6
    } // prestation principale au forfait → toujours ×1
    const n = Math.max(1, Math.min(999, qty));
    return { nom: t.nom, quantite: n, prix_unitaire: t.prix, total: Math.round(n * t.prix * 100) / 100 };
  });
}

// Fourchette d'une sélection de lignes : borne basse = Σ qté × prix_min (ou prix
// de référence si pas de fourchette), borne haute = Σ qté × prix_max.
export function rangeForLines(lines: DevisLine[], tarifs: Tarif[]): { low: number; high: number } {
  const byName = new Map(tarifs.map(t => [t.nom, t]));
  let low = 0, high = 0;
  for (const l of lines) {
    const t = byName.get(l.nom);
    const min = (t?.prixMin ?? null) != null ? t!.prixMin! : l.prix_unitaire;
    const max = (t?.prixMax ?? null) != null ? t!.prixMax! : l.prix_unitaire;
    low += l.quantite * min;
    high += l.quantite * max;
  }
  return { low: Math.round(low * 100) / 100, high: Math.round(high * 100) / 100 };
}

// Fourchette d'un seul tarif (pour l'affichage « 40 – 70 € » sur un bouton).
export function tarifRange(t: Tarif): { low: number; high: number } {
  const low = t.prixMin != null ? t.prixMin : t.prix;
  const high = t.prixMax != null ? t.prixMax : t.prix;
  return { low, high };
}
