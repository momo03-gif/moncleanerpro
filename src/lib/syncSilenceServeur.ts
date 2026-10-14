import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from './supabaseAdmin';
import { connexionsMuettes, RECUL_JOURS, type ConnexionMuette } from './syncSilence';
import { notifyAdminsSync } from './notificationEvents';

// ── Surveillance des connexions muettes (cf. syncSilence.ts pour la règle) ───
//
// Appelée à chaque synchronisation complète (toutes les heures). Elle prévient
// les admins UNE fois quand une connexion devient muette, le rappelle au plus
// tous les RAPPEL_JOURS tant que ça dure, et annonce quand elle repart — sans
// quoi on ne saurait jamais si le problème est réglé.

const RAPPEL_JOURS = 3;

const NOMS_LOGICIELS: Record<string, string> = {
  superhote: 'SuperHote', hostify: 'Hostify', hostaway: 'Hostaway', smoobu: 'Smoobu',
  beds24: 'Beds24', lodgify: 'Lodgify', airbnb: 'Airbnb', booking: 'Booking', abritel: 'Abritel',
};
const logiciel = (p: string) => NOMS_LOGICIELS[p] ?? (p.charAt(0).toUpperCase() + p.slice(1));
const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });

function parisAujourdhui(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export interface ConnexionMuetteNommee extends ConnexionMuette { conciergerie: string; logiciel: string }

/** Connexions muettes aujourd'hui, avec le nom de la conciergerie et du logiciel. */
export async function chargerConnexionsMuettes(db: SupabaseClient = getSupabaseAdmin()): Promise<ConnexionMuetteNommee[]> {
  const aujourdhui = parisAujourdhui();
  const depuis = new Date(Date.now() - (RECUL_JOURS + 5) * 86400000).toISOString();

  const { data: feeds, error: e1 } = await db.from('reservation_feeds')
    .select('id, partner_id, platform, created_at').eq('active', true);
  if (e1) throw new Error(e1.message);
  const parFlux = new Map((feeds ?? []).map(f => [f.id as string, f]));

  // Seulement les séjours CONFIRMÉS : les dates bloquées ne sont pas un rythme.
  const resas: { feed_id: string; created_at: string }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('reservations').select('feed_id, created_at')
      .eq('status', 'confirmed').gte('created_at', depuis).order('created_at').range(from, from + 999);
    if (error) throw new Error(error.message);
    resas.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }

  const muettes = connexionsMuettes(
    (feeds ?? []).map(f => ({ partnerId: f.partner_id as string | null, platform: f.platform as string, createdAt: f.created_at as string })),
    resas.filter(r => parFlux.has(r.feed_id)).map(r => {
      const f = parFlux.get(r.feed_id)!;
      return { feedPartnerId: f.partner_id as string | null, feedPlatform: f.platform as string, createdAt: r.created_at };
    }),
    aujourdhui,
  );
  if (muettes.length === 0) return [];

  const ids = Array.from(new Set(muettes.map(m => m.partnerId).filter((x): x is string => !!x)));
  const { data: users } = ids.length ? await db.from('users').select('id, name').in('id', ids) : { data: [] };
  const nom = new Map((users ?? []).map(u => [u.id as string, ((u.name as string) ?? '').trim()]));
  return muettes.map(m => ({
    ...m,
    conciergerie: (m.partnerId && nom.get(m.partnerId)) || 'Conciergerie sans compte',
    logiciel: logiciel(m.platform),
  }));
}

const titreMuet = (c: { conciergerie: string; logiciel: string }) => `Calendrier muet — ${c.conciergerie} (${c.logiciel})`;

/** Alerte (et fin d'alerte) des connexions muettes. Ne lève jamais : la synchro passe avant. */
export async function surveillerConnexionsMuettes(): Promise<void> {
  try {
    const db = getSupabaseAdmin();
    const muettes = await chargerConnexionsMuettes(db);
    const titresMuets = new Set(muettes.map(titreMuet));

    for (const c of muettes) {
      const { count } = await db.from('notifications').select('id', { count: 'exact', head: true })
        .eq('type', 'sync').eq('title', titreMuet(c))
        .gte('created_at', new Date(Date.now() - RAPPEL_JOURS * 86400000).toISOString());
      if ((count ?? 0) > 0) continue;
      const rythme = Math.max(1, Math.round(c.rythme * 10));
      await notifyAdminsSync(titreMuet(c),
        `Aucune nouvelle réservation reçue de ${c.logiciel} pour ${c.conciergerie} depuis le ${fmt(c.derniereNouvelle)} `
        + `(${c.joursSilence} jours), alors qu'il en arrivait habituellement ${rythme} jour${rythme > 1 ? 's' : ''} sur 10. `
        + `La synchronisation répond pourtant sans erreur : le logiciel de la conciergerie a peut-être changé `
        + `(nouvelle version, clé ou lien régénéré). Les ménages des réservations récentes ne sont pas créés — `
        + `vérifiez avec la conciergerie.`);
      console.warn('sync: connexion muette', { conciergerie: c.conciergerie, logiciel: c.logiciel, jours: c.joursSilence });
    }

    // Fin d'alerte : une connexion signalée ces 30 derniers jours, plus muette
    // aujourd'hui, et pas encore annoncée comme rétablie.
    const { data: passees } = await db.from('notifications').select('title, created_at')
      .eq('type', 'sync').like('title', 'Calendrier muet — %')
      .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString())
      .order('created_at', { ascending: false });
    const dejaVus = new Set<string>();
    for (const n of passees ?? []) {
      const titre = n.title as string;
      if (dejaVus.has(titre) || titresMuets.has(titre)) continue;
      dejaVus.add(titre);
      const suffixe = titre.slice('Calendrier muet — '.length);
      const retabli = `Calendrier rétabli — ${suffixe}`;
      const { count } = await db.from('notifications').select('id', { count: 'exact', head: true })
        .eq('type', 'sync').eq('title', retabli).gte('created_at', n.created_at as string);
      if ((count ?? 0) > 0) continue;
      await notifyAdminsSync(retabli, `Les nouvelles réservations arrivent à nouveau (${suffixe}). Les ménages se créent de nouveau automatiquement.`);
    }
  } catch (e) {
    console.error('surveillerConnexionsMuettes:', e);
  }
}

