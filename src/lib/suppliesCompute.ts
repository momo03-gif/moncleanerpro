// ── Liste de réapprovisionnement — logique PURE (sans I/O) ────────────────────
// Isolé de supplies.ts (qui importe supabase) pour rester testable.
//
// Un consommable est « à racheter » s'il a été signalé manquant lors d'un ménage
// POSTÉRIEUR au dernier réapprovisionnement enregistré pour cet article. Rien à
// décompter, rien à saisir : la liste se construit à partir de ce que
// l'intervenant a déjà coché en fin de ménage.

export interface SupplyReport {
  /** Consommables cochés dans le compte-rendu. */
  items: string[];
  /** Date du ménage concerné (YYYY-MM-DD). */
  date: string;
  missionId: string;
  /** Précision libre du compte-rendu (« plus de pastilles »). */
  note?: string;
}

export interface SupplyRestock {
  item: string;
  restockedAt: string; // ISO
}

export interface SupplyNeed {
  item: string;
  /** Date du ménage le plus RÉCENT qui l'a signalé. */
  lastReportedOn: string;
  /** Nombre de ménages qui l'ont signalé depuis le dernier réapprovisionnement. */
  timesReported: number;
  missionId: string;
  notes: string[];
}

/** Jour (YYYY-MM-DD) d'un horodatage ISO — les rapports sont datés au jour. */
function dayOf(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-CA');
}

/**
 * Liste de courses d'un logement : ce qui reste à racheter, le plus urgent
 * d'abord (signalé le plus souvent, puis le plus récemment).
 */
export function supplyNeeds(reports: SupplyReport[], restocks: SupplyRestock[]): SupplyNeed[] {
  // Dernier réapprovisionnement connu par article.
  const lastRestock = new Map<string, string>();
  for (const r of restocks) {
    const day = dayOf(r.restockedAt);
    const known = lastRestock.get(r.item);
    if (!known || day > known) lastRestock.set(r.item, day);
  }

  const byItem = new Map<string, SupplyNeed>();
  for (const report of reports) {
    for (const item of report.items) {
      // Signalé AVANT (ou le jour même) du dernier rachat → considéré réglé.
      const restockedOn = lastRestock.get(item);
      if (restockedOn && report.date <= restockedOn) continue;

      const current = byItem.get(item);
      if (!current) {
        byItem.set(item, {
          item,
          lastReportedOn: report.date,
          timesReported: 1,
          missionId: report.missionId,
          notes: report.note ? [report.note] : [],
        });
      } else {
        current.timesReported++;
        if (report.date > current.lastReportedOn) {
          current.lastReportedOn = report.date;
          current.missionId = report.missionId;
        }
        if (report.note && !current.notes.includes(report.note)) current.notes.push(report.note);
      }
    }
  }

  return [...byItem.values()].sort((a, b) =>
    b.timesReported - a.timesReported || b.lastReportedOn.localeCompare(a.lastReportedOn));
}

/**
 * Un article signalé plusieurs ménages de suite mérite une alerte : il manque
 * à chaque passage, donc personne ne l'a racheté. Équivalent du « low stock
 * alert » de Breezeway, sans inventaire à tenir.
 */
export function urgentNeeds(needs: SupplyNeed[], threshold = 2): SupplyNeed[] {
  return needs.filter(n => n.timesReported >= threshold);
}
