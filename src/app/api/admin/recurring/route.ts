// ── /api/admin/recurring — plannings de ménage récurrent ────────────────────
//
//  POURQUOI CETTE ROUTE EXISTE
//  Les plannings récurrents s'écrivaient depuis le navigateur, avec la clé
//  publique. Or créer un planning ne crée pas qu'une règle : cela matérialise
//  des missions, et une mission porte un prix client et un gain cleaner. Une
//  table ouverte en écriture au navigateur, c'est la grille de salaires
//  modifiable par quiconque lit le code source de la page.
//
//  Tout passe donc ici, en service_role, après vérification de la session
//  admin — ce qui permet de fermer `recurring_missions` à la clé publique.
//
//  La génération elle-même reste dans `lib/recurring.ts` : c'est le même moteur
//  que le cron appelle deux fois par jour, et il n'y a aucune raison d'en avoir
//  deux versions.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { exigerAdmin } from '@/lib/apiGuard';
import { generateRecurringMissions } from '@/lib/recurring';

export const runtime = 'nodejs';

const refus = (m: string, code = 403) => NextResponse.json({ error: m }, { status: code });

/** Aujourd'hui à Paris — la purge ne doit jamais toucher une journée passée. */
const aujourdhuiParis = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

interface ChampsPlanning {
  airbnbId?: string; propertyName?: string; address?: string;
  cleanerId?: string; cleanerName?: string;
  weekdays?: number[]; timeFrom?: string; durationMinutes?: number; price?: number;
  startDate?: string; endDate?: string; createdBy?: string;
  addressLat?: number; addressLng?: number;
}

/** Les champs du formulaire → les colonnes de la table. */
function enLigne(f: ChampsPlanning): Record<string, unknown> {
  // Un planning rattaché à un site tient son nom et son adresse du site : les
  // recopier ici, c'est se condamner à deux vérités le jour d'un déménagement.
  const lie = !!f.airbnbId;
  return {
    airbnb_id: f.airbnbId || null,
    property_name: lie ? null : (f.propertyName || null),
    address: lie ? null : (f.address || null),
    address_lat: f.addressLat ?? null,
    address_lng: f.addressLng ?? null,
    cleaner_id: f.cleanerId || null,
    cleaner_name: f.cleanerName || null,
    weekdays: f.weekdays ?? [],
    time_from: f.timeFrom || null,
    duration_minutes: f.durationMinutes || 60,
    price: f.price || 0,
    start_date: f.startDate,
    end_date: f.endDate || null,
  };
}

export async function GET() {
  const { refus: pasAdmin } = await exigerAdmin();
  if (pasAdmin) return pasAdmin;

  const db = getSupabaseAdmin();
  const { data, error } = await db.from('recurring_missions')
    .select('*, airbnbs(name, address)').order('created_at', { ascending: false });
  if (error) { console.error('recurring/list:', error.message); return refus('Lecture impossible.', 500); }
  return NextResponse.json({ plannings: data ?? [] });
}

export async function POST(req: Request) {
  const { refus: pasAdmin } = await exigerAdmin();
  if (pasAdmin) return pasAdmin;

  let b: { action?: string; id?: string; fields?: ChampsPlanning; active?: boolean } = {};
  try { b = await req.json(); } catch { return refus('Requête invalide.', 400); }

  const db = getSupabaseAdmin();

  switch (b.action) {
    case 'create': {
      const f = b.fields ?? {};
      if (!f.startDate) return refus('Date de début manquante.', 400);
      const { error } = await db.from('recurring_missions').insert({
        ...enLigne(f), service: 'cleaning', created_by: f.createdBy || null,
      });
      if (error) { console.error('recurring/create:', error.message); return refus('Création impossible.', 500); }
      const gen = await generateRecurringMissions();
      return NextResponse.json({ ok: true, generated: gen.created });
    }

    case 'update': {
      if (!b.id) return refus('Planning manquant.', 400);
      const f = b.fields ?? {};
      if (!f.startDate) return refus('Date de début manquante.', 400);
      const { error } = await db.from('recurring_missions').update(enLigne(f)).eq('id', b.id);
      if (error) { console.error('recurring/update:', error.message); return refus('Modification impossible.', 500); }

      // On réaligne l'agenda : les occurrences À VENIR et non démarrées sont
      // effacées puis régénérées selon la nouvelle règle. Les missions passées,
      // en cours ou terminées restent — ce sont des données de référence.
      const { error: purge } = await db.from('missions').delete()
        .eq('recurring_id', b.id).gte('date_from', aujourdhuiParis())
        .in('status', ['pending', 'assigned']);
      if (purge) console.error('recurring/purge:', purge.message);

      const gen = await generateRecurringMissions();
      return NextResponse.json({ ok: true, generated: gen.created });
    }

    case 'setActive': {
      if (!b.id) return refus('Planning manquant.', 400);
      const { error } = await db.from('recurring_missions').update({ active: !!b.active }).eq('id', b.id);
      if (error) { console.error('recurring/setActive:', error.message); return refus('Modification impossible.', 500); }
      // Réactiver, c'est vouloir revoir les ménages tout de suite.
      const gen = b.active ? await generateRecurringMissions() : { created: 0 };
      return NextResponse.json({ ok: true, generated: gen.created });
    }

    case 'delete': {
      if (!b.id) return refus('Planning manquant.', 400);
      // Les missions déjà générées sont conservées (recurring_id passe à NULL
      // par ON DELETE SET NULL) : elles ont été réalisées ou sont planifiées.
      const { error } = await db.from('recurring_missions').delete().eq('id', b.id);
      if (error) { console.error('recurring/delete:', error.message); return refus('Suppression impossible.', 500); }
      return NextResponse.json({ ok: true });
    }

    default:
      return refus('Action inconnue.', 400);
  }
}
