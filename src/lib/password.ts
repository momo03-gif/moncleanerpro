// ── Hachage des mots de passe (SERVEUR uniquement) ──────────────────────────────
// bcrypt (salé, lent par design) remplace l'ancien SHA-256 sans sel. La fonction
// verifyPassword sait encore lire un ancien hash SHA-256 et signale qu'il faut le
// re-hacher : c'est ce qui permet la MIGRATION TRANSPARENTE des comptes existants
// (aucun reset forcé — le mot de passe est ré-haché en bcrypt à la 1re connexion).
//
// ⚠️ À n'importer que depuis du code serveur (routes /api/auth). Jamais côté client.

import bcrypt from 'bcryptjs';
import { createHash } from 'crypto';

const BCRYPT_ROUNDS = 12;

// Un hash bcrypt commence toujours par $2a$ / $2b$ / $2y$.
export function isBcryptHash(stored: string | null | undefined): boolean {
  return typeof stored === 'string' && /^\$2[aby]\$/.test(stored);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

// Ancien schéma : SHA-256 hex sans sel (à n'utiliser que pour vérifier l'existant).
function legacySha256(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

// Vérifie un mot de passe contre le hash stocké, quel que soit son format.
// needsRehash=true quand le hash est l'ancien SHA-256 et qu'il faut le migrer.
export async function verifyPassword(
  password: string,
  stored: string | null | undefined,
): Promise<{ ok: boolean; needsRehash: boolean }> {
  if (!stored) return { ok: false, needsRehash: false };
  if (isBcryptHash(stored)) {
    return { ok: await bcrypt.compare(password, stored), needsRehash: false };
  }
  const ok = legacySha256(password) === stored;
  return { ok, needsRehash: ok };
}
