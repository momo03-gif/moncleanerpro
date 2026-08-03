import type { Tarif } from './devis';

// ════════════════════════════════════════════════════════════════════════════
//  Catalogue de prestations pour les sélecteurs de devis — module PUR, partagé
//  entre la page publique (/devis-en-ligne) et l'espace partenaire (/airbnb/devis).
//  Il classe CHAQUE prestation de la grille Supabase en macro-catégorie → section
//  d'après son NOM (et non la colonne `categorie`) : le classement reste correct
//  même si la grille est ré-importée sans catégories.
//  Les PRIX ne sont jamais rendus ici : chaque page décide où (et si) elle les
//  affiche — la règle métier est de ne les dévoiler qu'à l'écran d'estimation.
// ════════════════════════════════════════════════════════════════════════════

export type Mode = 'forfait' | 'm2' | 'unit' | 'quote';
export interface Item { tarif: Tarif; name: string; detail: string | null; unitLabel: string | null; mode: Mode; min: number | null; max: number | null; }
export interface Section { title: string; single: boolean; items: Item[]; }
export interface Macro { id: string; title: string; tagline: string; sections: Section[] }

// ── 5 macro-catégories (ordre + libellés) ──────────────────────────────────────
export const MACRO_DEF: { id: string; title: string; tagline: string }[] = [
  { id: 'residentiel', title: 'Résidentiel & Airbnb', tagline: 'Ménage régulier, grand nettoyage, locations courte durée, colocation' },
  { id: 'pro', title: 'Locaux professionnels', tagline: 'Bureaux, commerces, santé, éducation et copropriétés' },
  { id: 'remise', title: 'Remise en état & Chantier', tagline: 'Fin de chantier, sinistres, états des lieux' },
  { id: 'vst', title: 'Vitres · Sols · Textiles', tagline: 'Vitrerie, traitement des sols et textiles d’ameublement' },
  { id: 'ext', title: 'Extérieurs & Spécifiques', tagline: 'Extérieurs, situations particulières et prestations à la carte' },
];
// Ordre des sections dans chaque macro-catégorie.
export const SECTION_ORDER: Record<string, string[]> = {
  residentiel: ['Entretien classique du logement', 'Nettoyage ponctuel', 'Airbnb & Conciergerie', 'Coliving / Colocation'],
  pro: ['Bureaux, commerces & industrie', 'Santé, petite enfance & éducation', 'Autres établissements'],
  remise: ['Fin de chantier', 'États des lieux', 'Remise en état & sinistres'],
  vst: ['Vitrerie', 'Sols', 'Textile'],
  ext: ['Extérieurs & façades', 'Cuisine, sanitaires & désinfection', 'Situations spécifiques', 'Espaces communs & techniques', 'Traitement de l’air & odeurs', 'Finitions & détails'],
};
const SINGLE_SECTIONS = new Set(['Entretien classique du logement', 'Coliving / Colocation']);

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Classe une prestation dans une macro-catégorie + section d'après son NOM.
export function classify(t: Tarif): { macro: string; section: string } {
  const n = norm(t.nom);
  // Résidentiel & Airbnb
  if (/entretien classique/.test(n)) return { macro: 'residentiel', section: 'Entretien classique du logement' };
  if (/ponctuel|grand menage|grand nettoyage/.test(n)) return { macro: 'residentiel', section: 'Nettoyage ponctuel' };
  if (/coliving|colocation/.test(n)) return { macro: 'residentiel', section: 'Coliving / Colocation' };
  if (/hebergement|airbnb|linge|consommable|\bkit\b/.test(n)) return { macro: 'residentiel', section: 'Airbnb & Conciergerie' };
  // Vitres · Sols · Textiles (avant "pro" pour capter vitrine/vitrerie)
  if (/canape|fauteuil|matelas|moquette|chaise|tapis|tete de lit/.test(n)) return { macro: 'vst', section: 'Textile' };
  if (/tous.*sols|traitement.*sol|\bsols?\b|parquet|prestations techniques|decapage|lustrage|cristallisation|monobrosse/.test(n)) return { macro: 'vst', section: 'Sols' };
  if (/fenetre|baie|velux|vitrine|veranda|vitre|vitrage|carreau/.test(n)) return { macro: 'vst', section: 'Vitrerie' };
  // Remise en état & chantier
  if (/fin de chantier/.test(n)) return { macro: 'remise', section: 'Fin de chantier' };
  if (/etat des lieux/.test(n)) return { macro: 'remise', section: 'États des lieux' };
  if (/remise en etat|apres squat|apres sinistre|apres travaux|insalubre|succession/.test(n)) return { macro: 'remise', section: 'Remise en état & sinistres' };
  // Locaux professionnels
  if (/bureau|boutique|commerce|entrepot|hangar|usine|industrie|atelier/.test(n)) return { macro: 'pro', section: 'Bureaux, commerces & industrie' };
  if (/cabinet|medical|dentaire|creche|ecole|college/.test(n)) return { macro: 'pro', section: 'Santé, petite enfance & éducation' };
  if (/sport|restaurant|hotel|copropriete|immeuble/.test(n)) return { macro: 'pro', section: 'Autres établissements' };
  // Extérieurs & Spécifiques (sous-sections)
  if (/exterieur|terrasse|balcon|facade|haute pression|karcher|panneaux solaires|enseigne|toiture|gouttiere/.test(n)) return { macro: 'ext', section: 'Extérieurs & façades' };
  if (/cuisine|salle de bain|sanitaire|desinfection|degraissage|four|hotte/.test(n)) return { macro: 'ext', section: 'Cuisine, sanitaires & désinfection' };
  if (/debarras|encombrant|tag|graffiti|moisissure|deces|diogene/.test(n)) return { macro: 'ext', section: 'Situations spécifiques' };
  if (/parking|ascenseur|local poubelle|\bvmc\b|climatiseur|ventilation/.test(n)) return { macro: 'ext', section: 'Espaces communs & techniques' };
  if (/desodorisation|odeur|air/.test(n)) return { macro: 'ext', section: 'Traitement de l’air & odeurs' };
  return { macro: 'ext', section: 'Finitions & détails' };
}

