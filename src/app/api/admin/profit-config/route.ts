// ── /api/admin/profit-config — les paramètres de marge de l'entreprise ──────
//
//  CE QUE CETTE TABLE CONTIENT : le coût des produits, la marge visée, le taux
//  de charges d'un CDI, le prix et le COÛT d'un kit de linge. Autrement dit, de
//  quoi reconstituer ce que l'entreprise gagne sur chaque ménage.
//
//  Elle se lisait et s'écrivait avec la clé publique, celle qui part dans le
//  navigateur : n'importe qui pouvait lire la marge, et la modifier. Tout passe
//  désormais par ici, après vérification de la session admin, ce qui permet de
//  fermer complètement `profit_config` à la clé publique.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { exigerAdmin } from '@/lib/apiGuard';

export const runtime = 'nodejs';

export async function GET() {
  const { refus } = await exigerAdmin();
  if (refus) return refus;

  const db = getSupabaseAdmin();
  const { data } = await db.from('profit_config').select('*').eq('id', 1).maybeSingle();
  return NextResponse.json({ config: data ?? null });
}

export async function POST(req: Request) {
  const { refus } = await exigerAdmin();
  if (refus) return refus;

  let b: Record<string, unknown> = {};
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 }); }

  const nombre = (v: unknown, defaut = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : defaut;
  };

  const db = getSupabaseAdmin();
  const { error } = await db.from('profit_config').upsert({
    id: 1,
    product_cost_cents: Math.round(nombre(b.productCostCents)),
    margin_target: nombre(b.marginTarget),
    fuel_base_address: (b.fuelBaseAddress as string) || null,
    fuel_base_lat: b.fuelBaseLat == null ? null : nombre(b.fuelBaseLat),
    fuel_base_lng: b.fuelBaseLng == null ? null : nombre(b.fuelBaseLng),
    fuel_consumption: nombre(b.fuelConsumption),
    fuel_price: nombre(b.fuelPrice),
    fuel_route_factor: nombre(b.fuelRouteFactor, 1.4),
    cdi_charge_rate: nombre(b.cdiChargeRate, 0.45),
    vat_rate: nombre(b.vatRate, 0.20),
    linen_kit_price: nombre(b.linenKitPrice),
    linen_kit_cost: nombre(b.linenKitCost),
  }, { onConflict: 'id' });

  if (error) {
    console.error('profit-config/save:', error.message);
    return NextResponse.json({ error: 'Enregistrement impossible.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
