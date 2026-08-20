// ── Simulateur de devis Airbnb — calcul PUR (sans I/O) ────────────────────────
//
// Le visiteur configure son logement, l'estimation se construit ligne par ligne.
// Aucun tarif n'est écrit ici : tout vient de la configuration chargée depuis la
// base (voir lib/devisConfig.ts et supabase/migration_devis_simulateur.sql), de
// sorte qu'une hausse de prix se fasse dans l'admin, jamais dans le code.
//
// Règle de sûreté : dès qu'une donnée manque pour chiffrer honnêtement (surface
// hors grille, capacité hors barème), on bascule en « sur devis » plutôt que de
// sortir un montant faux. Un prix erroné affiché à un client est pire que pas
// de prix du tout.

export interface SurfaceTier {
  /** Identifiant en base — absent dans les configurations de test. */
  id?: string;
  maxM2: number;
  label: string;
  capText?: string;
  /** null = au-delà de la grille → sur devis. */
  basePrice: number | null;
}

export interface CapacityStep { max: number; fee: number }
export interface BathroomStep { from: number; fee: number }

export interface QuoteOption {
  /** Identifiant en base — absent dans les configurations de test. */
  id?: string;
  key: string;
  label: string;
  fee: number;
  perCapacity: boolean;
  tiers?: CapacityStep[] | null;
  defaultOn: boolean;
}

export interface QuoteZone {
  id: string;
  name: string;
  fee: number;
  communes: string[];
  color?: string;
}

export interface UrgencyLevel { id: string; label: string; meta?: string; fee: number }

export interface SimulatorConfig {
  tiers: SurfaceTier[];
  zones: QuoteZone[];
  options: QuoteOption[];
  capacitySurcharge: CapacityStep[];
  bathroomSurcharge: BathroomStep[];
  urgency: UrgencyLevel[];
  minM2: number;
  maxM2: number;
}

export interface SimulatorState {
  surface: number;
  travelers: number;
  bathrooms: number;
  zoneId: string | null;
  /** Clés des options retenues. */
  options: string[];
  urgencyId: string | null;
}

export interface QuoteLine { label: string; amount: number }

export interface Quote {
  tier: SurfaceTier | null;
  lines: QuoteLine[];
  total: number;
  /** Vrai quand la configuration sort de la grille : on ne chiffre pas. */
  onRequest: boolean;
  /** Pourquoi c'est sur devis — affiché au visiteur, pas un code d'erreur. */
  reason?: string;
}

/** Palier applicable à une valeur (le premier dont le plafond n'est pas dépassé). */
function stepFor<T extends { max: number }>(steps: T[], value: number): T | undefined {
  return [...steps].sort((a, b) => a.max - b.max).find(s => value <= s.max);
}

/** Palier de surface applicable. */
export function tierFor(tiers: SurfaceTier[], surface: number): SurfaceTier | undefined {
  return [...tiers].sort((a, b) => a.maxM2 - b.maxM2).find(t => surface <= t.maxM2);
}

/**
 * Supplément « salles de bain » : la première est comprise, chaque suivante
 * ajoute son palier. Au-delà du dernier palier défini, on prolonge avec le
 * dernier écart connu plutôt que de plafonner en silence.
 */
export function bathroomFee(steps: BathroomStep[], count: number): number {
  if (count <= 1 || steps.length === 0) return 0;
  const sorted = [...steps].sort((a, b) => a.from - b.from);
  const exact = sorted.filter(s => s.from <= count).pop();
  if (!exact) return 0;
  const last = sorted[sorted.length - 1];
  if (count <= last.from) return exact.fee;
  // Extrapolation linéaire au-delà du barème (écart entre les deux derniers paliers).
  const prev = sorted[sorted.length - 2];
  const stepValue = prev ? last.fee - prev.fee : last.fee;
  return last.fee + (count - last.from) * stepValue;
}

/** Coût d'une option, selon qu'elle est forfaitaire ou indexée sur la capacité. */
export function optionFee(option: QuoteOption, travelers: number): number | null {
  if (!option.perCapacity) return option.fee;
  const step = stepFor(option.tiers ?? [], travelers);
  // Capacité au-delà du barème d'une option : on ne devine pas.
  return step ? step.fee : null;
}

/**
 * Construit l'estimation. `lines` est destiné à l'affichage : chaque ligne dit
 * ce qu'elle facture, dans l'ordre où le visiteur l'a choisi.
 */
export function computeQuote(config: SimulatorConfig, state: SimulatorState): Quote {
  const tier = tierFor(config.tiers, state.surface) ?? null;

  if (!tier || tier.basePrice === null) {
    return { tier, lines: [], total: 0, onRequest: true, reason: 'Surface hors grille standard' };
  }

  const capStep = stepFor(config.capacitySurcharge, state.travelers);
  if (!capStep) {
    return { tier, lines: [], total: 0, onRequest: true, reason: 'Capacité hors grille standard' };
  }

  const lines: QuoteLine[] = [{ label: `Ménage ${tier.label}`, amount: tier.basePrice }];
  let total = tier.basePrice;

  if (capStep.fee > 0) {
    lines.push({ label: `Capacité ${state.travelers} voyageurs`, amount: capStep.fee });
    total += capStep.fee;
  }

  const bath = bathroomFee(config.bathroomSurcharge, state.bathrooms);
  if (bath > 0) {
    lines.push({ label: `${state.bathrooms} salles de bain`, amount: bath });
    total += bath;
  }

  const zone = config.zones.find(z => z.id === state.zoneId);
  if (zone && zone.fee > 0) {
    lines.push({ label: `Zone — ${zone.name}`, amount: zone.fee });
    total += zone.fee;
  }

  for (const option of config.options) {
    if (!state.options.includes(option.key)) continue;
    const fee = optionFee(option, state.travelers);
    if (fee === null) {
      return { tier, lines: [], total: 0, onRequest: true, reason: `${option.label} : capacité hors barème` };
    }
    if (fee > 0) { lines.push({ label: option.label, amount: fee }); total += fee; }
  }

  const urgency = config.urgency.find(u => u.id === state.urgencyId);
  if (urgency && urgency.fee > 0) {
    lines.push({ label: `Délai — ${urgency.label.toLowerCase()}`, amount: urgency.fee });
    total += urgency.fee;
  }

  return { tier, lines, total: Math.round(total), onRequest: false };
}

/** État de départ cohérent avec la configuration (options cochées d'avance, 1re zone). */
export function initialState(config: SimulatorConfig): SimulatorState {
  const mid = Math.round((config.minM2 + config.maxM2) / 5);
  return {
    surface: Math.min(Math.max(mid, config.minM2), config.maxM2),
    travelers: 2,
    bathrooms: 1,
    zoneId: config.zones[0]?.id ?? null,
    options: config.options.filter(o => o.defaultOn).map(o => o.key),
    urgencyId: config.urgency[0]?.id ?? null,
  };
}

/** Zone correspondant à une commune saisie (recherche insensible à la casse/accents). */
export function zoneForCommune(zones: QuoteZone[], commune: string): QuoteZone | undefined {
  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const target = norm(commune);
  if (!target) return undefined;
  return zones.find(z => z.communes.some(c => norm(c) === target))
    ?? zones.find(z => z.communes.some(c => norm(c).includes(target) || target.includes(norm(c))));
}
