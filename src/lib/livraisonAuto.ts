// ── Livraison créée avec son ménage (serveur uniquement) ────────────────────
//
// 98 % des livraisons accompagnaient un ménage du même logement le même jour,
// et l'admin les recréait à la main chaque soir. Un logement marqué « besoin
// d'une livraison » (airbnbs.needs_delivery) en reçoit donc une à chaque ménage,
// quelle que soit son origine : synchro, création manuelle, en lot, récurrent.
//
// La livraison naît SANS livreur : l'admin les assigne en lot (liste Missions).
// Elle garde le lien vers son ménage (missions.linked_mission_id) : elle le suit
// quand il change de date, et disparaît avec lui s'il est annulé — tant qu'elle
// n'a pas commencé. Une livraison n'est jamais facturée au client (prix 0).

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { notifyCleanerSync } from './notificationEvents';
import { livraisonsACreer, DUREE_LIVRAISON_MIN, type MenagePourLivraison } from './livraisonRegles';

/**
 * Crée la livraison de chacun de ces ménages qui en a besoin. Ne lève jamais :
 * la création du ménage prime.
 */
export async function creerLivraisonsAssociees(db: SupabaseClient, menageIds: string[]): Promise<number> {
  if (!menageIds.length) return 0;
  try {
    const { data: menages, error } = await db.from('missions')
      .select('id, airbnb_id, partner_id, date_from, time_from, service, status')
      .in('id', menageIds);
    if (error || !menages?.length) return 0;

    const aptIds = [...new Set(menages.map(m => m.airbnb_id as string | null).filter((x): x is string => !!x))];
    if (!aptIds.length) return 0;
    const { data: apts } = await db.from('airbnbs').select('id').in('id', aptIds).eq('needs_delivery', true);
    const avecLivraison = new Set((apts ?? []).map(a => a.id as string));
    if (!avecLivraison.size) return 0;

    const dates = [...new Set(menages.map(m => m.date_from as string))];
    const { data: existantes } = await db.from('missions')
      .select('airbnb_id, date_from, linked_mission_id')
      .eq('service', 'delivery').in('airbnb_id', [...avecLivraison]).in('date_from', dates);

    const rows = livraisonsACreer(menages as MenagePourLivraison[], avecLivraison, existantes ?? [])
      .map(m => ({
        type: 'regular', source: 'airbnb', service: 'delivery',
        airbnb_id: m.airbnb_id, partner_id: m.partner_id ?? null,
        date_from: m.date_from, time_from: m.time_from ?? null,
        mission_duration_minutes: DUREE_LIVRAISON_MIN,
        hours_worked: Math.round((DUREE_LIVRAISON_MIN / 60) * 100) / 100,
        price: 0, cleaner_gain: 0,
        created_by: null, created_by_role: 'system',
        linked_mission_id: m.id,
        status: 'pending',
      }));
    if (!rows.length) return 0;
    const { data: ins, error: errIns } = await db.from('missions').insert(rows).select('id');
    if (errIns) { console.error('creerLivraisonsAssociees:', errIns.message); return 0; }
    return ins?.length ?? 0;
  } catch (e) {
    console.error('creerLivraisonsAssociees:', e);
    return 0;
  }
}

/**
 * Le ménage change de date : ses livraisons pas encore commencées le suivent.
 * Un livreur déjà assigné est prévenu.
 */
export async function deplacerLivraisonsLiees(
  db: SupabaseClient, menageId: string, date: string, time: string | null,
): Promise<void> {
  try {
    const { data } = await db.from('missions')
      .update({ date_from: date, ...(time ? { time_from: time } : {}) })
      .eq('linked_mission_id', menageId).in('status', ['pending', 'assigned'])
      .select('id, status');
    for (const l of data ?? []) {
      if (l.status === 'assigned') {
        await notifyCleanerSync(l.id as string, 'Livraison déplacée',
          `Le ménage associé a changé de date : la livraison est déplacée au ${fmt(date)}.`);
      }
    }
  } catch (e) { console.error('deplacerLivraisonsLiees:', e); }
}

export interface LivraisonLiee { id: string; status: string; date_from: string }

/**
 * Les livraisons pas encore commencées de ces ménages. À relever AVANT de les
 * supprimer (la suppression efface le lien), puis à passer à `retirerLivraisons`
 * une fois la suppression faite.
 */
export async function livraisonsLiees(db: SupabaseClient, menageIds: string[]): Promise<LivraisonLiee[]> {
  if (!menageIds.length) return [];
  const { data } = await db.from('missions')
    .select('id, status, date_from')
    .in('linked_mission_id', menageIds).in('status', ['pending', 'assigned']);
  return (data ?? []) as LivraisonLiee[];
}

/**
 * Leur ménage est annulé : ces livraisons partent avec lui. Un livreur déjà
 * assigné est prévenu. Une livraison démarrée entre-temps reste.
 */
export async function retirerLivraisons(db: SupabaseClient, livraisons: LivraisonLiee[]): Promise<void> {
  if (!livraisons.length) return;
  try {
    for (const l of livraisons) {
      if (l.status === 'assigned') {
        await notifyCleanerSync(l.id, 'Livraison annulée',
          `Le ménage associé est annulé : la livraison du ${fmt(l.date_from)} n'aura pas lieu.`);
      }
    }
    await db.from('missions').delete().in('id', livraisons.map(l => l.id)).in('status', ['pending', 'assigned']);
  } catch (e) { console.error('retirerLivraisons:', e); }
}

const fmt = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
