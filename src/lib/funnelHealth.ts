import type { SupabaseClient } from '@supabase/supabase-js';

// ══════════════════════════════════════════════════════════════════════════════
//  Surveillance de l'entonnoir de devis.
//
//  POURQUOI CE MODULE EXISTE : le 28 août 2026, un déploiement a ajouté une
//  colonne au code sans qu'elle existe en base. Chaque demande de devis a
//  répondu « Enregistrement impossible, réessayez » — et personne ne l'a su
//  pendant DIX JOURS. Aucune erreur visible, aucune alerte : juste un compteur
//  à zéro que personne ne regardait.
//
//  Deux signaux, de natures différentes :
//
//   • LE CANARI (déterministe) — on écrit puis on supprime une ligne de test
//     ayant EXACTEMENT la forme de ce qu'écrit /api/devis-request. Si l'écriture
//     échoue, l'entonnoir est cassé, point. Aucun faux positif possible, et
//     c'est précisément ce qui aurait attrapé le bug du 28 août le jour même.
//
//   • LE SILENCE (statistique) — aucune demande depuis N jours. Peut être un
//     creux normal, d'où un seuil prudent et une formulation qui invite à
//     vérifier plutôt qu'à paniquer.
// ══════════════════════════════════════════════════════════════════════════════

/** Au-delà, l'absence de demande mérite qu'on aille voir. */
export const SILENCE_THRESHOLD_DAYS = 7;

/** Le canari peut réalerter chaque jour : c'est une panne, elle doit insister. */
export const BROKEN_COOLDOWN_HOURS = 20;

/** Le silence, lui, ne se rappelle que tous les trois jours. */
export const SILENT_COOLDOWN_HOURS = 72;

export type FunnelAlertKind = 'funnel_broken' | 'funnel_silent';

export interface FunnelAlert {
  kind: FunnelAlertKind;
  title: string;
  message: string;
}

export interface FunnelState {
  canaryOk: boolean;
  canaryError?: string;
  daysSinceLastDevis: number | null;
  /** Alertes déjà envoyées récemment, pour ne pas répéter le même message. */
  recentAlerts: { kind: FunnelAlertKind; hoursAgo: number }[];
  silenceThresholdDays?: number;
}

/**
 * Décide quelles alertes envoyer. Fonction PURE : toute la logique est ici,
 * l'accès aux données reste dans `runFunnelHealthCheck`.
 */
export function decideFunnelAlerts(state: FunnelState): FunnelAlert[] {
  const alerts: FunnelAlert[] = [];
  const threshold = state.silenceThresholdDays ?? SILENCE_THRESHOLD_DAYS;
  const sentSince = (kind: FunnelAlertKind, hours: number) =>
    state.recentAlerts.some(a => a.kind === kind && a.hoursAgo < hours);

  if (!state.canaryOk) {
    if (!sentSince('funnel_broken', BROKEN_COOLDOWN_HOURS)) {
      alerts.push({
        kind: 'funnel_broken',
        title: 'Les demandes de devis n’arrivent plus',
        message:
          'Le test automatique d’enregistrement a échoué : un visiteur qui remplit le formulaire ' +
          'reçoit une erreur et sa demande est perdue. À corriger en priorité. ' +
          (state.canaryError ? `Détail technique : ${state.canaryError}` : ''),
      });
    }
    // Une panne avérée rend le silence redondant : on ne double pas le message.
    return alerts;
  }

  if (state.daysSinceLastDevis !== null && state.daysSinceLastDevis >= threshold) {
    if (!sentSince('funnel_silent', SILENT_COOLDOWN_HOURS)) {
      alerts.push({
        kind: 'funnel_silent',
        title: 'Aucune demande de devis depuis un moment',
        message:
          `Aucune demande enregistrée depuis ${state.daysSinceLastDevis} jours. ` +
          'L’enregistrement fonctionne (test automatique passé), il s’agit donc soit d’un creux ' +
          'normal, soit d’un problème en amont : formulaire, référencement ou publicité.',
      });
    }
  }

  return alerts;
}

