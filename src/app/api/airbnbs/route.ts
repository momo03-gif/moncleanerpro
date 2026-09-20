import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { exigerSession } from '@/lib/apiGuard';

export const runtime = 'nodejs';

// ── Fiches logement : écritures par le serveur ───────────────────────────────
//
// CE QUE CETTE TABLE CONTIENT : l'adresse exacte de chaque logement, le code du
// portail, celui de la boîte à clés, les directives d'entrée, et depuis peu le
// contact de secours. Autrement dit, de quoi entrer chez les clients de nos
// clients. Écrite depuis le navigateur, elle l'était avec la clé publique.
//
// La lecture reste côté client pour l'instant : les écrans du cleaner, du
// partenaire et de l'admin s'en servent en permanence, et la restreindre demande
// de déplacer une douzaine de requêtes. C'est la passe suivante — mais fermer
// l'écriture empêche déjà qu'on modifie une adresse ou un code à distance.

const refus = (message: string, code = 403) => NextResponse.json({ error: message }, { status: code });

export async function POST(req: NextRequest) {
  const { refus: sansSession, appelant } = await exigerSession();
  if (sansSession) return sansSession;

  let b: {
    action?: 'create' | 'update' | 'delete' | 'assign-cleaner' | 'set-coords' | 'set-zones' | 'access';
    id?: string;
    row?: Record<string, unknown>;
    patch?: Record<string, unknown>;
    cleanerId?: string | null;
    lat?: number; lng?: number;
    zones?: { id: string; zoneId: string | null; zoneColor: string | null; zoneName: string | null }[];
    ids?: string[];
  } = {};
  try { b = await req.json(); } catch { return refus('Requête invalide.', 400); }

  const db = getSupabaseAdmin();
  const estAdmin = appelant!.role === 'admin';

  /** Un partenaire n'agit que sur SES logements ; l'admin partout. */
  async function autorise(id: string): Promise<boolean> {
    if (estAdmin) return true;
    const { data } = await db.from('airbnbs').select('partner_id').eq('id', id).maybeSingle();
    return !!data?.partner_id && data.partner_id === appelant!.id;
  }

  // Colonnes qu'un partenaire ne fixe jamais lui-même : elles nous sont propres
  // (prix facturé, temps de ménage qui détermine la paie, coût produits, zone,
  // rattachement). Un formulaire partenaire ne les envoie pas ; on s'assure ici
  // qu'une requête forgée ne le fasse pas non plus.
  const RESERVE_ADMIN = [
    'client_price', 'estimated_cleaning_minutes', 'product_cost_cents',
    'zone_id', 'zone_color', 'zone_name', 'partner_id', 'partner_name',
    'parent_airbnb_id', 'group_tiers', 'cleaner_id',
  ];
  function filtrer(champs: Record<string, unknown>): Record<string, unknown> {
    if (estAdmin) return champs;
    const out = { ...champs };
    for (const c of RESERVE_ADMIN) delete out[c];
    return out;
  }

  switch (b.action) {
    case 'create': {
      const row = filtrer(b.row ?? {});
      // Un partenaire crée toujours POUR LUI : on impose le rattachement.
      if (!estAdmin) row.partner_id = appelant!.id;
      if (!row.name || !row.address) return refus('Nom et adresse requis.', 400);

      const { data, error } = await db.from('airbnbs').insert(row).select('id').single();
      if (error) { console.error('airbnbs/create:', error.message); return refus('Enregistrement impossible.', 500); }
      return NextResponse.json({ ok: true, id: data?.id ?? null });
    }

    case 'update': {
      if (!b.id) return refus('Logement manquant.', 400);
      if (!(await autorise(b.id))) return refus('Ce logement ne vous appartient pas.');
      const patch = filtrer(b.patch ?? {});
      if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true });

      const { error } = await db.from('airbnbs').update(patch).eq('id', b.id);
      if (error) { console.error('airbnbs/update:', error.message); return refus('Enregistrement impossible.', 500); }
      return NextResponse.json({ ok: true });
    }

    case 'delete': {
      // Supprimer un logement emporte ses calendriers et ses réservations
      // (ON DELETE CASCADE) : réservé à l'administration.
      if (!estAdmin) return refus('Réservé à l’administration.');
      if (!b.id) return refus('Logement manquant.', 400);
      const { error } = await db.from('airbnbs').delete().eq('id', b.id);
      if (error) { console.error('airbnbs/delete:', error.message); return refus('Suppression impossible.', 500); }
      return NextResponse.json({ ok: true });
    }

    case 'assign-cleaner': {
      if (!estAdmin) return refus('Réservé à l’administration.');
      if (!b.id) return refus('Logement manquant.', 400);
      const { error } = await db.from('airbnbs').update({ cleaner_id: b.cleanerId ?? null }).eq('id', b.id);
      if (error) { console.error('airbnbs/assign:', error.message); return refus('Affectation impossible.', 500); }
      return NextResponse.json({ ok: true });
    }

    case 'set-coords': {
      if (!b.id) return refus('Logement manquant.', 400);
      if (!(await autorise(b.id))) return refus('Ce logement ne vous appartient pas.');
      if (typeof b.lat !== 'number' || typeof b.lng !== 'number') return refus('Coordonnées invalides.', 400);
      const { error } = await db.from('airbnbs')
        .update({ latitude: b.lat, longitude: b.lng }).eq('id', b.id);
      if (error) { console.error('airbnbs/coords:', error.message); return refus('Enregistrement impossible.', 500); }
      return NextResponse.json({ ok: true });
    }

    case 'set-zones': {
      // Recalcul des zones : le regroupement est calculé côté client (clustering
      // géographique), mais l'écriture est une opération d'administration.
      if (!estAdmin) return refus('Réservé à l’administration.');
      const zones = (b.zones ?? []) as { id: string; zoneId: string | null; zoneColor: string | null; zoneName: string | null }[];
      for (const z of zones) {
        const { error } = await db.from('airbnbs').update({
          zone_id: z.zoneId, zone_color: z.zoneColor, zone_name: z.zoneName,
        }).eq('id', z.id);
        if (error) { console.error('airbnbs/set-zones:', error.message); return refus('Enregistrement impossible.', 500); }
      }
      return NextResponse.json({ ok: true, count: zones.length });
    }

    case 'access': {
      // Les champs d'ACCÈS d'une fiche logement : code du portail, code de la
      // boîte à clés, directives d'entrée, notes, contact de secours. Ils ne
      // sont plus lisibles avec la clé publique ; ici, on ne rend que les
      // logements du demandeur — tous pour l'admin, les siens pour un partenaire.
      let q = db.from('airbnbs').select(
        'id, code_portail, code_boite, entry_instructions, notes, on_site_contact_name, on_site_contact_phone',
      );
      if (!estAdmin) q = q.eq('partner_id', appelant!.id);
      if (b.ids?.length) q = q.in('id', b.ids.slice(0, 500));

      const { data, error } = await q;
      if (error) { console.error('airbnbs/access:', error.message); return refus('Lecture impossible.', 500); }

      const acces: Record<string, Record<string, string | undefined>> = {};
      for (const r of data ?? []) {
        const row = r as Record<string, string | null>;
        acces[row.id as string] = {
          portalCode: row.code_portail || undefined,
          keyboxCode: row.code_boite || undefined,
          entryDirectives: row.entry_instructions || undefined,
          notes: row.notes || undefined,
          onSiteContactName: row.on_site_contact_name || undefined,
          onSiteContactPhone: row.on_site_contact_phone || undefined,
        };
      }
      return NextResponse.json({ acces });
    }

    default:
      return refus('Action inconnue.', 400);
  }
}
