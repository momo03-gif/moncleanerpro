// ── proxy.ts (ex-middleware) — garde de routes CÔTÉ SERVEUR ──────────────────────
// Dans Next 16, `middleware` est renommé `proxy` (runtime Node par défaut). Ce
// garde s'exécute avant le rendu et empêche tout accès à un espace réservé sans la
// session/rôle adéquat — contrairement aux gardes client (layouts) qui se
// contournent depuis la console. Vérification « optimiste » : on lit uniquement le
// cookie signé (pas de requête DB ici).

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decodeSession, SESSION_COOKIE } from '@/lib/sessionToken';
import type { Role } from '@/lib/types';

// Préfixe d'URL → rôle requis.
const PROTECTED: { prefix: string; role: Role }[] = [
  { prefix: '/admin', role: 'admin' },
  { prefix: '/cleaner', role: 'cleaner' },
  { prefix: '/hotel', role: 'hotel' },
  { prefix: '/airbnb', role: 'airbnb' },
];

function homeForRole(role: Role): string {
  return role === 'admin' ? '/admin'
    : role === 'cleaner' ? '/cleaner'
    : role === 'airbnb' ? '/airbnb/accueil'
    : '/hotel';
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const match = PROTECTED.find(p => pathname === p.prefix || pathname.startsWith(p.prefix + '/'));
  if (!match) return NextResponse.next();

  const user = await decodeSession(req.cookies.get(SESSION_COOKIE)?.value);

  // Pas de session valide → vers la connexion.
  if (!user) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  // Connecté mais mauvais espace → renvoyé vers le sien.
  if (user.role !== match.role) {
    return NextResponse.redirect(new URL(homeForRole(user.role), req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/admin', '/admin/:path*',
    '/cleaner', '/cleaner/:path*',
    '/hotel', '/hotel/:path*',
    '/airbnb', '/airbnb/:path*',
  ],
};
