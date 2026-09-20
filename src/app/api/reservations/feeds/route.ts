import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { canManageFeed } from '@/lib/feedAccess';
import { normalizeIcalUrl } from '@/lib/icalUrl';

export const runtime = 'nodejs';

// ── Écritures sur les calendriers connectés ──────────────────────────────────
//
// POURQUOI UNE ROUTE : `reservation_feeds` porte les clés API des conciergeries.
// Une clé Hostify ouvre l'intégralité du compte de gestion du client — ses
// réservations, ses voyageurs, ses tarifs. Tant que la table était écrite depuis
// le navigateur, elle l'était avec la clé publique, celle que n'importe qui lit
// dans le code de la page.
//
// Désormais : le serveur écrit, après avoir vérifié la session signée ET que le
// logement appartient bien au demandeur. En base, les droits d'écriture du rôle
// public sont retirés (cf. supabase/migration_feeds_verrouillage.sql), et les
// colonnes secrètes ne sont plus lisibles depuis le navigateur.
//
// La connexion par clé API a sa propre route (/api/reservations/pms) : elle
// manipule les identifiants eux-mêmes et vérifiait déjà la session.

interface Body {
  action?: 'create' | 'update' | 'delete';
  feedId?: string;
  airbnbId?: string;
  platform?: string;
  icalUrl?: string;
  label?: string | null;
  active?: boolean;
}

const refus = (message: string, code = 403) => NextResponse.json({ error: message }, { status: code });

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return refus('Non authentifié.', 401);

  let b: Body = {};
  try { b = await req.json(); } catch { return refus('Requête invalide.', 400); }

  const db = getSupabaseAdmin();
  const actor = { id: session.id, role: session.role };

  /**
   * Le logement concerné. Pour une action sur un flux existant, on remonte au
   * logement PAR LE FLUX : l'appelant ne choisit pas le logement qu'il prétend
   * posséder.
   */
  async function apartmentOf(): Promise<{ id: string; partnerId: string | null } | null> {
    let airbnbId = b.airbnbId ?? null;
    if (!airbnbId && b.feedId) {
      const { data } = await db.from('reservation_feeds').select('airbnb_id').eq('id', b.feedId).maybeSingle();
      airbnbId = (data?.airbnb_id as string) ?? null;
    }
    if (!airbnbId) return null;
    const { data } = await db.from('airbnbs').select('id, partner_id').eq('id', airbnbId).maybeSingle();
    return data ? { id: data.id as string, partnerId: (data.partner_id as string) ?? null } : null;
  }

  const apt = await apartmentOf();
  if (!canManageFeed(actor, apt)) return refus('Ce logement ne vous appartient pas.');

  switch (b.action) {
    case 'create': {
      const url = normalizeIcalUrl(b.icalUrl ?? '');
      if (!url) return refus('Lien de calendrier requis.', 400);

      // Plusieurs calendriers par logement, oui — le même deux fois, non : les
      // réservations apparaîtraient en double dans le tableau du partenaire.
      const { data: deja } = await db.from('reservation_feeds')
        .select('id, ical_url').eq('airbnb_id', apt!.id);
      if ((deja ?? []).some(f => f.ical_url && normalizeIcalUrl(f.ical_url as string) === url)) {
        return refus('Ce calendrier est déjà connecté à ce logement.', 400);
      }

      const { error } = await db.from('reservation_feeds').insert({
        airbnb_id: apt!.id,
        partner_id: apt!.partnerId,
        platform: b.platform || 'ical',
        ical_url: url,
        label: b.label || null,
      });
      if (error) { console.error('feeds/create:', error.message); return refus('Enregistrement impossible.', 500); }
      return NextResponse.json({ ok: true });
    }

    case 'update': {
      if (!b.feedId) return refus('Calendrier manquant.', 400);
      const patch: Record<string, unknown> = {};
      if (b.platform !== undefined) patch.platform = b.platform;
      if (b.icalUrl !== undefined) patch.ical_url = normalizeIcalUrl(b.icalUrl);
      if (b.label !== undefined) patch.label = b.label || null;
      if (b.active !== undefined) patch.active = b.active;
      if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true });

      const { error } = await db.from('reservation_feeds').update(patch).eq('id', b.feedId);
      if (error) { console.error('feeds/update:', error.message); return refus('Enregistrement impossible.', 500); }
      return NextResponse.json({ ok: true });
    }

    case 'delete': {
      if (!b.feedId) return refus('Calendrier manquant.', 400);
      // Les réservations partent avec le flux (ON DELETE CASCADE) : sans lui,
      // elles ne seraient plus jamais mises à jour. Les ménages déjà créés, eux,
      // sont conservés.
      const { error } = await db.from('reservation_feeds').delete().eq('id', b.feedId);
      if (error) { console.error('feeds/delete:', error.message); return refus('Suppression impossible.', 500); }
      return NextResponse.json({ ok: true });
    }

    default:
      return refus('Action inconnue.', 400);
  }
}
