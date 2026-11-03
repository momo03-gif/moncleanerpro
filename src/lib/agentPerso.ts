// ── L'agent « moi-même » d'un prestataire (serveur uniquement) ──────────────
//
// Un indépendant fait souvent ses missions lui-même. Plutôt que de lui faire
// créer un second compte (autre email, autre téléphone), on lui tient une fiche
// agent PERSONNELLE, invisible et sans mot de passe utilisable :
//   · il se choisit « Moi-même » quand il attribue une mission ;
//   · « Passer en mode terrain » ouvre l'appli cleaner sur cette fiche, et
//     « Retour à mon espace prestataire » le ramène — un seul identifiant.
//
// La fiche se reconnaît à son adresse interne, réservée et jamais délivrée
// (`.invalid`, RFC 2606) : aucune migration, et impossible à usurper — seul le
// serveur crée des comptes à cette adresse.

import { randomUUID } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hashPassword } from './password';

const DOMAINE = 'agent.invalid';

export function emailAgentPerso(prestataireId: string): string {
  return `prestataire-${prestataireId}@${DOMAINE}`;
}

/** L'identifiant du prestataire dont ce compte est l'agent personnel, sinon null. */
export function prestataireDeAgentPerso(email: string | null | undefined): string | null {
  const m = (email ?? '').toLowerCase().match(/^prestataire-([0-9a-f-]{36})@agent\.invalid$/);
  return m ? m[1] : null;
}

export interface AgentPerso { cleanerId: string; userId: string; name: string; email: string }

/** La fiche agent personnelle, si elle existe déjà. */
export async function lireAgentPerso(db: SupabaseClient, prestataireId: string): Promise<AgentPerso | null> {
  const email = emailAgentPerso(prestataireId);
  const { data } = await db.from('cleaners').select('id, user_id, name').eq('email', email).eq('prestataire_id', prestataireId).maybeSingle();
  return data ? { cleanerId: data.id as string, userId: data.user_id as string, name: data.name as string, email } : null;
}

/** La fiche agent personnelle, créée au premier besoin. */
export async function assurerAgentPerso(
  db: SupabaseClient,
  pr: { id: string; name: string; contact_name?: string | null; phone?: string | null },
): Promise<AgentPerso | { erreur: string }> {
  const deja = await lireAgentPerso(db, pr.id);
  if (deja) return deja;
  const email = emailAgentPerso(pr.id);
  const name = (pr.contact_name || pr.name || 'Moi-même').trim();
  // Compte de connexion : mot de passe aléatoire jamais communiqué — on n'y
  // entre que par « Passer en mode terrain ».
  const { data: compte, error } = await db.from('users').insert({
    email, password_hash: await hashPassword(randomUUID()), role: 'cleaner',
    name, phone: pr.phone ?? null, status: 'active',
  }).select('id').single();
  if (error || !compte) {
    // Créé entre-temps par un autre onglet : on le relit.
    const relu = await lireAgentPerso(db, pr.id);
    return relu ?? { erreur: 'Impossible de préparer votre fiche terrain.' };
  }
  const { data: fiche, error: e2 } = await db.from('cleaners').insert({
    user_id: compte.id, name, email, phone: pr.phone ?? null,
    hourly_rate: 0, delivery_rate: 0, can_clean: true, can_deliver: false,
    status: 'active', prestataire_id: pr.id,
  }).select('id').single();
  if (e2 || !fiche) {
    await db.from('users').delete().eq('id', compte.id);   // pas de compte orphelin
    console.error('assurerAgentPerso:', e2?.message);
    return { erreur: 'Impossible de préparer votre fiche terrain.' };
  }
  return { cleanerId: fiche.id as string, userId: compte.id as string, name, email };
}
