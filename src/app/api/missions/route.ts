import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { computeMissionGain, computeCleanerGain, billableHotelPrice } from '@/lib/pay';
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
    action?: 'delete' | 'assign' | 'unassign' | 'delete-recurring' | 'set-duration' | 'generate-recurring' | 'close-money' | 'reassign';
    missionId?: string; missionIds?: string[];
    cleanerId?: string; cleanerName?: string;
    fromCleanerId?: string; toCleanerId?: string; apercu?: boolean;
    recurringId?: string;
    minutes?: number;
    aptDefault?: number | null;
    price?: number;
    actualMinutes?: number;
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

    // ── Transférer toutes les missions à venir d'un intervenant ────────────
    //
    // Un cleaner est arrêté, part en congés, s'en va : reprendre ses vingt
    // missions une par une prend dix minutes, et se fait à 6h du matin.
    //
    // PÉRIMÈTRE (cf. lib/reassign.ts) : à venir ou aujourd'hui, et seulement
    // « en attente » ou « attribuée ». Une mission terminée reste à celui qui
    // l'a faite — elle est payée. Une mission en cours ne bouge pas : quelqu'un
    // est sur place. Le passé non fait relève d'une décision, pas d'un transfert.
    //
    // LE GAIN EST RECALCULÉ au taux du nouvel intervenant. Le recopier ferait
    // d'un transfert une erreur de paie silencieuse.
    case 'reassign': {
      if (!estAdmin) return refus('Réservé à l’administration.');
      if (!b.fromCleanerId) return refus('Intervenant de départ manquant.', 400);

      const aujourdhui = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(new Date());

      const { data: aBouger, error: errLecture } = await db.from('missions')
        .select('id, status, date_from, service, mission_duration_minutes, apartment_default_duration_snapshot, airbnbs(estimated_cleaning_minutes)')
        .eq('cleaner_id', b.fromCleanerId)
        .in('status', ['pending', 'assigned'])
        .gte('date_from', aujourdhui)
        .order('date_from');
      if (errLecture) { console.error('missions/reassign(read):', errLecture.message); return refus('Lecture impossible.', 500); }

      const lignes = aBouger ?? [];
      const dates = lignes.map(m => m.date_from as string).filter(Boolean);
      const apercu = { nombre: lignes.length, premiere: dates[0], derniere: dates[dates.length - 1] };

      // Un bouton qui déplace vingt missions sans dire combien ni jusqu'à quand
      // est un bouton qu'on n'ose pas cliquer.
      if (b.apercu) return NextResponse.json({ apercu });

      if (!b.toCleanerId) return refus('Intervenant qui reprend manquant.', 400);
      if (b.toCleanerId === b.fromCleanerId) return refus('C’est déjà le même intervenant.', 400);
      if (lignes.length === 0) return NextResponse.json({ ok: true, count: 0, apercu });

      const { data: cible } = await db.from('cleaners')
        .select('id, name, hourly_rate, delivery_rate, status').eq('id', b.toCleanerId).maybeSingle();
      if (!cible) return refus('Intervenant introuvable.', 404);
      if (cible.status !== 'active') return refus('Cet intervenant n’est pas actif.', 400);

      const rate = Number(cible.hourly_rate) || 0;
      const deliveryRate = Number(cible.delivery_rate) || 0;

      let count = 0;
      for (const m of lignes) {
        const aptDefault = (m as { airbnbs?: { estimated_cleaning_minutes?: number } }).airbnbs?.estimated_cleaning_minutes
          ?? m.apartment_default_duration_snapshot ?? null;
        const minutes = m.mission_duration_minutes != null
          ? Number(m.mission_duration_minutes)
          : (aptDefault != null ? Number(aptDefault) : 60);

        // Le filtre de statut est REJOUÉ à l'écriture : entre la lecture et
        // maintenant, le cleaner a pu démarrer une mission.
        const { data: maj, error } = await db.from('missions').update({
          cleaner_id: cible.id,
          cleaner_name: cible.name ?? null,
          status: 'assigned',
          cleaner_gain: computeMissionGain({
            service: m.service as MissionService | undefined,
            hourlyRate: rate, deliveryRate, durationMinutes: minutes,
          }),
          cleaner_hourly_rate_snapshot: rate,
          mission_duration_minutes: minutes,
          apartment_default_duration_snapshot: aptDefault != null ? Number(aptDefault) : null,
          hours_worked: Math.round((minutes / 60) * 100) / 100,
          // Une demande en attente portait sur l'ancien intervenant : elle n'a
          // plus d'objet.
          pending_cleaner_id: null, pending_cleaner_name: null, pending_requested_at: null,
        }).eq('id', m.id).in('status', ['pending', 'assigned']).select('id');
        if (error) { console.error('missions/reassign:', error.message); return refus('Transfert impossible.', 500); }
        if (maj && maj.length > 0) count++;
      }

      // Les deux intervenants doivent l'apprendre de nous, pas en ouvrant
      // l'application par hasard.
      if (count > 0) {
        const { notifyMissionsTransferees } = await import('@/lib/notifications');
        await notifyMissionsTransferees(b.fromCleanerId, cible.id, count, apercu.premiere, apercu.derniere);
      }
      return NextResponse.json({ ok: true, count, apercu });
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

    case 'set-duration': {
      // Changer la durée d'un ménage, c'est changer la PAIE du cleaner : le gain
      // est recalculé ici, à partir du taux en base. Utilisé par l'approbation
      // d'un temps supplémentaire, l'ajout de temps par l'admin et la validation
      // d'une demande — les trois derniers endroits où le navigateur écrivait
      // encore de l'argent.
      if (!estAdmin) return refus('Réservé à l’administration.');
      if (!b.missionId) return refus('Ménage manquant.', 400);
      if (typeof b.minutes !== 'number' && typeof b.price !== 'number') {
        return refus('Durée ou prix requis.', 400);
      }
      const minutes = typeof b.minutes === 'number' ? Math.max(0, Math.round(b.minutes)) : null;

      const { data: m } = await db.from('missions')
        .select('service, cleaner_id').eq('id', b.missionId).maybeSingle();
      if (!m) return refus('Mission introuvable.', 404);

      const patch: Record<string, unknown> = {};
      if (minutes != null) {
        patch.mission_duration_minutes = minutes;
        patch.hours_worked = Math.round((minutes / 60) * 100) / 100;
      }
      if (b.aptDefault != null) patch.apartment_default_duration_snapshot = b.aptDefault;
      // Le prix CLIENT (facturation) est lui aussi écrit ici : c'est de l'argent.
      if (typeof b.price === 'number') patch.price = Math.max(0, b.price);

      if (minutes != null && m.cleaner_id) {
        const { data: cleaner } = await db.from('cleaners')
          .select('hourly_rate, delivery_rate').eq('id', m.cleaner_id).maybeSingle();
        const rate = Number(cleaner?.hourly_rate) || 0;
        const deliveryRate = Number(cleaner?.delivery_rate) || 0;
        patch.cleaner_gain = computeMissionGain({
          service: m.service as MissionService | undefined,
          hourlyRate: rate, deliveryRate, durationMinutes: minutes,
        });
        patch.cleaner_hourly_rate_snapshot = rate;
      }

      const { error } = await db.from('missions').update(patch).eq('id', b.missionId);
      if (error) { console.error('missions/set-duration:', error.message); return refus('Enregistrement impossible.', 500); }
      return NextResponse.json({ ok: true, minutes });
    }

    case 'close-money': {
      // Fin de mission : pour un hôtel, la paie suit le TEMPS RÉEL pointé et la
      // facturation le MAX(temps accordé, temps réel). Deux calculs d'argent,
      // faits ici — le téléphone du cleaner ne les écrit plus. Autorisé au
      // cleaner assigné, puisque c'est lui qui clôture.
      if (!b.missionId || typeof b.actualMinutes !== 'number') return refus('Ménage ou durée manquant.', 400);

      const { data: m } = await db.from('missions')
        .select('source, service, price, mission_duration_minutes, cleaner_hourly_rate_snapshot, cleaner_id, cleaners!missions_cleaner_id_fkey(user_id)')
        .eq('id', b.missionId).maybeSingle();
      if (!m) return refus('Mission introuvable.', 404);

      const cleanerUserId = (m as { cleaners?: { user_id?: string } }).cleaners?.user_id ?? null;
      if (!estAdmin && cleanerUserId !== session.id) return refus('Ce ménage ne vous est pas attribué.');

      const mins = Math.max(0, Math.round(b.actualMinutes));
      const svc = (m.service ?? 'cleaning') as string;
      const planned = Number(m.mission_duration_minutes) || 0;
      const patch: Record<string, unknown> = {};

      const rate = Number(m.cleaner_hourly_rate_snapshot) || 0;
      if (m.source === 'hotel' && svc === 'cleaning' && rate > 0) {
        patch.cleaner_gain = computeCleanerGain(rate, mins);
      }
      const basePrice = Number(m.price) || 0;
      if (m.source === 'hotel' && planned > 0 && basePrice > 0) {
        patch.price = billableHotelPrice(basePrice, planned, mins);
      }
      if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true, rien: true });

      const { error } = await db.from('missions').update(patch).eq('id', b.missionId);
      if (error) { console.error('missions/close-money:', error.message); return refus('Enregistrement impossible.', 500); }
      return NextResponse.json({ ok: true });
    }

    case 'generate-recurring': {
      // La génération des missions récurrentes calcule elle aussi des gains : elle
      // tourne donc ici, en service_role, et plus dans le navigateur.
      if (!estAdmin) return refus('Réservé à l’administration.');
      const { generateRecurringMissions } = await import('@/lib/recurring');
      const res = await generateRecurringMissions();
      return NextResponse.json({ ok: true, created: res.created });
    }

    default:
      return refus('Action inconnue.', 400);
  }
}
