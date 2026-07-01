// ════════════════════════════════════════════════════════════════════════════
//  Cache hors-ligne local (IndexedDB) — SANS dépendance.
//  Sert de repli LECTURE quand le réseau est absent : l'app affiche la dernière
//  synchro connue (planning du cleaner) au lieu d'une page « Pas de connexion ».
//  Tout est best-effort : une panne d'IndexedDB ne doit JAMAIS bloquer l'app.
// ════════════════════════════════════════════════════════════════════════════

import type { Mission } from '@/lib/types';

const DB_NAME = 'moncleanerpro-offline';
const DB_VERSION = 1;
const STORE = 'kv';

// Ouverture paresseuse de la base. Rejette proprement si IndexedDB est indisponible
// (mode privé, navigateur ancien) → les appelants retombent sur le réseau.
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('IndexedDB indisponible')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
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
