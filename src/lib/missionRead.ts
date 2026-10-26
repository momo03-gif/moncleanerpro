import type { SupabaseClient } from '@supabase/supabase-js';

// ══════════════════════════════════════════════════════════════════════════════
//  Lecture des missions, côté SERVEUR (service_role).
//
//  La table `missions` était lisible en entier avec la clé publique : noms des
//  clients, adresses, consignes, prix, paie des cleaners, positions GPS. Les
//  lectures passent désormais par ici — appelé par GET /api/missions (navigateur)
//  et directement par le code serveur (moteur de paie).
//
//  Chaque « portée » correspond à un écran, et décide CE QUI SORT : un cleaner
//  ne reçoit pas le prix client, une conciergerie ne reçoit ni la paie ni le
//  pointage. Le filtrage se fait ici, avant l'envoi — pas dans le navigateur.
// ══════════════════════════════════════════════════════════════════════════════

export const MISSION_SELECT = '*, airbnbs(name, address, partner_name, client_price, estimated_cleaning_minutes, zone_id, zone_color, zone_name, structure_type, structure_label)';

type Ligne = Record<string, unknown>;

/** Champs internes (paie, pointage) jamais envoyés à une conciergerie. */
const INTERNES_PARTENAIRE = [
  'cleaner_gain', 'cleaner_hourly_rate_snapshot', 'mission_duration_minutes', 'apartment_default_duration_snapshot',
  'hours_worked', 'started_at', 'ended_at', 'actual_duration_minutes',
  'start_lat', 'start_lng', 'end_lat', 'end_lng', 'extra_time_minutes', 'extra_time_reason',
  'extra_time_status', 'extra_time_requested_at', 'pending_cleaner_id', 'pending_cleaner_name', 'pending_requested_at',
  // La sous-traitance ne regarde pas le client.
  'prestataire_id', 'prestataire_name', 'prestataire_gain', 'prestataire_rate_snapshot',
  'no_show_prev_price', 'no_show_prev_gain', 'no_show_prev_prestataire_gain',
];
/** Argent côté client — et ce qu'on paie à un prestataire — jamais envoyé à un cleaner. */
const INTERNES_CLEANER = ['price', 'supplies_amount', 'prestataire_gain', 'prestataire_rate_snapshot',
  'no_show_prev_price', 'no_show_prev_prestataire_gain'];
/**
 * Ce qu'un PRESTATAIRE (et ses agents) ne voit pas : le prix et le nom du client,
 * nos marges, la paie de nos cleaners, les demandes internes.
 */
const INTERNES_PRESTATAIRE = [
  'price', 'supplies_amount', 'client_name', 'cleaner_gain', 'cleaner_hourly_rate_snapshot',
  'pending_cleaner_id', 'pending_cleaner_name', 'pending_requested_at', 'partner_rating', 'partner_rating_comment',
  'no_show_prev_price', 'no_show_prev_gain',
];

function sans(rows: Ligne[], champs: string[], champsLogement: string[] = []): Ligne[] {
  return rows.map(r => {
    const copie: Ligne = { ...r };
    for (const c of champs) delete copie[c];
    if (champsLogement.length && copie.airbnbs && typeof copie.airbnbs === 'object') {
      const apt = { ...(copie.airbnbs as Ligne) };
      for (const c of champsLogement) delete apt[c];
      copie.airbnbs = apt;
    }
    return copie;
  });
}

const pourCleaner = (rows: Ligne[]) => sans(rows, INTERNES_CLEANER, ['client_price', 'estimated_cleaning_minutes']);
const pourPartenaire = (rows: Ligne[]) => sans(rows, INTERNES_PARTENAIRE, ['estimated_cleaning_minutes']);
/** Pour le prestataire : il garde ce qu'on lui doit (prestataire_gain). */
export const pourPrestataire = (rows: Ligne[]) =>
  sans(rows, INTERNES_PRESTATAIRE, ['client_price', 'partner_name', 'estimated_cleaning_minutes']);
/** Pour l'agent d'un prestataire : comme son prestataire, sans le montant. */
const pourAgent = (rows: Ligne[]) =>
  sans(pourPrestataire(rows), ['prestataire_gain', 'prestataire_rate_snapshot']);

/** cleaners.id + rattachement à un prestataire (agent: false si la base n'est pas migrée). */
async function ficheCleaner(db: SupabaseClient, userId: string): Promise<{ id: string; agent: boolean } | null> {
  const r = await db.from('cleaners').select('id, prestataire_id').eq('user_id', userId).maybeSingle();
  if (!r.error) return r.data ? { id: r.data.id as string, agent: !!r.data.prestataire_id } : null;
  const id = await idCleanerDeUtilisateur(db, userId);
  return id ? { id, agent: false } : null;
}

