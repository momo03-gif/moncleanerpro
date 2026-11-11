// ── Lecture des montants saisis dans l'admin ─────────────────────────────────
//
// Module PUR. Les prix de Tarification partent directement sur le site public :
// une saisie mal lue ne doit JAMAIS devenir un prix. Avant, chaque champ faisait
// `parseFloat(...) || 0` : « 1 200 » devenait 1 €, une lettre devenait 0 €.
// Ici, tout ce qui n'est pas clairement un montant est REFUSÉ, avec un message.

export type Lecture =
  | { ok: true; valeur: number | null }
  | { ok: false; erreur: string };

/**
 * Montant en euros. Accepte « 45 », « 45,50 », « 1 200 », « 35 € ».
 * Vide → `null` (le sens du vide dépend du champ : « sur devis », « prix ferme »…).
 */
export function lireMontant(raw: string | number | null | undefined, champ = 'Ce montant'): Lecture {
  if (raw == null) return { ok: true, valeur: null };
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && raw >= 0 ? { ok: true, valeur: raw } : { ok: false, erreur: `${champ} n'est pas valide.` };
  }
  const s = raw.replace(/[\s  ]/g, '').replace(/€$/, '').replace(',', '.');
  if (s === '') return { ok: true, valeur: null };
  if (!/^\d+(\.\d{1,2})?$/.test(s)) {
    return { ok: false, erreur: `${champ} : « ${raw.trim()} » n'est pas un montant (exemple : 45 ou 45,50).` };
  }
  return { ok: true, valeur: Number(s) };
}

/** Nombre entier positif (surface en m², nombre de voyageurs…). Vide → `null`. */
export function lireEntier(raw: string | number | null | undefined, champ = 'Ce nombre'): Lecture {
  if (raw == null) return { ok: true, valeur: null };
  if (typeof raw === 'number') {
    return Number.isInteger(raw) && raw >= 0 ? { ok: true, valeur: raw } : { ok: false, erreur: `${champ} doit être un nombre entier.` };
  }
  const s = raw.replace(/[\s  ]/g, '');
  if (s === '') return { ok: true, valeur: null };
  if (!/^\d+$/.test(s)) return { ok: false, erreur: `${champ} : « ${raw.trim()} » doit être un nombre entier.` };
  return { ok: true, valeur: Number(s) };
}

/** Fourchette « de … à … » : la borne basse ne peut pas dépasser la haute. */
export function erreurFourchette(min: number | null, max: number | null): string | null {
  if (min != null && max != null && min > max) {
    return `Le prix « de » (${min} €) est plus grand que le prix « à » (${max} €).`;
  }
  return null;
}

/**
 * Prix de référence par défaut d'une prestation : le milieu de la fourchette
 * (même règle que l'import CSV), ou la seule borne connue. `null` = sur devis.
 */
export function prixReferenceParDefaut(min: number | null, max: number | null): number | null {
  if (min != null && max != null) return Math.round(((min + max) / 2) * 100) / 100;
  return min ?? max ?? null;
}

/** Le prix de référence sort-il de la fourchette annoncée ? (signalement, jamais bloquant) */
export function referenceHorsFourchette(prix: number, min: number | null, max: number | null): boolean {
  if (min == null || max == null || !(prix > 0)) return false;
  return prix < min || prix > max;
}

/** Côté serveur : un montant reçu en JSON est-il acceptable ? (`null` autorisé) */
export function montantServeurValide(v: unknown): boolean {
  return v == null || (typeof v === 'number' && Number.isFinite(v) && v >= 0);
}
