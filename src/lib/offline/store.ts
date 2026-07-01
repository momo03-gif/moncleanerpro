// ════════════════════════════════════════════════════════════════════════════
//  Cache hors-ligne local (IndexedDB) — SANS dépendance.
//  Sert de repli LECTURE quand le réseau est absent : l'app affiche la dernière
//  synchro connue (planning du cleaner) au lieu d'une page « Pas de connexion ».
//  Tout est best-effort : une panne d'IndexedDB ne doit JAMAIS bloquer l'app.
// ════════════════════════════════════════════════════════════════════════════

import type { Mission } from '@/lib/types';

const DB_NAME = 'moncleanerpro-offline';
const DB_VERSION = 2;
const STORE = 'kv';          // cache clé/valeur (planning)
const QUEUE = 'queue';       // file d'actions à rejouer à la reconnexion

// Ouverture paresseuse de la base. Rejette proprement si IndexedDB est indisponible
// (mode privé, navigateur ancien) → les appelants retombent sur le réseau.
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB indisponible')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      if (!db.objectStoreNames.contains(QUEUE)) db.createObjectStore(QUEUE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDB();
  try {
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error);
    });
  } finally { db.close(); }
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally { db.close(); }
}

// ── Cache du planning cleaner ───────────────────────────────────────────────

export interface CachedMissions {
  missions: Mission[];
  // Horodatage de la dernière synchro réussie (ISO) → affiché dans le bandeau.
  syncedAt: string;
}

const missionsKey = (userId: string) => `missions:${userId}`;

// Enregistre le dernier planning récupéré en ligne, horodaté. Best-effort.
export async function cacheMissions(userId: string, missions: Mission[]): Promise<void> {
  try {
    await idbSet(missionsKey(userId), { missions, syncedAt: new Date().toISOString() } satisfies CachedMissions);
  } catch {
    // Pas de blocage : un échec d'écriture du cache est sans conséquence fonctionnelle.
  }
}

// Relit le dernier planning connu (null si aucun / IndexedDB indisponible).
export async function readCachedMissions(userId: string): Promise<CachedMissions | null> {
  try {
    return (await idbGet<CachedMissions>(missionsKey(userId))) ?? null;
  } catch {
    return null;
  }
}

// Applique un correctif optimiste à une mission du cache local (statut, temps supp.)
// pour que l'app reflète immédiatement une action faite hors-ligne, avant sa synchro.
export async function patchCachedMission(
  userId: string, missionId: string, patch: Partial<Mission>,
): Promise<void> {
  try {
    const cached = await readCachedMissions(userId);
    if (!cached) return;
    const missions = cached.missions.map(m => (m.id === missionId ? { ...m, ...patch } : m));
    await idbSet(missionsKey(userId), { ...cached, missions } satisfies CachedMissions);
  } catch {
    // best-effort
  }
}

// ── File d'actions hors-ligne (rejouées à la reconnexion) ────────────────────

// Type d'action cleaner rejouable. `at` = horodatage capturé AU MOMENT de l'action
// (rejoué tel quel côté serveur pour un pointage exact) ; `coords` = position GPS
// capturée sur place (revalidée à la reco : proximité ≤ 200 m).
export type QueuedType = 'start' | 'finish' | 'deliver' | 'withdraw' | 'extraTime';

export interface QueuedAction {
  id: string;                 // uuid — sert aussi de clé d'idempotence
  userId: string;             // propriétaire (cleaner users.id)
  type: QueuedType;
  missionId: string;
  args: Record<string, unknown>;
  at: string;                 // ISO — horodatage de l'action
  coords: { lat: number; lng: number } | null;
  status: 'pending' | 'rejected';
  error?: string;             // dernier motif de rejet (affiché au cleaner)
  attempts: number;
  createdAt: string;
}

export async function addQueued(a: QueuedAction): Promise<void> {
  const db = await openDB();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(QUEUE, 'readwrite');
      tx.objectStore(QUEUE).put(a);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally { db.close(); }
}

export const putQueued = addQueued; // même sémantique (put) pour une mise à jour

export async function allQueued(): Promise<QueuedAction[]> {
  try {
    const db = await openDB();
    try {
      const rows = await new Promise<QueuedAction[]>((resolve, reject) => {
        const tx = db.transaction(QUEUE, 'readonly');
        const req = tx.objectStore(QUEUE).getAll();
        req.onsuccess = () => resolve((req.result as QueuedAction[]) ?? []);
        req.onerror = () => reject(req.error);
      });
      // FIFO : l'ordre de création garantit start avant finish sur une même mission.
      return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    } finally { db.close(); }
  } catch {
    return [];
  }
}

export async function removeQueued(id: string): Promise<void> {
  try {
    const db = await openDB();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(QUEUE, 'readwrite');
        tx.objectStore(QUEUE).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } finally { db.close(); }
  } catch {
    // best-effort
  }
}
