// ── /api/partners ────────────────────────────────────────────────────────────
// Comptes Hôtels / Conciergeries (Airbnb) + demandes hôtel — données PII des
// clients/partenaires. Déplacées côté serveur : la clé publique ne doit plus les
// lire/écrire (tables verrouillées RLS). Exécuté en service_role, identité via la
// session signée (jamais le corps de requête).
//
//   • Ops ADMIN : listes/validations/refus, taux hôtel, stats, demandes.
//   • Ops SELF  : un hôtel/partenaire ne lit/écrit que SES propres données.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionUser } from '@/lib/session';
import { computeCleanerGain } from '@/lib/pay';
import { notifyPartnerCreatedMission, notifyCleanerNewMission, notifyHotelRequestDecision } from '@/lib/notifications';
import type { HotelAnnounce, AnnounceStatus } from '@/lib/types';
import type { SupabaseClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const trimTime = (t?: string | null) => (t ?? '').substring(0, 5);

function rowToAnnounce(row: any): HotelAnnounce {
  return {
    id: row.id,
    hotelId: row.hotel_id,
    hotelName: row.hotel_name ?? '',
    type: row.type_prestation as any,
    date: row.date_from ?? '',
    dateEnd: row.date_to ?? undefined,
    timeStart: trimTime(row.time_from),
    timeEnd: trimTime(row.time_to),
    guestCount: row.persons ?? 1,
    instructions: row.instructions ?? undefined,
    status: row.status as AnnounceStatus,
    cleanerId: row.cleaner_id ?? undefined,
    cleanerName: row.cleaner_name ?? undefined,
  };
}

// Minutes entre deux heures 'HH:mm[:ss]' (>= 0).
function minutesBetween(from?: string | null, to?: string | null): number {
  const toMin = (t?: string | null) => { const [h, m] = (t ?? '').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
  const d = toMin(to) - toMin(from);
  return d > 0 ? d : 0;
}

// Liste des dates 'YYYY-MM-DD' de `from` à `to` inclus (garde-fou 60 jours max).
function eachDate(from: string, to?: string | null): string[] {
  if (!from) return [];
  const start = new Date(from + 'T00:00:00Z');
  const end = new Date(((to || from) + 'T00:00:00Z'));
  if (isNaN(start.getTime())) return [from];
  const out: string[] = [];
  for (let cur = start, i = 0; cur <= end && i < 60; cur = new Date(cur.getTime() + 86400000), i++) {
    out.push(cur.toISOString().slice(0, 10));
  }
  return out.length > 0 ? out : [from];
}

// L'hôtel/partenaire ne lit/écrit que SA fiche : on vérifie que le hotelId appartient
// bien à l'utilisateur de la session (admin : accès total).
async function ownsHotel(db: SupabaseClient, hotelId: string, sessionUserId: string): Promise<boolean> {
  if (!hotelId) return false;
  const { data } = await db.from('hotels').select('user_id').eq('id', hotelId).single();
  return !!data && data.user_id === sessionUserId;
}

// Statut EFFECTIF d'une demande hôtel, dérivé de ses missions liées
// (colonne missions.request_id). Une demande « acceptée » (validated) passe à
// « en cours » dès qu'une mission démarre, et à « terminée » quand TOUTES ses
// missions sont terminées. Mute `row.status` sur place. Robuste : si la colonne
// request_id n'existe pas encore (migration non lancée) ou s'il n'y a pas de
// mission liée, on conserve le statut stocké.
async function applyEffectiveStatus(db: SupabaseClient, rows: { id: string; status: string }[]): Promise<void> {
  const validatedIds = rows.filter(r => r.status === 'validated').map(r => r.id);
  if (validatedIds.length === 0) return;
  const { data: ms, error } = await db.from('missions').select('request_id, status').in('request_id', validatedIds);
  if (error || !ms || ms.length === 0) return;
  // NB : la table missions stocke les statuts en valeurs BRUTES ('inprogress',
  // 'done'…) — PAS les valeurs applicatives ('in_progress'/'completed').
  const agg = new Map<string, { total: number; done: number; active: number }>();
  for (const m of ms as { request_id: string | null; status: string }[]) {
    if (!m.request_id) continue;
    const g = agg.get(m.request_id) ?? { total: 0, done: 0, active: 0 };
    g.total++;
    if (m.status === 'done') g.done++;
    if (m.status === 'inprogress' || m.status === 'done') g.active++;
    agg.set(m.request_id, g);
  }
  for (const r of rows) {
    if (r.status !== 'validated') continue;
    const g = agg.get(r.id);
    if (!g || g.total === 0) continue;
    if (g.done === g.total) r.status = 'completed';
    else if (g.active > 0) r.status = 'in_progress';
  }
}

export async function GET(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  const isAdmin = session.role === 'admin';
  const url = new URL(req.url);
  const op = url.searchParams.get('op');
  const db = getSupabaseAdmin();

  const adminOnly = () => NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });

  switch (op) {
    case 'pendingHotels': {
      if (!isAdmin) return adminOnly();
      const { data } = await db.from('hotels').select('*, users(name, email, phone)').eq('status_account', 'pending');
      return NextResponse.json({ hotels: (data ?? []).map((h: any) => ({
        id: h.id, name: h.hotel_name, address: h.address,
        email: h.email ?? h.users?.email, phone: h.phone ?? h.users?.phone, userId: h.user_id,
      })) });
    }
    case 'approvedHotels': {
      if (!isAdmin) return adminOnly();
      const { data } = await db.from('hotels').select('*').eq('status_account', 'approved').order('hotel_name');
      return NextResponse.json({ hotels: data ?? [] });
    }
    case 'partnerAccounts': {
      // Fiches d'administration : tous les comptes partenaires actifs (validés)
      // ET suspendus — l'admin doit voir les suspendus pour les réactiver.
      if (!isAdmin) return adminOnly();
      const [{ data: hotels }, { data: partners }] = await Promise.all([
        db.from('hotels')
          .select('id, user_id, hotel_name, address, email, phone, status_account, users(email, phone)')
          .in('status_account', ['approved', 'suspended']).order('hotel_name'),
        db.from('airbnb_partners')
          .select('id, user_id, partner_name, email, phone, status_account, users(email, phone)')
          .in('status_account', ['approved', 'suspended']).order('partner_name'),
      ]);
      const accounts = [
        ...(hotels ?? []).map((h: any) => ({
          id: h.id, userId: h.user_id, kind: 'hotel' as const, name: h.hotel_name,
          email: h.email ?? h.users?.email ?? '', phone: h.phone ?? h.users?.phone ?? '',
          address: h.address ?? '', status: h.status_account,
        })),
        ...(partners ?? []).map((p: any) => ({
          id: p.id, userId: p.user_id, kind: 'airbnb' as const, name: p.partner_name,
          email: p.email ?? p.users?.email ?? '', phone: p.phone ?? p.users?.phone ?? '',
          address: '', status: p.status_account,
        })),
      ];
      return NextResponse.json({ accounts });
    }
    case 'hotelByUser': {
      const userId = url.searchParams.get('userId') ?? '';
      if (!isAdmin && userId !== session.id) return adminOnly();
      const { data } = await db.from('hotels').select('*').eq('user_id', userId).single();
      return NextResponse.json({ hotel: data ?? null });
    }
    case 'pendingAirbnbPartners': {
      if (!isAdmin) return adminOnly();
      const { data } = await db.from('airbnb_partners').select('*, users(name, email, phone)').eq('status_account', 'pending');
      return NextResponse.json({ partners: (data ?? []).map((p: any) => ({
        id: p.id, name: p.partner_name, email: p.email ?? p.users?.email,
        phone: p.phone ?? p.users?.phone, userId: p.user_id, partnerKind: 'airbnb' as const,
      })) });
    }
    case 'airbnbPartnerByUser': {
      const userId = url.searchParams.get('userId') ?? '';
      if (!isAdmin && userId !== session.id) return adminOnly();
      const { data } = await db.from('airbnb_partners').select('*').eq('user_id', userId).single();
      return NextResponse.json({ partner: data ?? null });
    }
    case 'partnerNames': {
      if (!isAdmin) return adminOnly();
      const [{ data: partners }, { data: apts }] = await Promise.all([
        db.from('airbnb_partners').select('partner_name').eq('status_account', 'approved'),
        db.from('airbnbs').select('partner_name'),
      ]);
      const names = new Set<string>();
      (partners ?? []).forEach((p: any) => p.partner_name && names.add(p.partner_name));
      (apts ?? []).forEach((a: any) => a.partner_name && names.add(a.partner_name));
      return NextResponse.json({ names: Array.from(names).sort() });
    }
    case 'stats': {
      if (!isAdmin) return adminOnly();
      const [{ data: missions }, { data: cleaners }, { data: hotels }] = await Promise.all([
        db.from('missions').select('*'),
        db.from('cleaners').select('*'),
        db.from('hotels').select('status_account'),
      ]);
      const completed = (missions ?? []).filter((m: any) => m.status === 'done');
      const totalRevenue = completed.reduce((s: number, m: any) => s + (m.price ?? 0), 0);
      const totalSalaries = completed.reduce((s: number, m: any) => s + (m.cleaner_gain ?? 0), 0);
      return NextResponse.json({ stats: {
        totalMissions: (missions ?? []).length,
        completedMissions: completed.length,
        totalRevenue, totalSalaries, netProfit: totalRevenue - totalSalaries,
        activeCleaners: (cleaners ?? []).filter((c: any) => c.status === 'active').length,
        approvedHotels: (hotels ?? []).filter((h: any) => h.status_account === 'approved').length,
      } });
    }
    case 'hotelRequests': {
      if (!isAdmin) return adminOnly();
      const { data } = await db.from('hotel_requests').select('*').order('created_at', { ascending: false });
      const rows = data ?? [];
      await applyEffectiveStatus(db, rows);
      return NextResponse.json({ requests: rows.map(rowToAnnounce) });
    }
    case 'hotelRequestsForHotel': {
      const hotelId = url.searchParams.get('hotelId') ?? '';
      if (!isAdmin && !(await ownsHotel(db, hotelId, session.id))) return adminOnly();
      const { data } = await db.from('hotel_requests').select('*').eq('hotel_id', hotelId).order('created_at', { ascending: false });
      const rows = data ?? [];
      await applyEffectiveStatus(db, rows);
      return NextResponse.json({ requests: rows.map(rowToAnnounce) });
    }
    default:
      return NextResponse.json({ error: 'Opération inconnue.' }, { status: 400 });
  }
}

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  const isAdmin = session.role === 'admin';
  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 }); }
  const db = getSupabaseAdmin();

  const adminOnly = () => NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });

  try {
    switch (b.op) {
      case 'refuseHotel': {
        if (!isAdmin) return adminOnly();
        await db.from('hotels').update({ status_account: 'refused' }).eq('id', b.id);
        return NextResponse.json({ ok: true });
      }
      case 'updateHotelRate': {
        if (!isAdmin) return adminOnly();
        await db.from('hotels').update({ billing_hourly_rate: b.rate }).eq('id', b.hotelId);
        return NextResponse.json({ ok: true });
      }
      case 'updateHotelClientType': {
        if (!isAdmin) return adminOnly();
        const clientType = b.clientType === 'ehpad' ? 'ehpad' : 'hotel';
        const { error } = await db.from('hotels').update({ client_type: clientType }).eq('id', b.hotelId);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true });
      }
      case 'refuseAirbnbPartner': {
        if (!isAdmin) return adminOnly();
        await db.from('airbnb_partners').update({ status_account: 'refused' }).eq('id', b.id);
        return NextResponse.json({ ok: true });
      }
      case 'createHotelRequest': {
        // Un hôtel ne crée une demande QUE pour sa propre fiche.
        if (!isAdmin && !(await ownsHotel(db, b.hotelId, session.id))) return adminOnly();
        const { error } = await db.from('hotel_requests').insert({
          hotel_id: b.hotelId, hotel_name: b.hotelName, type_prestation: b.type,
          date_from: b.dateFrom, date_to: b.dateTo, time_from: b.timeFrom, time_to: b.timeTo,
          persons: b.persons, instructions: b.instructions || null, status: 'pending',
        });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        await notifyPartnerCreatedMission(b.hotelName, b.dateFrom, b.timeFrom, null);
        return NextResponse.json({ ok: true });
      }
      case 'refuseRequest': {
        if (!isAdmin) return adminOnly();
        const { data: req } = await db.from('hotel_requests').select('hotel_id, type_prestation, date_from').eq('id', b.id).single();
        await db.from('hotel_requests').update({ status: 'refused' }).eq('id', b.id);
        if (req) {
          const { data: hotel } = await db.from('hotels').select('user_id').eq('id', req.hotel_id).single();
          await notifyHotelRequestDecision(hotel?.user_id ?? '', false, req.type_prestation, req.date_from);
        }
        return NextResponse.json({ ok: true });
      }
      case 'cancelHotelRequest': {
        // L'hôtel annule SA demande, et uniquement tant qu'elle est en attente
        // (une fois acceptée/en cours, il doit contacter l'équipe). L'admin peut
        // toujours annuler.
        const { data: req } = await db.from('hotel_requests').select('hotel_id, status').eq('id', b.id).single();
        if (!req) return NextResponse.json({ error: 'Demande introuvable.' }, { status: 404 });
        if (!isAdmin && !(await ownsHotel(db, req.hotel_id, session.id))) return adminOnly();
        if (req.status !== 'pending') {
          return NextResponse.json({ error: 'Seule une demande en attente peut être annulée.' }, { status: 400 });
        }
        await db.from('hotel_requests').update({ status: 'cancelled' }).eq('id', b.id);
        return NextResponse.json({ ok: true });
      }
      case 'validateRequest': {
        if (!isAdmin) return adminOnly();
        const { data: req } = await db.from('hotel_requests').select('*').eq('id', b.id).single();
        await db.from('hotel_requests').update({
          status: 'validated', cleaner_id: b.cleanerId, cleaner_name: b.cleanerName,
        }).eq('id', b.id);

        if (req) {
          // Durée = heures de l'annonce (time_from→time_to), override admin, sinon 120 min.
          const minutes = b.durationMinutesOverride && b.durationMinutesOverride > 0
            ? b.durationMinutesOverride
            : (minutesBetween(req.time_from, req.time_to) || 120);
          // Gain cleaner = taux horaire × durée / 60.
          const { data: cleaner } = await db.from('cleaners').select('hourly_rate').eq('id', b.cleanerId).single();
          const rate = Number(cleaner?.hourly_rate) || 0;
          const gain = computeCleanerGain(rate, minutes);
          // Prix client = taux horaire FACTURÉ de l'hôtel × heures.
          const { data: hotel } = await db.from('hotels').select('user_id, billing_hourly_rate').eq('id', req.hotel_id).single();
          const hotelRate = Number(hotel?.billing_hourly_rate) || 0;
          const price = Math.round(hotelRate * (minutes / 60) * 100) / 100;

          const baseRow = {
            type: req.type_prestation ?? 'regular', source: 'hotel',
            created_by: hotel?.user_id ?? null, created_by_role: 'hotel',
            property_name: req.hotel_name ?? '', address: '',
            time_from: req.time_from || null, time_to: req.time_to || null,
            hours_worked: minutes / 60, mission_duration_minutes: minutes,
            cleaner_id: b.cleanerId, cleaner_name: b.cleanerName, client_name: req.hotel_name ?? '',
            price, cleaner_gain: gain, cleaner_hourly_rate_snapshot: rate,
            instructions: req.instructions ?? null, status: 'assigned',
          };
          const rows = eachDate(req.date_from, req.date_to).map(d => ({ ...baseRow, date_from: d }));
          const { data: created, error } = await db.from('missions').insert(rows).select('id');
          if (error) console.error('validateRequest - mission insert error:', error);
          else if (created && created.length > 0) {
            await notifyCleanerNewMission(created[0].id);
            // Lier les missions à la demande pour un suivi de statut fiable.
            // Best-effort : sans effet si la colonne request_id n'existe pas encore
            // (le statut effectif retombe alors sur le statut stocké).
            await db.from('missions').update({ request_id: b.id }).in('id', created.map((m: { id: string }) => m.id));
          }
          // Prévenir l'hôtel que sa demande a été acceptée.
          await notifyHotelRequestDecision(hotel?.user_id ?? '', true, req.type_prestation, req.date_from);
        }
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: 'Opération inconnue.' }, { status: 400 });
    }
  } catch (e: any) {
    console.error('api/partners error:', b?.op, e?.message);
    return NextResponse.json({ error: e?.message ?? 'Erreur serveur.' }, { status: 500 });
  }
}
