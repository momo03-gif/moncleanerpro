// ── Estimation d'un devis, calculée CÔTÉ SERVEUR (logique pure) ─────────────
//
// La grille tarifaire ne quitte plus le serveur. Avant, la page publique (et
// l'espace conciergerie) téléchargeaient toute la table `tarifs` et la config du
// simulateur, prix compris : un concurrent pouvait copier la grille en une
// requête, sans rien remplir. Désormais :
//   · le navigateur reçoit le CATALOGUE sans prix (de quoi afficher les cases) ;
//   · il envoie SA sélection, le serveur rend la fourchette de cette sélection ;
//   · la demande de devis est recalculée ici, jamais crue sur parole.
// Règle métier inchangée : aucun prix sur les cartes, la fourchette n'apparaît
// qu'une fois le choix fait (cf. mémoire « prix masqués »).

import type { Tarif, DevisLine } from './devis';
import { modeFor, displayName } from './devisCatalog';
import type { SimulatorConfig, SimulatorState, Quote } from './devisSimulator';
import { moneyArrondi as euros } from './format';

/** Ce que le visiteur a coché : nom de prestation → quantité (m² pour une surface). */
export type Selection = Record<string, { qty: number }>;

export interface Estimation {
  min: number;
  max: number;
  /** Prestations « sur devis » (pas de prix) : listées, non chiffrées. */
  quote: string[];
  /** Prestations au m² dont la surface manque. */
  incomplete: string[];
  count: number;
  /** Fourchette de chaque ligne chiffrée, pour le récapitulatif. */
  parNom: Record<string, { min: number; max: number }>;
}

const centimes = (n: number) => Math.round(n * 100) / 100;

/**
 * Le catalogue tel qu'il part au navigateur : noms, unités, catégories — SANS
 * prix. `prix` vaut 1 quand la prestation est chiffrée et 0 quand elle est sur
 * devis : de quoi garder le bon mode d'affichage (modeFor), rien de plus.
 */
export function catalogueSansPrix(tarifs: Tarif[]): Tarif[] {
  return tarifs.filter(t => t.actif).map(t => ({
    id: t.id, nom: t.nom, unite: t.unite, actif: true, categorie: t.categorie,
    prix: modeFor(t) === 'quote' ? 0 : 1, prixMin: null, prixMax: null,
  }));
}

/** Fourchette d'une sélection (même règle que l'ancien calcul dans le navigateur). */
export function estimerSelection(tarifs: Tarif[], sel: Selection): Estimation {
  const parNomTarif = new Map(tarifs.filter(t => t.actif).map(t => [t.nom, t]));
  const out: Estimation = { min: 0, max: 0, quote: [], incomplete: [], count: 0, parNom: {} };
  for (const nom of Object.keys(sel)) {
    const t = parNomTarif.get(nom);
    if (!t) continue;
    out.count++;
    const m = modeFor(t);
    if (m === 'quote') { out.quote.push(nom); continue; }
    const q = Math.max(0, Number(sel[nom]?.qty) || 0);
    if (m === 'm2' && q <= 0) { out.incomplete.push(nom); continue; }
    if (q <= 0) continue;
    const min = centimes((t.prixMin ?? t.prix) * q);
    const max = centimes((t.prixMax ?? t.prix) * q);
    out.min = centimes(out.min + min);
    out.max = centimes(out.max + max);
    out.parNom[nom] = { min, max };
  }
  return out;
}

/** Les lignes enregistrées sur la demande de devis (prix de la grille, pas du navigateur). */
export function lignesSelection(tarifs: Tarif[], sel: Selection): DevisLine[] {
  const parNomTarif = new Map(tarifs.filter(t => t.actif).map(t => [t.nom, t]));
  const lignes: DevisLine[] = [];
  for (const nom of Object.keys(sel)) {
    const t = parNomTarif.get(nom);
    if (!t) continue;
    const m = modeFor(t);
    const q = Math.max(0, Number(sel[nom]?.qty) || 0) || (m === 'm2' ? 0 : 1);
    const pu = t.prix > 0 ? t.prix : 0;
    lignes.push({
      nom: displayName(t) + (m === 'm2' && q > 0 ? ` (${q.toLocaleString('fr-FR')} m²)` : ''),
      quantite: Math.max(1, q || 1), prix_unitaire: pu, total: centimes(pu * (q || 1)),
    });
  }
  return lignes;
}

/**
 * La config du simulateur telle qu'elle part au navigateur : ce qu'il AFFICHE
 * (bornes de surface, zones et leur supplément, libellés des options), jamais
 * les paliers de prix, les suppléments voyageurs / salles de bain ni le prix
 * des options. Le chiffrage se demande au serveur (simulerDevis).
 */
export function configPublique(cfg: SimulatorConfig): SimulatorConfig {
  return {
    tiers: [],
    zones: cfg.zones,
    options: cfg.options.map(o => ({ ...o, fee: 0, tiers: null })),
    extraGuestFee: 0,
    bathroomSurcharge: [],
    urgency: cfg.urgency.map(u => ({ ...u, fee: 0 })),
    minM2: cfg.minM2,
    maxM2: cfg.maxM2,
  };
}

/** Un état de simulateur reçu du navigateur, ramené dans les bornes de la config. */
export function etatSimulationValide(cfg: SimulatorConfig, s: Partial<SimulatorState> | null | undefined): SimulatorState {
  const nombre = (v: unknown, def: number) => (Number.isFinite(Number(v)) ? Number(v) : def);
  const zones = new Set(cfg.zones.map(z => z.id));
  const options = new Set(cfg.options.map(o => o.key));
  const urgences = new Set(cfg.urgency.map(u => u.id));
  return {
    surface: Math.min(Math.max(Math.round(nombre(s?.surface, cfg.minM2)), cfg.minM2), cfg.maxM2),
    travelers: Math.min(Math.max(Math.round(nombre(s?.travelers, 2)), 1), 40),
    bathrooms: Math.min(Math.max(Math.round(nombre(s?.bathrooms, 1)), 1), 20),
    zoneId: s?.zoneId && zones.has(s.zoneId) ? s.zoneId : null,
    options: Array.isArray(s?.options) ? s!.options.filter(k => options.has(k)) : [],
    urgencyId: s?.urgencyId && urgences.has(s.urgencyId) ? s.urgencyId : null,
  };
}

/** Les lignes d'une simulation, pour la demande de devis (mise en forme d'avant). */
export function lignesSimulation(q: Quote): DevisLine[] {
  return q.lines.map(l => ({
    nom: l.label + (l.amountMax && l.amountMax > l.amount ? ` (${euros(l.amount)} à ${euros(l.amountMax)})` : ''),
    quantite: 1, prix_unitaire: l.amount, total: l.amount,
  }));
}
