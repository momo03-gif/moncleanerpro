// ── Estimation d'un devis, côté navigateur ──────────────────────────────────
// Le navigateur n'a plus la grille : il demande au serveur (/api/devis/estimation)
// le catalogue sans prix, puis la fourchette de la sélection en cours.

import { useEffect, useMemo, useState } from 'react';
import type { Tarif } from './devis';
import type { SimulatorConfig, SimulatorState, Quote } from './devisSimulator';
import { estimerSelection, type Estimation, type Selection } from './devisEstimation';

async function appel<T>(corps: Record<string, unknown>): Promise<T | null> {
  try {
    const res = await fetch('/api/devis/estimation', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Les prestations (sans prix) et la config d'affichage du simulateur. */
export async function chargerCatalogueDevis(): Promise<{ tarifs: Tarif[]; simulateur: SimulatorConfig | null }> {
  const r = await appel<{ tarifs: Tarif[]; simulateur: SimulatorConfig | null }>({ action: 'catalogue' });
  return r ?? { tarifs: [], simulateur: null };
}

/** Prestations reconnues dans une description libre (l'agent tourne côté serveur). */
export async function reconnaitreDescription(texte: string): Promise<{ nom: string; quantite: number }[]> {
  const r = await appel<{ trouvees: { nom: string; quantite: number }[] }>({ action: 'description', texte });
  return r?.trouvees ?? [];
}

/**
 * La fourchette de la sélection. Ce qui ne dépend pas des prix (nombre de
 * prestations, « sur devis », surface manquante) se calcule tout de suite sur
 * le catalogue ; les montants arrivent du serveur un instant après. « En cours »
 * se déduit : la dernière réponse ne correspond pas encore à la sélection.
 */
export function useEstimation(catalogue: Tarif[], sel: Selection): Estimation & { enCours: boolean } {
  const local = useMemo(() => estimerSelection(catalogue, sel), [catalogue, sel]);
  const cle = JSON.stringify(sel);
  const vide = Object.keys(sel).length === 0;
  const [recu, setRecu] = useState<{ cle: string; m: Pick<Estimation, 'min' | 'max' | 'parNom'> }>({ cle: '', m: MONTANTS_VIDES });

  useEffect(() => {
    if (vide) return;
    let actif = true;   // une sélection plus récente annule la réponse en route
    const t = setTimeout(async () => {
      const r = await appel<{ estimation: Estimation }>({ action: 'selection', sel });
      if (actif) setRecu({ cle, m: r ? { min: r.estimation.min, max: r.estimation.max, parNom: r.estimation.parNom } : MONTANTS_VIDES });
    }, 250);
    return () => { actif = false; clearTimeout(t); };
    // `cle` résume `sel` : on ne relance pas pour un nouvel objet identique.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);

  // En attendant la réponse, on garde l'ancienne fourchette plutôt qu'un zéro.
  return { ...local, ...(vide ? MONTANTS_VIDES : recu.m), enCours: !vide && recu.cle !== cle };
}

const MONTANTS_VIDES: Pick<Estimation, 'min' | 'max' | 'parNom'> = { min: 0, max: 0, parNom: {} };
const DEVIS_VIDE: Quote = { tier: null, lines: [], total: 0, totalMax: 0, onRequest: false };

/** Le devis du simulateur Airbnb pour cet état, calculé par le serveur. */
export function useSimulation(state: SimulatorState): Quote & { enCours: boolean } {
  const cle = JSON.stringify(state);
  const [recu, setRecu] = useState<{ cle: string; quote: Quote }>({ cle: '', quote: DEVIS_VIDE });

  useEffect(() => {
    let actif = true;
    const t = setTimeout(async () => {
      const r = await appel<{ quote: Quote }>({ action: 'simulation', state });
      // Serveur injoignable : on ne bloque pas le visiteur, il continue « sur devis ».
      if (actif) setRecu({ cle, quote: r ? r.quote : { ...DEVIS_VIDE, onRequest: true, reason: 'Estimation momentanément indisponible' } });
    }, 200);
    return () => { actif = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);

  return { ...recu.quote, enCours: recu.cle !== cle };
}
