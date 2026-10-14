// ════════════════════════════════════════════════════════════════════════════
//  File de synchronisation hors-ligne (actions cleaner).
//
//  Principe : quand le réseau est absent, les actions (démarrer/terminer/livrer/
//  désister/temps supp.) sont mises en file dans IndexedDB avec l'heure ET
//  la position GPS capturées AU MOMENT de l'action (la géoloc fonctionne sans
//  internet). À la reconnexion, elles sont REJOUÉES : le serveur revalide la
//  proximité (≤ 200 m) et enregistre l'horodatage réel. Un rejet « trop loin » /
//  « GPS manquant » est conservé et remonté au cleaner ; les mutations sont
//  idempotentes (rejeu sans doublon).
//
//  En ligne, on court-circuite la file : appel direct (retour temps réel + contrôle
//  GPS immédiat). La file ne sert qu'au mode hors-ligne.
//
//  PHOTOS : elles passent TOUJOURS par la file, même en ligne. Une photo est
//  d'abord gardée sur le téléphone, puis envoyée dès que possible — une
//  connexion faible ou coupée ne la perd jamais, même si l'app est fermée. Et
//  comme la photo « après » est obligatoire pour terminer, « Terminer » se met
//  dans la file DERRIÈRE les photos encore en attente : le serveur reçoit la
//  photo avant la clôture, et le cleaner n'est jamais bloqué par le réseau.
// ════════════════════════════════════════════════════════════════════════════

import { startMissionDB, finishMissionDB, markDeliveredDB, withdrawMissionDB, requestExtraTimeDB } from '@/lib/db';
import { GPS_REQUIRED_ERROR, type GeoPoint } from '@/lib/geo';
import { PHOTOS_REQUISES_ERROR } from '@/lib/photosRegles';
import { uploadMissionPhotoDB } from '@/lib/missionPhotos';
import { compressImage } from '@/lib/imageCompress';
import type { MissionPhotoKind } from '@/lib/types';
import {
  addQueued, allQueued, putQueued, removeQueued, patchCachedMission,
  type QueuedAction, type QueuedType,
} from './store';

// Au-delà de ce nombre de tentatives infructueuses (erreurs non métier), une action
// est marquée « refusée » plutôt que rejouée indéfiniment.
const MAX_ATTEMPTS = 5;

export const QUEUE_CHANGE_EVENT = 'mcp-queue-change';

function isOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function notifyChange(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(QUEUE_CHANGE_EVENT));
}

async function enqueue(
  type: QueuedType, userId: string, missionId: string,
  args: Record<string, unknown>, coords: GeoPoint | null,
): Promise<QueuedAction> {
  const now = new Date().toISOString();
  const action: QueuedAction = {
    id: uuid(), userId, type, missionId, args,
    at: now, coords: coords ?? null, status: 'pending', attempts: 0, createdAt: now,
  };
  await addQueued(action);
  notifyChange();
  return action;
}

// ── Submit wrappers appelés par l'UI ────────────────────────────────────────
// En ligne → appel direct. Hors-ligne → mise en file + correctif optimiste du
// cache pour que l'app reflète l'action immédiatement.

export interface SubmitResult { queued: boolean; error: string | null; tooFar?: boolean }

export async function submitStart(p: { missionId: string; userId: string; coords: GeoPoint | null }): Promise<SubmitResult> {
  if (isOnline()) { const r = await startMissionDB(p.missionId, p.userId, p.coords); return { queued: false, error: r.error, tooFar: r.tooFar }; }
  await enqueue('start', p.userId, p.missionId, {}, p.coords);
  await patchCachedMission(p.userId, p.missionId, { status: 'in_progress' });
  return { queued: true, error: null };
}

export async function submitFinish(p: { missionId: string; userId: string; coords: GeoPoint | null }): Promise<SubmitResult> {
  // Des actions de cette mission (photos surtout) attendent encore le réseau :
  // « Terminer » passe derrière elles, sinon le serveur refuserait faute de photo.
  const enAttente = (await allQueued()).some(i => i.missionId === p.missionId && i.status === 'pending');
  if (isOnline() && !enAttente) {
    const r = await finishMissionDB(p.missionId, p.userId, p.coords);
    return { queued: false, error: r.error, tooFar: r.tooFar };
  }
  await enqueue('finish', p.userId, p.missionId, {}, p.coords);
  await patchCachedMission(p.userId, p.missionId, { status: 'completed' });
  void syncQueue();
  return { queued: true, error: null };
}

// ── Photos de ménage ─────────────────────────────────────────────────────────

