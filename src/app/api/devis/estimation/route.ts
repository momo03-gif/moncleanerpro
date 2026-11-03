// ── POST /api/devis/estimation ───────────────────────────────────────────────
// Le chiffrage des pages de devis (publique et espace conciergerie), fait ici :
// le navigateur ne reçoit jamais la grille, seulement le catalogue sans prix et
// la fourchette de SA sélection (cf. lib/devisEstimation.ts).
//   · catalogue   → prestations sans prix + config d'affichage du simulateur
//   · selection   → { sel }   : fourchette des cases cochées
//   · description → { texte } : prestations reconnues par l'agent (sans prix)
//   · simulation  → { state } : devis du simulateur Airbnb

import { NextResponse } from 'next/server';
import { grilleTarifs, configSimulateur } from '@/lib/devisServeur';
import { catalogueSansPrix, estimerSelection, configPublique, etatSimulationValide, type Selection } from '@/lib/devisEstimation';
import { estimateFromDescription } from '@/lib/devisEstimate';
import { computeQuote, type SimulatorState } from '@/lib/devisSimulator';

export const runtime = 'nodejs';

const ko = (error: string, status = 400) => NextResponse.json({ error }, { status });
const sansCache = { 'Cache-Control': 'no-store' };

export async function POST(req: Request) {
  let b: { action?: string; sel?: Selection; texte?: string; state?: Partial<SimulatorState> };
  try { b = await req.json(); } catch { return ko('Requête invalide.'); }

  switch (b.action) {
    case 'catalogue': {
      const [tarifs, cfg] = await Promise.all([grilleTarifs(), configSimulateur()]);
      return NextResponse.json({ tarifs: catalogueSansPrix(tarifs), simulateur: cfg ? configPublique(cfg) : null }, { headers: sansCache });
    }
    case 'selection': {
      const sel = b.sel && typeof b.sel === 'object' ? b.sel : {};
      if (Object.keys(sel).length > 200) return ko('Sélection trop longue.');
      return NextResponse.json({ estimation: estimerSelection(await grilleTarifs(), sel) }, { headers: sansCache });
    }
    case 'description': {
      const texte = String(b.texte ?? '').slice(0, 4000);
      const trouvees = estimateFromDescription(texte, await grilleTarifs()).map(l => ({ nom: l.nom, quantite: l.quantite }));
      return NextResponse.json({ trouvees }, { headers: sansCache });
    }
    case 'simulation': {
      const cfg = await configSimulateur();
      if (!cfg) return ko('Simulateur indisponible.', 404);
      return NextResponse.json({ quote: computeQuote(cfg, etatSimulationValide(cfg, b.state)) }, { headers: sansCache });
    }
    default:
      return ko('Action inconnue.');
  }
}