// Détails / descriptions par prestation (améliore la lisibilité côté client).
export const DETAILS: Record<string, string> = {
  'Nettoyage ponctuel': 'Nettoyage complet : printemps, après travaux, avant/après vente ou location',
  'Nettoyage Hébergement': 'Ménage entre deux locations, du studio au T5',
  'Gestion du linge': 'Lit, serviettes : lavage, séchage, repassage, mise en place',
  'Kit consommables': 'Papier toilette, savon, shampoing, café, thé, liquide vaisselle, sacs, éponge',
  'Bureaux (Quotidien, Hebdo, Mensuel)': 'Fréquence quotidienne, hebdomadaire ou mensuelle',
  'Bureaux (Taux horaire)': 'Facturation à la durée d’intervention',
  'Copropriétés': 'Hall, escaliers, ascenseur, local poubelle, parking',
  'Nettoyage Fin de Chantier': 'Appartement, maison, commerce, local, bureau, immeuble',
  'Remise en état globale': 'Après travaux, sinistre, squat, succession, déménagement, dégât des eaux',
  'Nettoyage État des lieux': 'Cuisine, salle de bain, vitres, plinthes, portes, sols inclus',
  'Traitements tous sols': 'Carrelage, parquet, PVC, moquette, marbre, pierre, béton ciré, résine',
  'Cuisine (Détail)': 'Placards, hotte, four, micro-ondes, frigo, congélateur, lave-vaisselle',
  'Salle de bain (Détail)': 'Détartrage, paroi de douche, robinetterie, joints, WC',
  'Nettoyage extérieur global': 'Terrasse, balcon, cour, garage, allée, façade, toiture, gouttières',
  'Débarras complet': 'Appartement, maison, garage, cave, grenier',
  'Coliving - 1 chambre + communs': 'Chambre + parties communes (cuisine, salon, sanitaires)',
  'Coliving - 2 chambres + communs': '2 chambres + parties communes',
  'Coliving - 3 chambres (maison complete)': 'Maison entière en colocation',
};

