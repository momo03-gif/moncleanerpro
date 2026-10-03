import { supabase } from './supabase';

// ══════════════════════════════════════════════════════════════════════════════
//  Mise à jour en direct des écrans de missions.
//
//  L'abonnement « postgres_changes » LIT la table avec la clé publique : il
//  cesse de fonctionner dès que `missions` n'est plus lisible publiquement. La
//  base diffuse donc à la place un simple signal « une mission a changé » sur
//  le canal `missions` (déclencheur SQL, cf. migration_missions_lecture_serveur
//  .sql) : il ne contient que l'identifiant, aucune donnée. L'écran recharge
//  alors par le serveur, qui ne lui rend que ce qu'il a le droit de voir.
//
//  Les deux écoutes coexistent le temps de la transition ; les événements sont
//  regroupés en un seul rechargement. Le retour sur l'onglet recharge aussi :
//  un téléphone en veille ne reçoit rien et doit se remettre à jour au réveil.
// ══════════════════════════════════════════════════════════════════════════════

export function ecouterMissions(
  onChange: () => void,
  opts: {
    delaiMs?: number;
    enPause?: () => boolean;
    /**
     * Mise à jour CIBLÉE : reçoit les identifiants des missions modifiées, pour
     * ne recharger qu'elles (quelques Ko) au lieu de tout le planning (plusieurs
     * Mo à chaque geste d'un cleaner). Au-delà de MAX_CIBLE changements d'un
     * coup (synchro, action groupée), on recharge tout, c'est plus simple.
     */
    surIds?: (ids: string[]) => void;
  } = {},
): () => void {
  const delai = opts.delaiMs ?? 500;
  const MAX_CIBLE = 25;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let ids = new Set<string>();
  let toutRecharger = false;
  const planifier = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (opts.enPause?.()) { ids = new Set(); toutRecharger = false; return; }
      const lot = Array.from(ids);
      const tout = toutRecharger || !opts.surIds || lot.length === 0 || lot.length > MAX_CIBLE;
      ids = new Set(); toutRecharger = false;
      if (tout) onChange(); else opts.surIds!(lot);
    }, delai);
  };
  const signal = (id: unknown) => {
    if (typeof id === 'string' && id) ids.add(id); else toutRecharger = true;
    planifier();
  };
  const recharger = () => { toutRecharger = true; planifier(); };
  const auRetour = () => { if (document.visibilityState === 'visible') recharger(); };

  const ch = supabase.channel('missions')
    .on('broadcast', { event: 'change' }, ({ payload }) => signal((payload as { id?: unknown })?.id))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'missions' },
      p => signal((p.new as { id?: unknown })?.id ?? (p.old as { id?: unknown })?.id))
    .subscribe();
  document.addEventListener('visibilitychange', auRetour);

  return () => {
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', auRetour);
    supabase.removeChannel(ch);
  };
}

// Même principe pour les RÉSERVATIONS et les flux de synchronisation : canal
// `reservations` (déclencheur SQL, cf. migration_comptes_logements_reservations.sql).
// Une synchro réécrit des dizaines de lignes : le regroupement évite autant de
// rechargements.
export function ecouterReservations(onChange: () => void, opts: { delaiMs?: number } = {}): () => void {
  const delai = opts.delaiMs ?? 1500;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const recharger = () => { clearTimeout(timer); timer = setTimeout(onChange, delai); };
  const ch = supabase.channel('reservations')
    .on('broadcast', { event: 'change' }, recharger)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, recharger)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reservation_feeds' }, recharger)
    .subscribe();
  return () => { clearTimeout(timer); supabase.removeChannel(ch); };
}

// Fusion d'une mise à jour ciblée : cf. missionOrder.ts (logique pure, testée).
export { fusionnerMissions } from './missionOrder';
