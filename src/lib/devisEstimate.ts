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
]);

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
function isMainCategory(cat?: string): boolean {
  const c = normalizeText(cat ?? '');
  return /(residentiel|airbnb|conciergerie|fin de chantier|remise en etat|etat des lieux|professionnel)/.test(c);
}

// Déduit le TYPE DE BIEN (studio / t1…t5 / maison) tel qu'un humain le décrit.
// Règle métier FR : le « T » = nombre de pièces PRINCIPALES = chambres + salon/
// séjour. Cuisine, salle de bain, WC/toilettes, entrée, couloir NE COMPTENT PAS.
//   « 3 chambres, un salon, cuisine et toilettes » → 3 + 1 = T4.
// Renvoie un token synthétique (« t4 ») injecté ensuite dans la recherche, ou ''.
function inferBienType(text: string): string {
  // Type explicite : t4, f4, « type 4 »… ou studio.
  const explicit = text.match(/\b[tf] ?([1-5])\b/) || text.match(/\btype ([1-5])\b/);
  if (explicit) return 't' + explicit[1];
  if (/\bstudio\b/.test(text)) return 't1';

  // Comptage des chambres (« 3 chambres », « trois chambres »).
  const WORD_NUM: Record<string, number> = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6 };
  let chambres = 0;
  const mNum = text.match(/(\d+)\s+chambre/);
  if (mNum) chambres = parseInt(mNum[1], 10);
  else {
    const mWord = text.match(/\b(un|une|deux|trois|quatre|cinq|six)\s+chambre/);
    if (mWord) chambres = WORD_NUM[mWord[1]] ?? 0;
    else if (/\bchambre/.test(text)) chambres = 1;
  }
  if (chambres <= 0) return '';
  // Salon / séjour / salle à manger = 1 pièce principale de vie (par défaut 1).
  const salon = /(salon|sejour|salle a manger|piece a vivre|living)/.test(text) ? 1 : 1;
  const pieces = Math.min(5, chambres + salon);
  return 't' + pieces;
}

// Mots de PIÈCES : servent à déduire le type de bien, PAS à matcher une option.
// « salon », « cuisine », « toilettes » dans « T4 avec cuisine et toilettes »
// décrivent le logement — ils ne doivent pas créer de lignes Canapé/Cuisine/etc.
const ROOM = new Set([
  'chambre', 'salon', 'sejour', 'cuisine', 'toilette', 'wc', 'sdb', 'entree',
  'couloir', 'buanderie', 'dressing', 'piece', 'living', 'manger', 'vestibule', 'degagement',
]);

// Surface (m²) : explicite (« 200 m2 ») sinon estimée d'après le type déduit.
// Sert à donner un TOTAL crédible aux prestations au m² (au lieu du prix/m²).
const SURFACE_PAR_TYPE: Record<string, number> = { t1: 30, t2: 45, t3: 65, t4: 85, t5: 110 };
function inferSurface(text: string, inferredType: string): number | null {
  const m = text.match(/(\d{2,4})\s*m\s*(?:2|carre)?\b/);
  if (m) { const s = parseInt(m[1], 10); if (s >= 8 && s <= 5000) return s; }
  if (inferredType && SURFACE_PAR_TYPE[inferredType]) return SURFACE_PAR_TYPE[inferredType];
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

  const text = spaced(description);
  // Déduction du type de bien AVANT de retirer les mots de pièces (elle s'appuie
  // sur « chambre »/« salon »). « 3 chambres + salon » → t4.
  const inferred = inferBienType(text);
  const surface = inferSurface(text, inferred);

  // Tokens du texte, SANS les mots de pièces (structurels, pas des prestations).
  const textTokens = tokensOf(description).filter(w => !ROOM.has(w));
  if (inferred && !textTokens.includes(inferred)) textTokens.push(inferred);
  const isMaison = /\b(maison|villa|pavillon)\b/.test(text);
  if (isMaison && !textTokens.includes('maison')) textTokens.push('maison');
  if (textTokens.length === 0) return [];

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
    if (score > 0) scored.push({ t: it.t, score, anchor, main: isMainCategory(it.t.categorie) });
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
  const mains = scored.filter(s => s.main && s.score >= best * 0.4).sort((a, b) => b.score - a.score);
  // Options : au-dessus du seuil, et UNE SEULE par catégorie (évite « Fenêtre +
  // Porte-fenêtre + Baie vitrée + Velux » pour un simple « vitres »).
  const addonsSorted = scored.filter(s => !s.main && s.score >= addonFloor).sort((a, b) => b.score - a.score);
  const seenCat = new Set<string>();
  const addons: typeof addonsSorted = [];
  for (const s of addonsSorted) {
    const cat = normalizeText(s.t.categorie ?? s.t.nom);
    if (seenCat.has(cat)) continue;
    seenCat.add(cat);
    addons.push(s);
  }
  const selection = [...(mains.length ? [mains[0]] : []), ...addons.slice(0, 4)];
  if (selection.length === 0) return [];

  return selection.map(({ t, anchor, main }) => {
    // Quantité : nombre ISOLÉ (entouré d'espaces) près du mot repéré → « 6
    // fenêtres » = 6, mais le « 2 » de « T2 » n'est PAS une quantité.
    let numQty: number | null = null;
    const idx = anchor ? text.indexOf(anchor.slice(0, 4)) : -1;
    if (idx >= 0) {
      const win = text.slice(Math.max(0, idx - 18), Math.min(text.length, idx + anchor.length + 18));
      const m = win.match(/(?:^|\s)(\d{1,3})(?:\s|$)/);
      if (m) { const n = parseInt(m[1], 10); if (n > 0 && n < 500) numQty = n; }
    }
    // Prestation au m² : la quantité est la SURFACE. Pour la prestation principale
    // on prend la surface (explicite ou estimée d'après le type) → total crédible.
    let qty = 1;
    if (t.unite === 'm2') qty = (main && surface ? surface : numQty) ?? 1;
    else qty = numQty ?? 1;
    return { nom: t.nom, quantite: qty, prix_unitaire: t.prix, total: Math.round(qty * t.prix * 100) / 100 };
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