/** Garde la photo sur le téléphone puis lance l'envoi. Ne dépend jamais du réseau. */
export async function submitPhoto(p: { missionId: string; userId: string; kind: MissionPhotoKind; file: File }): Promise<void> {
  // Compressée AVANT d'être gardée : moins de place sur le téléphone, envoi plus court.
  let blob: Blob = p.file;
  try { blob = await compressImage(p.file); } catch { /* on garde l'original */ }
  try {
    await enqueue('photo', p.userId, p.missionId, { kind: p.kind, blob, name: p.file.name || 'photo.jpg' }, null);
  } catch {
    // Le téléphone ne peut rien garder (navigation privée, mémoire pleine) :
    // envoi direct, et l'échec éventuel est remonté au cleaner.
    const r = await uploadMissionPhotoDB({ missionId: p.missionId, kind: p.kind, file: p.file, userId: p.userId });
    if (r.error) throw new Error(r.error);
    notifyChange();
    return;
  }
  void syncQueue();
}

export interface PhotoEnFile { id: string; kind: MissionPhotoKind; blob: Blob; status: 'pending' | 'rejected'; error?: string; attempts: number }

/** Photos d'une mission encore sur le téléphone (en attente d'envoi ou refusées). */
export async function photosEnFile(missionId: string): Promise<PhotoEnFile[]> {
  return (await allQueued())
    .filter(i => i.type === 'photo' && i.missionId === missionId && i.args.blob instanceof Blob)
    .map(i => ({ id: i.id, kind: i.args.kind as MissionPhotoKind, blob: i.args.blob as Blob, status: i.status, error: i.error, attempts: i.attempts }));
}

/** Relance l'envoi d'une photo refusée. */
export async function relancerPhoto(id: string): Promise<void> {
  const item = (await allQueued()).find(i => i.id === id);
  if (!item) return;
  item.status = 'pending'; item.attempts = 0; item.error = undefined;
  await putQueued(item);
  notifyChange();
  void syncQueue();
}

/** Retire une photo de la file (le cleaner l'abandonne). */
export async function retirerPhoto(id: string): Promise<void> {
  await removeQueued(id);
  notifyChange();
}

export async function submitDeliver(p: { missionId: string; userId: string }): Promise<SubmitResult> {
  if (isOnline()) { const r = await markDeliveredDB(p.missionId, p.userId); return { queued: false, error: r.error }; }
  await enqueue('deliver', p.userId, p.missionId, {}, null);
  await patchCachedMission(p.userId, p.missionId, { status: 'completed' });
  return { queued: true, error: null };
}

export async function submitWithdraw(p: { missionId: string; userId: string }): Promise<SubmitResult> {
  if (isOnline()) { const r = await withdrawMissionDB(p.missionId, p.userId); return { queued: false, error: r.error }; }
  await enqueue('withdraw', p.userId, p.missionId, {}, null);
  // Désistement : la mission n'est pas annulée, elle est détachée du cleaner et
  // repart dans le pool de l'admin. Localement on la retire du planning du cleaner
  // (elle ne lui appartient plus) en la basculant hors de sa vue.
  await patchCachedMission(p.userId, p.missionId, { status: 'pending', cleanerId: undefined, cleanerName: undefined });
  return { queued: true, error: null };
}

export async function submitExtraTime(p: { missionId: string; userId: string; minutes: number; reason?: string }): Promise<SubmitResult> {
  if (isOnline()) { const r = await requestExtraTimeDB({ missionId: p.missionId, userId: p.userId, minutes: p.minutes, reason: p.reason }); return { queued: false, error: r.error }; }
  await enqueue('extraTime', p.userId, p.missionId, { minutes: p.minutes, reason: p.reason ?? '' }, null);
  await patchCachedMission(p.userId, p.missionId, { extraTimeStatus: 'pending', extraTimeMinutes: p.minutes });
  return { queued: true, error: null };
}

// ── Rejeu ───────────────────────────────────────────────────────────────────

type Outcome = 'resolved' | 'rejected' | 'retry';

// Messages métier TERMINAUX par type : la mission a changé d'état entre-temps
// (déjà terminée/annulée…) → l'action est sans objet, on la retire sans erreur.
const RESOLVED_MESSAGES: Record<QueuedType, string[]> = {
  start: ['Action impossible sur cette mission.'],
  finish: ['Mission déjà clôturée.', 'Mission introuvable.'],
  deliver: ['Action impossible sur cette mission.'],
  withdraw: ['Désistement impossible sur cette mission.'],
  extraTime: ['Demande impossible sur cette mission.', 'Durée supplémentaire invalide.'],
  photo: [],
};

