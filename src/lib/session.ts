// ── Gestion de session côté cookie (SERVEUR uniquement) ─────────────────────────
// Session « stateless » signée (JWT HS256) stockée dans un cookie httpOnly. C'est
// la source de vérité de l'authentification : le client ne peut pas la falsifier
// (signée côté serveur, illisible/inscriptible en JS). Remplace l'ancien
// `localStorage` qui laissait n'importe qui se déclarer admin.
//
// ⚠️ Importe `next/headers` → utilisable seulement dans routes/server actions/RSC,
// PAS dans proxy.ts (qui utilise sessionToken.ts directement).

import { cookies } from 'next/headers';
import { SESSION_COOKIE, encryptSession, decodeSession, type SessionUser } from './sessionToken';

const MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 jours

export type { SessionUser } from './sessionToken';

// Pose le cookie de session (route handler / server action uniquement).
export async function createSession(user: SessionUser): Promise<void> {
  const token = await encryptSession(user);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

// Lit l'utilisateur de la session courante depuis le cookie (côté serveur).
export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  return decodeSession(store.get(SESSION_COOKIE)?.value);
}

export async function deleteSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
