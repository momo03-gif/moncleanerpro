import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { computeMissionGain } from '@/lib/pay';
import type { MissionService } from '@/lib/types';

export const runtime = 'nodejs';

// ── Les deux gestes qu'un navigateur ne doit plus faire ──────────────────────
//
// `missions` est écrite depuis une vingtaine d'endroits (statuts, horaires,
// photos, ordre du planning…). Tout déplacer d'un coup serait risqué : la file
// hors-ligne du cleaner rejoue certaines de ces écritures. On commence donc par
// les deux qui font le plus de dégâts si elles sont détournées :
//
//   · SUPPRIMER une mission — effacer le planning d'une journée ;
//   · ASSIGNER un cleaner — cela écrit `cleaner_gain` et le taux horaire
//     retenu, c'est-à-dire LA PAIE.
//
// Une fois ces deux-là ici, la base peut retirer au navigateur le droit de
// supprimer, et celui d'écrire les colonnes de paie et d'affectation
// (cf. supabase/migration_missions_verrouillage.sql).
//
// Le reste des écritures suivra dans une passe dédiée.

const refus = (message: string, code = 403) => NextResponse.json({ error: message }, { status: code });

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return refus('Non authentifié.', 401);

  let b: {
    action?: 'delete' | 'assign' | 'unassign' | 'delete-recurring';
    missionId?: string; missionIds?: string[];
    cleanerId?: string; cleanerName?: string;
    recurringId?: string;
  } = {};
  try { b = await req.json(); } catch { return refus('Requête invalide.', 400); }

  const db = getSupabaseAdmin();
  const estAdmin = session.role === 'admin';

  /** Qui a le droit d'agir sur cette mission : l'admin, ou celui qui l'a créée. */
  async function peutAgir(missionId: string, action: 'modifier' | 'supprimer') {
    const { data: m } = await db.from('missions')
      .select('id, status, created_by, partner_id').eq('id', missionId).maybeSingle();
    if (!m) return { ok: false as const, error: 'Mission introuvable.' };
    if (estAdmin) return { ok: true as const, mission: m };

    const estCreateur = m.created_by === session!.id || m.partner_id === session!.id;
    if (!estCreateur) return { ok: false as const, error: `Vous ne pouvez pas ${action} cette mission.` };
    // Une mission terminée ou annulée est close pour tout le monde sauf l'admin.
    if (m.status === 'done' || m.status === 'cancelled') {
      return { ok: false as const, error: 'Cette mission est terminée ou annulée.' };
    }
    return { ok: true as const, mission: m };
  }

  switch (b.action) {
    case 'delete': {
      if (!b.missionId) return refus('Mission manquante.', 400);
      const droit = await peutAgir(b.missionId, 'supprimer');
      if (!droit.ok) return refus(droit.error);

      let q = db.from('missions').delete().eq('id', b.missionId);
      // Garde atomique : hors admin, une mission close ne part pas, même si son
      // statut a changé entre la vérification et la suppression.
      if (!estAdmin) q = q.not('status', 'in', '(done,cancelled)');
      const { data, error } = await q.select('id');
      if (error) { console.error('missions/delete:', error.message); return refus('Suppression impossible.', 500); }
      if (!data || data.length === 0) return refus('Cette mission ne peut plus être supprimée.');
      return NextResponse.json({ ok: true });
    }

    case 'delete-recurring': {
      // Purge des occurrences à venir d'une récurrence modifiée. Réservée à
      // l'administration : elle touche plusieurs journées d'un coup.
      if (!estAdmin) return refus('Réservé à l’administration.');
      if (!b.recurringId) return refus('Récurrence manquante.', 400);
      const today = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(new Date());
      const { error } = await db.from('missions').delete()
        .eq('recurring_id', b.recurringId).gte('date_from', today).in('status', ['pending', 'assigned']);
      if (error) { console.error('missions/delete-recurring:', error.message); return refus('Suppression impossible.', 500); }
      return NextResponse.json({ ok: true });
    }

    case 'assign': {
      // Écrit la paie du cleaner : réservé à l'administration.
      if (!estAdmin) return refus('Réservé à l’administration.');
      const ids = b.missionIds?.length ? b.missionIds : (b.missionId ? [b.missionId] : []);
      if (ids.length === 0 || !b.cleanerId) return refus('Mission ou cleaner manquant.', 400);

      const { data: cleaner } = await db.from('cleaners')
        .select('hourly_rate, delivery_rate').eq('id', b.cleanerId).maybeSingle();
      if (!cleaner) return refus('Cleaner introuvable.', 404);
      const rate = Number(cleaner.hourly_rate) || 0;
      const deliveryRate = Number(cleaner.delivery_rate) || 0;

      for (const id of ids) {
        const { data: m } = await db.from('missions')
          .select('service, mission_duration_minutes, apartment_default_duration_snapshot, airbnbs(estimated_cleaning_minutes)')
          .eq('id', id).maybeSingle();
        if (!m) continue;

        const aptDefault = (m as { airbnbs?: { estimated_cleaning_minutes?: number } }).airbnbs?.estimated_cleaning_minutes
          ?? m.apartment_default_duration_snapshot ?? null;
        const minutes = m.mission_duration_minutes != null
          ? Number(m.mission_duration_minutes)
          : (aptDefault != null ? Number(aptDefault) : 60);

        const { error } = await db.from('missions').update({
          cleaner_id: b.cleanerId,
          cleaner_name: b.cleanerName ?? null,
          status: 'assigned',
          cleaner_gain: computeMissionGain({
            service: m.service as MissionService | undefined,
            hourlyRate: rate, deliveryRate, durationMinutes: minutes,
          }),
          cleaner_hourly_rate_snapshot: rate,
          mission_duration_minutes: minutes,
          apartment_default_duration_snapshot: aptDefault != null ? Number(aptDefault) : null,
          hours_worked: Math.round((minutes / 60) * 100) / 100,
        }).eq('id', id);
        if (error) { console.error('missions/assign:', error.message); return refus('Affectation impossible.', 500); }
      }
      return NextResponse.json({ ok: true, count: ids.length });
    }

    case 'unassign': {
      if (!estAdmin) return refus('Réservé à l’administration.');
      if (!b.missionId) return refus('Mission manquante.', 400);

      const { data: avant } = await db.from('missions')
        .select('cleaner_id, status').eq('id', b.missionId).maybeSingle();
      if (!avant?.cleaner_id) return refus('Aucun cleaner sur cette mission.', 400);
      if (avant.status === 'done' || avant.status === 'cancelled') {
        return refus('Mission déjà terminée ou annulée.', 400);
      }

      const { data, error } = await db.from('missions').update({
        status: 'pending', cleaner_id: null, cleaner_name: null,
        pending_cleaner_id: null, pending_cleaner_name: null, pending_requested_at: null,
      }).eq('id', b.missionId).not('status', 'in', '(done,cancelled)').select('id');
      if (error) { console.error('missions/unassign:', error.message); return refus('Retrait impossible.', 500); }
      if (!data || data.length === 0) return refus('Cette mission ne peut plus être modifiée.');
      // On rend l'ancien cleaner : il doit être prévenu, sinon il continue de
      // compter sur la mission et se déplace pour rien.
      return NextResponse.json({ ok: true, previousCleanerId: avant.cleaner_id });
    }

    default:
      return refus('Action inconnue.', 400);
  }
}