/** Nombre de jours pleins entre une date ISO et maintenant. */
export function daysSince(iso: string | null | undefined, now = Date.now()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.floor((now - t) / 86400000);
}

/**
 * Écrit puis supprime une ligne de test dans `devis`.
 *
 * La ligne porte TOUTES les colonnes qu'écrit la route publique : c'est ce qui
 * fait la valeur du test. Un contrôle qui n'écrirait que `number` passerait au
 * vert alors que `client_phone` manque, et on n'aurait rien vu du tout.
 *
 * Le numéro est préfixé `HEALTHCHECK-` : il ne peut pas entrer en collision avec
 * la numérotation `DEV-AAAA-NNNN`, ni décaler le prochain numéro attribué.
 */
export async function runCanaryWrite(db: SupabaseClient): Promise<{ ok: boolean; error?: string }> {
  const number = `HEALTHCHECK-${Date.now()}`;
  const row = {
    number,
    partner_label: 'Contrôle automatique',
    partner_type: 'devis',
    client_name: 'Contrôle automatique',
    client_email: 'healthcheck@moncleanerpro.fr',
    client_phone: '0000000000',
    client_address: 'Contrôle automatique',
    description: 'Ligne de test écrite puis supprimée par la surveillance.',
    lines: [],
    total: 0,
    status: 'brouillon',
    source: 'public',
  };

  try {
    const { error } = await db.from('devis').insert(row);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    // Suppression systématique, même si l'insertion a échoué : mieux vaut une
    // suppression inutile qu'une ligne de test oubliée dans les devis de l'admin.
    try { await db.from('devis').delete().eq('number', number); } catch { /* ignore */ }
  }
}

export interface FunnelHealthResult {
  canaryOk: boolean;
  canaryError?: string;
  lastDevisAt: string | null;
  daysSinceLastDevis: number | null;
  alertsSent: FunnelAlertKind[];
}

/**
 * Contrôle complet, appelé une fois par jour par le cron. Best-effort : il ne
 * doit jamais faire échouer le traitement auquel il est greffé.
 */
export async function runFunnelHealthCheck(db: SupabaseClient): Promise<FunnelHealthResult> {
  const canary = await runCanaryWrite(db);

  const { data: last } = await db
    .from('devis')
    .select('created_at')
    .like('number', 'DEV-%')
    .order('created_at', { ascending: false })
    .limit(1);
  const lastDevisAt = (last?.[0]?.created_at as string | undefined) ?? null;

  // Alertes déjà envoyées ces derniers jours, pour respecter les temporisations.
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const { data: recent } = await db
    .from('notifications')
    .select('type, created_at')
    .in('type', ['funnel_broken', 'funnel_silent'])
    .gte('created_at', since);

  const alerts = decideFunnelAlerts({
    canaryOk: canary.ok,
    canaryError: canary.error,
    daysSinceLastDevis: daysSince(lastDevisAt),
    recentAlerts: (recent ?? []).map((r: { type: string; created_at: string }) => ({
      kind: r.type as FunnelAlertKind,
      hoursAgo: (Date.now() - Date.parse(r.created_at)) / 3600000,
    })),
  });

  const sent: FunnelAlertKind[] = [];
  if (alerts.length) {
    const { data: admins } = await db.from('users').select('id').eq('role', 'admin');
    const ids = (admins ?? []).map((u: { id: string }) => u.id);
    for (const a of alerts) {
      if (!ids.length) break;
      const { error } = await db.from('notifications').insert(
        ids.map(id => ({
          user_id: id, role: 'admin', title: a.title, message: a.message,
          type: a.kind, mission_id: null,
        })),
      );
      if (!error) sent.push(a.kind);
    }
  }

  return {
    canaryOk: canary.ok,
    canaryError: canary.error,
    lastDevisAt,
    daysSinceLastDevis: daysSince(lastDevisAt),
    alertsSent: sent,
  };
}
