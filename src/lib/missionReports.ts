import { supabase } from './supabase';
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
    lostFound: (r.lost_found as string) ?? undefined,
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

export async function getMissionReportDB(missionId: string): Promise<MissionReport | null> {
  const { data, error } = await supabase
    .from('mission_reports')
    .select('*')
    .eq('mission_id', missionId)
    .maybeSingle();
  if (error) { console.error('getMissionReportDB:', error.message); return null; }
  return data ? rowToReport(data) : null;
}

export async function saveMissionReportDB(report: MissionReport): Promise<{ error: string | null }> {
  const { error } = await supabase.from('mission_reports').upsert({
    mission_id: report.missionId,
    consumables: report.consumables ?? [],
    consumables_note: report.consumablesNote || null,
    issues: report.issues || null,
    lost_found: report.lostFound || null,
    note: report.note || null,
    submitted_by: report.submittedBy || null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'mission_id' });
  if (error) console.error('saveMissionReportDB:', error.message);
  return { error: error?.message ?? null };
}