// Classe le résultat d'une mutation mission. tooFar / GPS manquant = rejet (à
// remonter au cleaner) ; message terminal connu = résolu ; sinon on retente.
function classifyMission(type: QueuedType, r: { error: string | null; tooFar?: boolean }, item: QueuedAction): Outcome {
  if (!r.error) return 'resolved';
  // GPS manquant ou trop loin, photos « après » absentes : seul le cleaner peut
  // y remédier — on le lui dit au lieu de retenter indéfiniment.
  if (r.tooFar || r.error === GPS_REQUIRED_ERROR || r.error === PHOTOS_REQUISES_ERROR) { item.error = r.error ?? undefined; return 'rejected'; }
  if (RESOLVED_MESSAGES[type].includes(r.error)) return 'resolved';
  item.error = r.error ?? undefined;
  return 'retry';
}

async function replayOne(item: QueuedAction): Promise<Outcome> {
  const coords = item.coords;
  const a = item.args as Record<string, any>;
  switch (item.type) {
    case 'start':
      return classifyMission('start', await startMissionDB(item.missionId, item.userId, coords, item.at), item);
    case 'finish':
      return classifyMission('finish', await finishMissionDB(item.missionId, item.userId, coords, item.at), item);
    case 'deliver':
      return classifyMission('deliver', await markDeliveredDB(item.missionId, item.userId, item.at), item);
    case 'withdraw':
      return classifyMission('withdraw', await withdrawMissionDB(item.missionId, item.userId), item);
    case 'extraTime':
      return classifyMission('extraTime', await requestExtraTimeDB({
        missionId: item.missionId, userId: item.userId, minutes: Number(a.minutes) || 0, reason: a.reason, at: item.at,
      }), item);
    case 'photo': {
      const blob = a.blob as Blob | undefined;
      if (!(blob instanceof Blob)) return 'resolved';   // élément illisible : rien à envoyer
      const fichier = new File([blob], String(a.name || 'photo.jpg'), { type: blob.type || 'image/jpeg' });
      const r = await uploadMissionPhotoDB({ missionId: item.missionId, kind: a.kind as MissionPhotoKind, file: fichier, userId: item.userId });
      if (!r.error) return 'resolved';
      item.error = r.error;
      // Limite atteinte, mission qui n'est plus la sienne : seul le cleaner peut trancher.
      if (/Limite atteinte|Accès refusé|introuvable/i.test(r.error)) return 'rejected';
      return 'retry';
    }
  }
}

let syncing = false;
let relancer = false;

// Draine la file dans l'ordre (FIFO). S'arrête au 1er échec transitoire (réseau)
// pour retenter plus tard ; les rejets métier n'interrompent pas le drain.
export async function syncQueue(): Promise<void> {
  if (!isOnline()) return;
  // Un drain est déjà en cours : on le relancera à sa fin, pour prendre les
  // éléments ajoutés entre-temps (une photo prise pendant un envoi).
  if (syncing) { relancer = true; return; }
  syncing = true;
  try {
    const items = await allQueued();
    for (const item of items) {
      if (item.status === 'rejected') continue; // en attente d'action du cleaner
      const outcome = await replayOne(item);
      if (outcome === 'resolved') {
        await removeQueued(item.id);
      } else if (outcome === 'rejected') {
        item.status = 'rejected';
        await putQueued(item);
      } else {
        item.attempts += 1;
        // Une PHOTO n'est jamais abandonnée : un réseau faible finit par passer.
        if (item.type !== 'photo' && item.attempts >= MAX_ATTEMPTS) {
          item.status = 'rejected';
          item.error = item.error ?? 'Synchronisation impossible.';
          await putQueued(item);
        } else {
          await putQueued(item);
          break; // probable coupure réseau → on réessaiera au prochain déclenchement
        }
      }
      notifyChange();
    }
  } finally {
    syncing = false;
    notifyChange();
  }
  if (relancer) { relancer = false; void syncQueue(); }
}

// ── Résumé & pilotage UI ─────────────────────────────────────────────────────

export interface QueueSummary { pending: number; rejected: number }

export async function queueSummary(): Promise<QueueSummary> {
  const items = await allQueued();
  return {
    pending: items.filter(i => i.status === 'pending').length,
    rejected: items.filter(i => i.status === 'rejected').length,
  };
}

// Le cleaner écarte les actions refusées (après les avoir refaites sur place).
export async function dismissRejected(): Promise<void> {
  const items = await allQueued();
  for (const i of items) if (i.status === 'rejected') await removeQueued(i.id);
  notifyChange();
}

let bound = false;

// À appeler au montage : lie l'auto-synchro au retour du réseau + tente un drain.
export function initOfflineSync(): void {
  if (typeof window === 'undefined') return;
  if (!bound) {
    bound = true;
    window.addEventListener('online', () => { void syncQueue(); });
    // Réseau faible : le téléphone se croit « en ligne », aucun évènement ne
    // relancerait l'envoi. On réessaie toutes les 30 s tant qu'il reste à faire.
    window.setInterval(async () => {
      if ((await allQueued()).some(i => i.status === 'pending')) void syncQueue();
    }, 30000);
  }
  void syncQueue();
}
