// ── Jeton de session : signature/vérification (jose pur) ─────────────────────────
// AUCUNE dépendance à `next/headers` ici, pour que ce module soit importable
// depuis `proxy.ts` (où next/headers n'est pas disponible) ET depuis les routes.
// Les helpers de cookie vivent dans `session.ts`.

import { SignJWT, jwtVerify } from 'jose';
import type { Role } from './types';

export const SESSION_COOKIE = 'mcp_session';

// Données minimales et non sensibles portées par la session (pas de mot de passe).
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone?: string;
  isActive?: boolean;
}

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET manquant (signature de session).');
  return new TextEncoder().encode(secret);
}

export async function encryptSession(user: SessionUser): Promise<string> {
  return new SignJWT({ user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secretKey());
}

// Vérifie et décode un jeton de session. Renvoie null si invalide/expiré.
export async function decodeSession(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] });
    return (payload.user as SessionUser) ?? null;
  } catch {
    return null;
  }
}