/** prestataires.id du compte connecté. */
export async function idPrestataireDeUtilisateur(db: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await db.from('prestataires').select('id').eq('user_id', userId).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/** Logements (et sites) d'une conciergerie : c'est le LOGEMENT qui fait foi. */
export async function logementsDuPartenaire(db: SupabaseClient, userId: string): Promise<string[]> {
  const { data } = await db.from('airbnbs').select('id').eq('partner_id', userId);
  return (data ?? []).map(a => a.id as string);
}

/** Filtre PostgREST : missions rattachées à la conciergerie OU situées sur un de ses logements. */
export async function filtrePartenaire(db: SupabaseClient, userId: string): Promise<string> {
  const ids = await logementsDuPartenaire(db, userId);
  return ids.length ? `partner_id.eq.${userId},airbnb_id.in.(${ids.join(',')})` : `partner_id.eq.${userId}`;
}

export async function idCleanerDeUtilisateur(db: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await db.from('cleaners').select('id').eq('user_id', userId).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/** '2026-09' → '2026-10-01' (borne exclusive du mois). */
function moisSuivant(periode: string): string {
  const [a, m] = periode.split('-').map(Number);
  return m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, '0')}-01`;
}

const date = (v: string | null | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

/** Toutes les missions (admin). */
export async function lireToutes(db: SupabaseClient, since?: string | null): Promise<Ligne[]> {
  // PostgREST plafonne une réponse (1000 lignes par défaut) : on pagine pour
  // ne jamais tronquer l'historique en silence. La 1re page donne le total ;
  // les suivantes partent EN PARALLÈLE (plutôt qu'une à une).
  const s = date(since);
  const page = (from: number, compter = false) => {
    let q = db.from('missions').select(MISSION_SELECT, compter ? { count: 'exact' } : undefined)
      .order('date_from', { ascending: false }).order('id').range(from, from + 999);
    if (s) q = q.gte('date_from', s);
    return q;
  };
  const premiere = await page(0, true);
  if (premiere.error) throw new Error(premiere.error.message);
  const out: Ligne[] = [...(premiere.data ?? [])];
  const total = premiere.count ?? out.length;
  const suivantes = [];
  for (let from = 1000; from < total; from += 1000) suivantes.push(page(from));
  for (const r of await Promise.all(suivantes)) {
    if (r.error) throw new Error(r.error.message);
    out.push(...(r.data ?? []));
  }
  return out;
}

/** Missions d'un cleaner (par cleaners.id). Brutes : à filtrer selon l'appelant. */
export async function lireDuCleaner(db: SupabaseClient, cleanerId: string, since?: string | null): Promise<Ligne[]> {
  let q = db.from('missions').select(MISSION_SELECT).eq('cleaner_id', cleanerId).order('date_from', { ascending: false });
  const s = date(since);
  if (s) q = q.gte('date_from', s);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export type Portee = 'all' | 'cleaner' | 'partner' | 'prestataire' | 'open' | 'requests' | 'ranking' | 'supplies' | 'one';

/**
 * Lecture pour une session donnée. Renvoie `null` si la portée est refusée à
 * ce rôle (la route répond alors 403).
 */
export async function lirePourSession(
  db: SupabaseClient,
  session: { id: string; role: string },
  portee: string,
  p: URLSearchParams,
): Promise<Ligne[] | Ligne | null> {
  const admin = session.role === 'admin';

  switch (portee as Portee) {
    case 'all':
      return admin ? lireToutes(db, p.get('since')) : null;

    case 'cleaner': {
      // Un cleaner lit les siennes ; l'admin peut lire celles de n'importe qui.
      if (admin && p.get('cleanerId')) return lireDuCleaner(db, p.get('cleanerId')!, p.get('since'));
      if (session.role !== 'cleaner') return null;
      const fiche = await ficheCleaner(db, session.id);
      if (!fiche) return [];
      const rows = await lireDuCleaner(db, fiche.id, p.get('since'));
      return fiche.agent ? pourAgent(rows) : pourCleaner(rows);
    }

    case 'prestataire': {
      // Les missions qu'on lui a confiées (l'admin peut regarder celles d'un prestataire).
      const pid = admin
        ? p.get('prestataireId')
        : (session.role === 'prestataire' ? await idPrestataireDeUtilisateur(db, session.id) : null);
      if (!pid) return admin ? [] : null;
      let q = db.from('missions').select(MISSION_SELECT).eq('prestataire_id', pid).order('date_from', { ascending: false });
      const s = date(p.get('since'));
      if (s) q = q.gte('date_from', s);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return admin ? (data ?? []) : pourPrestataire(data ?? []);
    }

    case 'partner': {
      if (session.role !== 'airbnb') return null;
      // Rattachées à elle OU sur un de ses logements : des ménages créés sans
      // partner_id (récurrences, création admin) restent ainsi visibles.
      const { data, error } = await db.from('missions').select(MISSION_SELECT)
        .or(await filtrePartenaire(db, session.id)).order('date_from', { ascending: false });
      if (error) throw new Error(error.message);
      return pourPartenaire(data ?? []);
    }

    case 'open': {
      // Missions ouvertes aux cleaners, pas encore demandées.
      if (!admin && session.role !== 'cleaner') return null;
      // Les agents d'un prestataire ne reçoivent que ce que leur prestataire leur donne.
      if (!admin && (await ficheCleaner(db, session.id))?.agent) return [];
      const lire = (sansConfiees: boolean) => {
        let q = db.from('missions').select(MISSION_SELECT).eq('status', 'pending').is('pending_cleaner_id', null)
          // Une intervention (artisan) se confie, elle ne se propose pas à l'équipe.
          .or('service.is.null,service.neq.repair');
        // Une mission confiée à un prestataire n'est plus proposée à l'équipe.
        if (sansConfiees) q = q.is('prestataire_id', null);
        return q.order('date_from');
      };
      let { data, error } = await lire(true);
      if (error) ({ data, error } = await lire(false));   // base pas encore migrée
      if (error) throw new Error(error.message);
      return admin ? (data ?? []) : pourCleaner(data ?? []);
    }

    case 'requests': {
      if (!admin) return null;
      const { data, error } = await db.from('missions').select(MISSION_SELECT)
        .not('pending_cleaner_id', 'is', null).order('pending_requested_at');
      if (error) throw new Error(error.message);
      return data ?? [];
    }

    case 'ranking': {
      // Classement mensuel : un AGRÉGAT sans montant, visible de tous les cleaners.
      // La jointure nomme sa clé : missions pointe DEUX fois vers cleaners
      // (cleaner_id et pending_cleaner_id), et l'ambiguïté faisait échouer la requête.
      if (!admin && session.role !== 'cleaner') return null;
      const periode = p.get('period') ?? '';
      if (!/^\d{4}-\d{2}$/.test(periode)) return [];
      // Les agents des prestataires ne font pas partie de l'équipe : pas de classement.
      const lire = (champs: string) => db.from('missions').select(champs)
        .eq('status', 'done').gte('date_from', `${periode}-01`).lt('date_from', moisSuivant(periode));
      let { data, error } = await lire('cleaner_id, prestataire_id, cleaners!missions_cleaner_id_fkey(name)');
      if (error) ({ data, error } = await lire('cleaner_id, cleaners!missions_cleaner_id_fkey(name)'));
      if (error) throw new Error(error.message);
      const parCleaner = new Map<string, { name: string; count: number }>();
      for (const r of (data ?? []) as unknown as Ligne[]) {
        const id = r.cleaner_id as string | null;
        if (!id || r.prestataire_id) continue;
        const e = parCleaner.get(id) ?? { name: (r.cleaners as { name?: string } | null)?.name ?? 'Cleaner', count: 0 };
        e.count += 1; parCleaner.set(id, e);
      }
      return Array.from(parCleaner.entries()).map(([cleanerId, v]) => ({ cleanerId, ...v }))
        .sort((a, b) => b.count - a.count);
    }

    case 'supplies': {
      // Consommables signalés sur les ménages d'un logement : admin, ou la
      // conciergerie propriétaire du logement.
      const airbnbId = p.get('airbnbId');
      if (!airbnbId) return [];
      if (!admin) {
        if (session.role !== 'airbnb') return null;
        const { data: apt } = await db.from('airbnbs').select('partner_id').eq('id', airbnbId).maybeSingle();
        if (!apt || apt.partner_id !== session.id) return null;
      }
      const { data, error } = await db.from('missions')
        .select('id, date_from, mission_reports(consumables, consumables_note)')
        .eq('airbnb_id', airbnbId).eq('status', 'done')
        .order('date_from', { ascending: false }).limit(30);
      if (error) throw new Error(error.message);
      return data ?? [];
    }

    case 'one': {
      // Une mission précise : l'admin, son cleaner, ou sa conciergerie.
      const id = p.get('id');
      if (!id) return null;
      const { data, error } = await db.from('missions').select(MISSION_SELECT).eq('id', id).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      if (admin) return data;
      if (session.role === 'airbnb') {
        const aSoi = data.partner_id === session.id
          || (!!data.airbnb_id && (await logementsDuPartenaire(db, session.id)).includes(data.airbnb_id as string));
        if (aSoi) return pourPartenaire([data])[0];
      }
      if (session.role === 'cleaner') {
        const fiche = await ficheCleaner(db, session.id);
        if (fiche && data.cleaner_id === fiche.id) return (fiche.agent ? pourAgent : pourCleaner)([data])[0];
      }
      if (session.role === 'prestataire' && data.prestataire_id) {
        const pid = await idPrestataireDeUtilisateur(db, session.id);
        if (pid && data.prestataire_id === pid) return pourPrestataire([data])[0];
      }
      return null;
    }

    default:
      return null;
  }
}
