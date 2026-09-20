import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { canEditChecklist, canCheckChecklist } from '@/lib/checklistAccess';
import { STARTER_CHECKLIST } from '@/lib/checklistCompute';

export const runtime = 'nodejs';

// ── Écritures de checklist ───────────────────────────────────────────────────
//
// POURQUOI UNE ROUTE : `checklist_items` et `mission_checklist_checks` ont la
// RLS active. Le navigateur recevait « 42501 : new row violates row-level
// security policy » — le partenaire ne pouvait pas créer son standard, ni le
// cleaner cocher ses points. La checklist était cassée de bout en bout, sans
// message d'erreur visible à l'écran.
//
// On ne rouvre pas ces tables à la clé publique : le serveur écrit, après avoir
// vérifié l'identité (session signée) et le droit (checklistAccess.ts). Même
// schéma que les rendez-vous, le parking et les prospects.
//
// La LECTURE reste côté client : elle fonctionne, et elle n'expose rien qu'un
// partenaire ou un cleaner ne doive déjà voir.

type Action =
  | 'add' | 'update' | 'archive' | 'reorder' | 'seed'
  | 'check' | 'uncheck';

interface Body {
  action?: Action;
  airbnbId?: string;
  missionId?: string;
  itemId?: string;
  ids?: string[];
  label?: string;
  room?: string | null;
  required?: boolean;
  position?: number;
  referencePhotoUrl?: string | null;
  labelSnapshot?: string;
  authorName?: string;
}

