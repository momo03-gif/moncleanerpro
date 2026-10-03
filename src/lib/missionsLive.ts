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
  opts: { delaiMs?: number; enPause?: () => boolean } = {},
): () => void {
  const delai = opts.delaiMs ?? 500;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const recharger = () => {
    clearTimeout(timer);
    timer = setTimeout(() => { if (!opts.enPause?.()) onChange(); }, delai);
  };
  const auRetour = () => { if (document.visibilityState === 'visible') recharger(); };

  const ch = supabase.channel('missions')
    .on('broadcast', { event: 'change' }, recharger)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'missions' }, recharger)
    .subscribe();
  document.addEventListener('visibilitychange', auRetour);

  return () => {
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', auRetour);
    supabase.removeChannel(ch);
  };
}
