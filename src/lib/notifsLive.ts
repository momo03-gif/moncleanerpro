import { supabase } from './supabase';

// ══════════════════════════════════════════════════════════════════════════════
//  Arrivée en direct des notifications (cloche, compteur de devis du menu).
//
//  L'écoute « postgres_changes » lit la table `notifications` avec la clé
//  publique ; elle s'arrête quand la table est fermée au public. La base émet
//  donc aussi un signal sur le canal `notif-<userId>` (déclencheur SQL, cf.
//  migration_annexes_serveur.sql) : il ne contient que le TYPE de notification,
//  ni titre ni message. L'écran recharge ensuite sa cloche par le serveur.
//
//  Un seul abonnement par utilisateur, partagé entre la cloche et le menu :
//  deux canaux sur le même sujet se gênent.
// ══════════════════════════════════════════════════════════════════════════════

type Ecouteur = (type: string | null) => void;

const ecouteurs = new Set<Ecouteur>();
let canal: ReturnType<typeof supabase.channel> | null = null;
let utilisateur: string | null = null;

let dernier = { type: '' as string | null, quand: 0 };

function diffuser(type: string | null) {
  // Pendant la transition, un même événement arrive par les deux écoutes : on
  // ne sonne qu'une fois.
  const maintenant = Date.now();
  if (dernier.type === type && maintenant - dernier.quand < 2000) return;
  dernier = { type, quand: maintenant };
  for (const e of ecouteurs) { try { e(type); } catch { /* un écouteur ne bloque pas les autres */ } }
}

export function ecouterNotifications(userId: string, cb: Ecouteur): () => void {
  if (canal && utilisateur !== userId) { supabase.removeChannel(canal); canal = null; }
  ecouteurs.add(cb);
  if (!canal) {
    utilisateur = userId;
    // Les deux écoutes coexistent le temps de la transition (doublons filtrés).
    canal = supabase.channel(`notif-${userId}`)
      .on('broadcast', { event: 'new' }, ({ payload }) => diffuser((payload as { type?: string })?.type ?? null))
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        p => diffuser((p.new as { type?: string })?.type ?? null))
      .subscribe();
  }
  return () => {
    ecouteurs.delete(cb);
    if (ecouteurs.size === 0 && canal) { supabase.removeChannel(canal); canal = null; utilisateur = null; }
  };
}
