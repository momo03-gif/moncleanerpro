// ── Transférer les missions d'un intervenant à un autre (logique PURE) ──────
//
//  LE BESOIN : un cleaner se fait arrêter, part en congés, quitte l'entreprise.
//  Reprendre ses vingt missions une par une prend dix minutes et se fait à 6h
//  du matin, quand on a le moins envie de se tromper.
//
//  CE QUI BOUGE, ET SURTOUT CE QUI NE BOUGE PAS. Un transfert n'est pas une
//  réécriture de l'historique :
//   · une mission TERMINÉE ne bouge jamais — elle est faite, elle est payée à
//     celui qui l'a faite, et la déplacer fausserait deux fiches de paie ;
//   · une mission EN COURS ne bouge jamais — quelqu'un est sur place ;
//   · une mission ANNULÉE n'a personne à transférer ;
//   · une mission PASSÉE et non faite ne bouge pas non plus : elle ne sera pas
//     rattrapée par un autre, elle relève d'une décision, pas d'un transfert ;
//   · une DEMANDE en attente (pending_cleaner_id) n'est pas une affectation :
//     elle reste où elle est, l'admin la tranchera.
//
//  Restent les missions à venir déjà attribuées, et celles qui attendent d'être
//  faites ce jour même. C'est exactement ce qu'on veut déplacer.
//
//  LE GAIN EST RECALCULÉ, jamais recopié : deux intervenants n'ont pas le même
//  taux horaire. Copier le montant transformerait un transfert en erreur de
//  paie silencieuse. Le recalcul se fait côté serveur (cf. /api/missions).

export interface MissionTransferable {
  id: string;
  /**
   * Statut, dans l'un ou l'autre vocabulaire. La base stocke 'assigned',
   * 'inprogress', 'done' ; l'application manipule 'accepted', 'in_progress',
   * 'completed' (cf. mapMissionStatus). Les deux sont acceptés ici pour que la
   * même règle serve à l'aperçu côté écran et à l'écriture côté serveur — et
   * parce qu'on ne renomme JAMAIS ces statuts.
   */
  status?: string | null;
  /** Date de la mission, 'YYYY-MM-DD'. */
  date?: string | null;
  cleanerId?: string | null;
}

/** Les statuts qu'on accepte de déplacer, dans les deux vocabulaires. */
const STATUTS_TRANSFERABLES = new Set(['pending', 'assigned', 'accepted']);

/**
 * Les missions de `sourceId` qui peuvent passer à quelqu'un d'autre.
 * `aujourdhui` est fourni par l'appelant (jamais `new Date()` ici : un module
 * pur qui lit l'horloge n'est pas testable).
 */
export function missionsTransferables(
  missions: MissionTransferable[],
  sourceId: string,
  aujourdhui: string,
): MissionTransferable[] {
  if (!sourceId) return [];
  return (missions ?? []).filter(m =>
    m.cleanerId === sourceId
    && STATUTS_TRANSFERABLES.has(String(m.status ?? ''))
    && !!m.date && m.date >= aujourdhui);
}

export interface ApercuTransfert {
  nombre: number;
  /** Première et dernière date concernées — de quoi mesurer l'ampleur. */
  premiere?: string;
  derniere?: string;
}

/**
 * Ce qu'on annonce AVANT d'agir. Un bouton qui déplace vingt missions sans dire
 * combien ni jusqu'à quand est un bouton qu'on n'ose pas cliquer.
 */
export function apercuTransfert(
  missions: MissionTransferable[],
  sourceId: string,
  aujourdhui: string,
): ApercuTransfert {
  const dates = missionsTransferables(missions, sourceId, aujourdhui)
    .map(m => m.date as string)
    .sort();
  return { nombre: dates.length, premiere: dates[0], derniere: dates[dates.length - 1] };
}

/** Le transfert a-t-il un sens ? Renvoie le motif du refus, ou `null`. */
export function refusTransfert(sourceId: string, cibleId: string, nombre: number): string | null {
  if (!sourceId || !cibleId) return 'Choisissez l’intervenant qui reprend les missions.';
  if (sourceId === cibleId) return 'C’est déjà le même intervenant.';
  if (nombre === 0) return 'Aucune mission à venir à transférer.';
  return null;
}
