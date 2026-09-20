// ── Qui a le droit d'appeler une route (SERVEUR uniquement) ─────────────────
//
// Les routes `/api/admin/*` ont été écrites pour protéger des données : elles
// lisent en `service_role`, donc elles traversent tous les droits de la base.
// C'était l'intention — « les données RH ne sont jamais lues depuis le
// navigateur ». Mais plusieurs d'entre elles ne vérifiaient JAMAIS qui appelait.
// Résultat : la paie, les incidents et les scores RH des cleaners répondaient à
// n'importe quelle requête venue d'internet.
//
// Une route qui écrit en service_role DOIT vérifier son appelant. Ce fichier
// donne le geste en une ligne, pour qu'on n'ait plus d'excuse de l'oublier.

import { NextResponse } from 'next/server';
import { getSessionUser } from './session';

export interface Appelant {
  id: string;
  role: string;
  name?: string;
}

type Refus = NextResponse<{ error: string }>;

/**
 * Exige une session valide, et éventuellement un rôle précis.
 *
 *   const { refus, appelant } = await exigerSession(['admin']);
 *   if (refus) return refus;
 *
 * Renvoie 401 sans session, 403 avec un rôle insuffisant — jamais de détail sur
 * ce qui existe derrière.
 */
export async function exigerSession(
  roles?: string[],
): Promise<{ refus: Refus | null; appelant: Appelant | null }> {
  const session = await getSessionUser();
  if (!session) {
    return { refus: NextResponse.json({ error: 'Non authentifié.' }, { status: 401 }), appelant: null };
  }
  if (roles && roles.length > 0 && !roles.includes(session.role)) {
    return { refus: NextResponse.json({ error: 'Accès refusé.' }, { status: 403 }), appelant: null };
  }
  return { refus: null, appelant: { id: session.id, role: session.role, name: session.name } };
}

/** Raccourci pour les routes d'administration. */
export function exigerAdmin() {
  return exigerSession(['admin']);
}

/**
 * Appel interne de serveur à serveur (les crons, les notifications déclenchées
 * par une autre route). Authentifié par CRON_SECRET, pas par une session.
 * Accepte aussi une session admin, pour pouvoir déclencher à la main.
 */
export async function exigerInterne(req: Request): Promise<{ refus: Refus | null }> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const entete = req.headers.get('authorization');
    if (entete === `Bearer ${secret}`) return { refus: null };
  }
  const { refus } = await exigerSession(['admin']);
  return { refus };
}
