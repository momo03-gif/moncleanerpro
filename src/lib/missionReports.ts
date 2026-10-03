import { annexe } from './db/shared';
import type { MissionReport } from './types';

// ════════════════════════════════════════════════════════════════════════════
//  Rapport d'état du logement (1 par mission). Rempli par le cleaner en fin de
//  mission, consultable par l'admin et le partenaire (hôte). Table légère :
//  mission_reports(mission_id unique, consumables jsonb, ...).
// ════════════════════════════════════════════════════════════════════════════

function rowToReport(r: Record<string, unknown>): MissionReport {
  return {
    missionId: r.mission_id as string,
    consumables: Array.isArray(r.consumables) ? (r.consumables as string[]) : [],
    consumablesNote: (r.consumables_note as string) ?? undefined,
    issues: (r.issues as string) ?? undefined,
    issuesUnit: (r.issues_unit as string) ?? undefined,
    lostFound: (r.lost_found as string) ?? undefined,
    lostFoundUnit: (r.lost_found_unit as string) ?? undefined,
    note: (r.note as string) ?? undefined,
    submittedBy: (r.submitted_by as string) ?? undefined,
    updatedAt: (r.updated_at as string) ?? undefined,
  };
}

// Indique si un rapport contient au moins une information (sinon « vide »).
export function reportHasContent(r: MissionReport | null | undefined): boolean {
  if (!r) return false;
  return (r.consumables?.length ?? 0) > 0
    || !!(r.consumablesNote || r.issues || r.lostFound || r.note);
}

// Incident ouvert = un rapport qui signale un problème/dégât. On joint la mission
// (appartement + date) pour l'afficher sur le dashboard opérationnel.
export interface OpenIncident {
  missionId: string;
  issues: string;
  property?: string;
  date?: string;
  status?: string;
  updatedAt?: string;
}

// Incidents signalés (dégâts…) — tableau de bord admin. La lecture se fait par
// le serveur ; elle demandait autrefois des colonnes inexistantes
// (missions.property / missions.date) et revenait donc toujours vide.
export async function getOpenIncidentsDB(): Promise<OpenIncident[]> {
  try { return (await annexe('incidents')).data ?? []; }
  catch (e) { console.error('getOpenIncidentsDB:', e); return []; }
}



export async function getMissionReportDB(missionId: string): Promise<MissionReport | null> {
  try {
    const data = (await annexe('report', { missionId })).data;
    return data ? rowToReport(data) : null;
  } catch (e) { console.error('getMissionReportDB:', e); return null; }
}

export async function saveMissionReportDB(report: MissionReport): Promise<{ error: string | null }> {
  // Réservé à l'admin et au cleaner de la mission (vérifié côté serveur).
  try { await annexe('report-save', { report }); return { error: null }; }
  catch (e) {
    const message = e instanceof Error ? e.message : 'Enregistrement impossible.';
    console.error('saveMissionReportDB:', message);
    return { error: message };
  }
}
