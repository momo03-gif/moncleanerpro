import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

// Écriture de la configuration du simulateur de devis (zones, paliers, options,
// barème). Ces tables fixent les prix affichés au public : elles sont en lecture
// seule pour la clé publique, et toute modification passe ici, réservée à l'admin.

async function requireAdmin() {
  const session = await getSessionUser();
  if (!session || session.role !== 'admin') return null;
  return session;
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin()) {
    return NextResponse.json({ error: 'Réservé à l’administration.' }, { status: 403 });
  }

  let body: {
    action?: string;
    zone?: { id?: string; name?: string; fee?: number; communes?: string[]; color?: string | null; position?: number; active?: boolean };
    tier?: { id?: string; maxM2?: number; label?: string; capText?: string | null; basePrice?: number | null; priceMax?: number | null; capacityIncluded?: number | null; active?: boolean };
    option?: { id?: string; key?: string; label?: string; fee?: number; perCapacity?: boolean; tiers?: unknown; defaultOn?: boolean; active?: boolean };
    settings?: { extraGuestFee?: number; bathroomSurcharge?: unknown; urgency?: unknown; minM2?: number; maxM2?: number };
    id?: string;
  } = {};
  try { body = await req.json(); } catch { /* corps vide → refusé plus bas */ }

  const db = getSupabaseAdmin();

  try {
    switch (body.action) {
      // ── Zones tarifaires ────────────────────────────────────────────────
      case 'zone.save': {
        const z = body.zone;
        if (!z?.name?.trim()) return NextResponse.json({ error: 'Nom de zone requis.' }, { status: 400 });
        const row = {
          name: z.name.trim(),
          fee: Number(z.fee ?? 0),
          // Communes nettoyées : ni doublons, ni lignes vides, l'ordre de saisie conservé.
          communes: [...new Set((z.communes ?? []).map(c => c.trim()).filter(Boolean))],
          color: z.color || null,
          position: Number(z.position ?? 0),
          active: z.active !== false,
        };
        const { error } = z.id
          ? await db.from('devis_zones').update(row).eq('id', z.id)
          : await db.from('devis_zones').insert(row);
        if (error) throw error;
        break;
      }
      case 'zone.delete': {
        if (!body.id) return NextResponse.json({ error: 'Identifiant requis.' }, { status: 400 });
        const { error } = await db.from('devis_zones').delete().eq('id', body.id);
        if (error) throw error;
        break;
      }

      // ── Paliers de surface ──────────────────────────────────────────────
      case 'tier.save': {
        const t = body.tier;
        if (!t?.label?.trim() || !t.maxM2) {
          return NextResponse.json({ error: 'Libellé et surface maximale requis.' }, { status: 400 });
        }
        const row = {
          max_m2: Number(t.maxM2),
          label: t.label.trim(),
          cap_text: t.capText || null,
          base_price: t.basePrice == null ? null : Number(t.basePrice),
          // Borne haute de la fourchette. Vide = prix ferme.
          price_max: t.priceMax == null ? null : Number(t.priceMax),
          // Voyageurs compris dans ce prix. Vide = pas de supplément.
          capacity_included: t.capacityIncluded == null ? null : Number(t.capacityIncluded),
          active: t.active !== false,
        };
        const { error } = t.id
          ? await db.from('devis_surface_tiers').update(row).eq('id', t.id)
          : await db.from('devis_surface_tiers').insert(row);
        if (error) throw error;
        break;
      }
      case 'tier.delete': {
        if (!body.id) return NextResponse.json({ error: 'Identifiant requis.' }, { status: 400 });
        const { error } = await db.from('devis_surface_tiers').delete().eq('id', body.id);
        if (error) throw error;
        break;
      }

      // ── Options ─────────────────────────────────────────────────────────
      case 'option.save': {
        const o = body.option;
        if (!o?.label?.trim()) return NextResponse.json({ error: 'Libellé requis.' }, { status: 400 });
        const row = {
          label: o.label.trim(),
          fee: Number(o.fee ?? 0),
          per_capacity: o.perCapacity === true,
          tiers: o.tiers ?? null,
          default_on: o.defaultOn === true,
          active: o.active !== false,
        };
        if (o.id) {
          const { error } = await db.from('devis_options').update(row).eq('id', o.id);
          if (error) throw error;
        } else {
          // La clé est dérivée du libellé et doit rester unique. Deux options du
          // même nom lèveraient une violation de contrainte incompréhensible pour
          // l'utilisateur : on le lui dit dans ses mots.
          const key = (o.key || o.label).trim().toLowerCase()
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'option';
          const { error } = await db.from('devis_options').insert({ ...row, key });
          if (error) {
            if (error.code === '23505') {
              return NextResponse.json({ error: 'Une option porte déjà ce nom.' }, { status: 400 });
            }
            throw error;
          }
        }
        break;
      }
      case 'option.delete': {
        if (!body.id) return NextResponse.json({ error: 'Identifiant requis.' }, { status: 400 });
        const { error } = await db.from('devis_options').delete().eq('id', body.id);
        if (error) throw error;
        break;
      }

      // ── Barème général ──────────────────────────────────────────────────
      case 'settings.save': {
        const s = body.settings ?? {};
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (s.extraGuestFee !== undefined) patch.extra_guest_fee = Number(s.extraGuestFee);
        if (s.bathroomSurcharge !== undefined) patch.bathroom_surcharge = s.bathroomSurcharge;
        if (s.urgency !== undefined) patch.urgency = s.urgency;
        if (s.minM2 !== undefined) patch.min_m2 = Number(s.minM2);
        if (s.maxM2 !== undefined) patch.max_m2 = Number(s.maxM2);
        const { error } = await db.from('devis_settings').update(patch).eq('id', 1);
        if (error) throw error;
        break;
      }

      default:
        return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 });
    }
  } catch (e) {
    console.error('admin/devis-config:', (e as Error)?.message);
    return NextResponse.json({ error: 'Enregistrement impossible.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