// Libellé d'unité par mots-clés du nom (pour le stepper « 6 fenêtre(s) »).
export function unitLabelFor(t: Tarif): string | null {
  const n = t.nom.toLowerCase();
  if (t.unite === 'heure') return 'heure(s)';
  const map: [RegExp, string][] = [
    [/fenetre|fenêtre/, 'fenêtre(s)'], [/baie/, 'baie(s)'], [/velux/, 'Velux'], [/porte-|porte /, 'porte(s)'],
    [/volet/, 'volet(s)'], [/store/, 'store(s)'], [/moustiquaire/, 'moustiquaire(s)'], [/canape|canapé/, 'canapé(s)'],
    [/fauteuil/, 'fauteuil(s)'], [/matelas/, 'matelas'], [/cuisine/, 'cuisine(s)'], [/salle de bain/, 'salle(s) de bain'],
    [/sanitaire/, 'bloc(s)'], [/hébergement|hebergement/, 'logement(s)'], [/linge/, 'kit(s)'], [/consommable|kit/, 'kit(s)'],
    [/copropriete|copropriété|ascenseur|passage/, 'passage(s)'], [/escalier/, 'volée(s)'], [/luminaire/, 'luminaire(s)'],
    [/poignee|poignée/, 'poignée(s)'], [/vmc/, 'grille(s)'], [/climatiseur/, 'unité(s)'], [/plinthe/, 'ml'],
    [/enseigne/, 'enseigne(s)'], [/local poubelle/, 'local/locaux'],
  ];
  for (const [re, label] of map) if (re.test(n)) return label;
  if (t.unite === 'piece') return 'unité(s)';
  return null;
}

export function modeFor(t: Tarif): Mode {
  const hasPrice = t.prixMin != null || t.prixMax != null || t.prix > 0;
  if (!hasPrice) return 'quote';
  if (t.unite === 'm2') return 'm2';
  if (t.unite === 'forfait') return 'forfait';
  return 'unit';
}

export function displayName(t: Tarif): string {
  return t.nom.replace(/^Entretien classique\s*-\s*/i, '').replace(/^Coliving\s*-\s*/i, '');
}

export function toItem(t: Tarif): Item {
  return { tarif: t, name: displayName(t), detail: DETAILS[t.nom] ?? null, unitLabel: unitLabelFor(t), mode: modeFor(t), min: t.prixMin ?? (t.prix > 0 ? t.prix : null), max: t.prixMax ?? (t.prix > 0 ? t.prix : null) };
}

// Prestations trop sensibles pour un écran non-admin (restent dispo côté admin).
export function isHiddenPublic(t: Tarif): boolean {
  return /(deces|diogene|sinistre|squat)/.test(norm(t.nom));
}

// Construit les macro-catégories → sections → items.
export function buildCatalog(tarifs: Tarif[]): Macro[] {
  const buckets = new Map<string, Map<string, Item[]>>();
  for (const t of tarifs) {
    if (isHiddenPublic(t)) continue;
    const { macro, section } = classify(t);
    const secMap = buckets.get(macro) ?? buckets.set(macro, new Map()).get(macro)!;
    (secMap.get(section) ?? secMap.set(section, []).get(section)!).push(toItem(t));
  }
  const out: Macro[] = [];
  for (const m of MACRO_DEF) {
    const secMap = buckets.get(m.id);
    if (!secMap) continue;
    const order = SECTION_ORDER[m.id] ?? [...secMap.keys()];
    const titles = [...order.filter(tt => secMap.has(tt)), ...[...secMap.keys()].filter(tt => !order.includes(tt))];
    const sections: Section[] = titles.map(title => ({ title, single: SINGLE_SECTIONS.has(title), items: secMap.get(title)! }));
    if (sections.length) out.push({ id: m.id, title: m.title, tagline: m.tagline, sections });
  }
  return out;
}