const refus = (message: string, code = 403) => NextResponse.json({ error: message }, { status: code });

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return refus('Non authentifié.', 401);

  let b: Body = {};
  try { b = await req.json(); } catch { return refus('Requête invalide.', 400); }
  const db = getSupabaseAdmin();
  const actor = { id: session.id, role: session.role };

  // ── Le logement concerné, pour les actions sur le standard ─────────────────
  // Pour une action portant sur un point existant, on remonte au logement via le
  // point lui-même : l'appelant n'a pas à nous dire de quel logement il s'agit,
  // et ne peut donc pas le prétendre.
  async function apartmentOf(): Promise<{ id: string; partnerId: string | null } | null> {
    let airbnbId = b.airbnbId ?? null;
    if (!airbnbId && b.itemId) {
      const { data } = await db.from('checklist_items').select('airbnb_id').eq('id', b.itemId).maybeSingle();
      airbnbId = (data?.airbnb_id as string) ?? null;
    }
    if (!airbnbId) return null;
    const { data } = await db.from('airbnbs').select('id, partner_id').eq('id', airbnbId).maybeSingle();
    return data ? { id: data.id as string, partnerId: (data.partner_id as string) ?? null } : null;
  }

  async function ensureCanEdit() {
    const apt = await apartmentOf();
    if (!canEditChecklist(actor, apt)) return null;
    return apt;
  }

  switch (b.action) {
    // ── Le standard du logement ──────────────────────────────────────────────
    case 'add': {
      const apt = await ensureCanEdit();
      if (!apt) return refus('Ce logement ne vous appartient pas.');
      const label = (b.label ?? '').trim();
      if (!label) return refus('Intitulé requis.', 400);

      const { data: last } = await db.from('checklist_items').select('position')
        .eq('airbnb_id', apt.id).is('archived_at', null)
        .order('position', { ascending: false }).limit(1).maybeSingle();

      const { data, error } = await db.from('checklist_items').insert({
        airbnb_id: apt.id,
        label,
        room: b.room?.trim() || null,
        required: b.required !== false,
        position: ((last?.position as number) ?? -1) + 1,
        created_by: b.authorName ?? session.name ?? null,
      }).select('*').single();
      if (error) { console.error('checklist/add:', error.message); return refus('Enregistrement impossible.', 500); }
      return NextResponse.json({ ok: true, item: data });
    }

    case 'update': {
      if (!b.itemId) return refus('Point manquant.', 400);
      const apt = await ensureCanEdit();
      if (!apt) return refus('Ce point ne vous appartient pas.');

      const patch: Record<string, unknown> = {};
      if (b.referencePhotoUrl !== undefined) patch.reference_photo_url = b.referencePhotoUrl || null;
      if (b.label !== undefined) {
        const label = b.label.trim();
        if (!label) return refus('Intitulé requis.', 400);
        patch.label = label;
      }
      if (b.room !== undefined) patch.room = b.room?.trim() || null;
      if (b.required !== undefined) patch.required = b.required;
      if (b.position !== undefined) patch.position = b.position;
      if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true });

      const { error } = await db.from('checklist_items').update(patch).eq('id', b.itemId);
      if (error) { console.error('checklist/update:', error.message); return refus('Enregistrement impossible.', 500); }
      return NextResponse.json({ ok: true });
    }

    case 'archive': {
      if (!b.itemId) return refus('Point manquant.', 400);
      const apt = await ensureCanEdit();
      if (!apt) return refus('Ce point ne vous appartient pas.');
      // On archive, on ne supprime pas : les ménages passés gardent la preuve de
      // ce qui avait été demandé (la suppression casserait leurs coches).
      const { error } = await db.from('checklist_items')
        .update({ archived_at: new Date().toISOString() }).eq('id', b.itemId);
      if (error) { console.error('checklist/archive:', error.message); return refus('Suppression impossible.', 500); }
      return NextResponse.json({ ok: true });
    }

    case 'reorder': {
      const ids = b.ids ?? [];
      if (ids.length === 0) return NextResponse.json({ ok: true });
      // Tous les points doivent appartenir au MÊME logement, et ce logement doit
      // être le vôtre : sinon on pourrait réordonner le standard du voisin.
      const { data: rows } = await db.from('checklist_items').select('id, airbnb_id').in('id', ids);
      const aptIds = new Set((rows ?? []).map(r => r.airbnb_id as string));
      if (aptIds.size !== 1 || (rows ?? []).length !== ids.length) return refus('Points incohérents.', 400);
      const { data: apt } = await db.from('airbnbs').select('id, partner_id').eq('id', [...aptIds][0]).maybeSingle();
      if (!canEditChecklist(actor, apt ? { partnerId: (apt.partner_id as string) ?? null } : null)) {
        return refus('Ce logement ne vous appartient pas.');
      }
      for (let i = 0; i < ids.length; i++) {
        const { error } = await db.from('checklist_items').update({ position: i }).eq('id', ids[i]);
        if (error) { console.error('checklist/reorder:', error.message); return refus('Réordonnancement impossible.', 500); }
      }
      return NextResponse.json({ ok: true });
    }

    case 'seed': {
      const apt = await ensureCanEdit();
      if (!apt) return refus('Ce logement ne vous appartient pas.');
      const { data: existing } = await db.from('checklist_items')
        .select('id').eq('airbnb_id', apt.id).is('archived_at', null).limit(1);
      if (existing && existing.length > 0) return refus('Ce logement a déjà une checklist.', 400);

      const { error } = await db.from('checklist_items').insert(
        STARTER_CHECKLIST.map((it, i) => ({
          airbnb_id: apt.id,
          label: it.label,
          room: it.room,
          required: it.required !== false,
          position: i,
          created_by: b.authorName ?? session.name ?? null,
        })),
      );
      if (error) { console.error('checklist/seed:', error.message); return refus('Installation impossible.', 500); }
      return NextResponse.json({ ok: true });
    }

    // ── L'exécution sur un ménage ────────────────────────────────────────────
    case 'check':
    case 'uncheck': {
      if (!b.missionId || !b.itemId) return refus('Ménage ou point manquant.', 400);

      // Le cleaner assigné : missions.cleaner_id désigne cleaners.id, alors que
      // la session porte users.id — d'où la traduction.
      const { data: mission } = await db.from('missions')
        .select('id, cleaner_id, cleaners(user_id)').eq('id', b.missionId).maybeSingle();
      const cleanerUserId = (mission as { cleaners?: { user_id?: string } } | null)?.cleaners?.user_id ?? null;
      if (!canCheckChecklist(actor, mission ? { cleanerUserId } : null)) {
        return refus('Ce ménage ne vous est pas attribué.');
      }

      if (b.action === 'uncheck') {
        const { error } = await db.from('mission_checklist_checks')
          .delete().eq('mission_id', b.missionId).eq('item_id', b.itemId);
        if (error) { console.error('checklist/uncheck:', error.message); return refus('Impossible de décocher.', 500); }
        return NextResponse.json({ ok: true });
      }

      const { error } = await db.from('mission_checklist_checks').upsert({
        mission_id: b.missionId,
        item_id: b.itemId,
        label_snapshot: b.labelSnapshot ?? '',
        checked_at: new Date().toISOString(),
        checked_by: b.authorName ?? session.name ?? null,
      }, { onConflict: 'mission_id,item_id' });
      if (error) { console.error('checklist/check:', error.message); return refus('Impossible de cocher.', 500); }
      return NextResponse.json({ ok: true });
    }

    default:
      return refus('Action inconnue.', 400);
  }
}
