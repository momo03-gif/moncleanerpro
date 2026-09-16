// ── POST /api/account/delete — suppression de compte par l'utilisateur ───────────
//
//  EXIGENCE DES STORES, PAS UN CONFORT
//  Apple (règle 5.1.1(v)) et Google Play imposent que tout compte créé dans
//  l'application puisse être supprimé DEPUIS l'application, sans passer par un
//  email ou un formulaire externe. Une app sans ce bouton est rejetée.
//
//  ANONYMISATION PLUTÔT QUE SUPPRESSION DE LA LIGNE
//  Les clés étrangères vers `users` sont en ON DELETE CASCADE : supprimer la
//  ligne effacerait aussi les missions, factures et bulletins de paie qui y sont
//  rattachés. Or ces documents sont soumis à des durées de conservation légales
//  (facturation : 10 ans ; paie : 5 ans) et engagent d'autres personnes que le
//  titulaire du compte. On efface donc TOUTES les données personnelles et on
//  neutralise l'accès — l'historique comptable reste cohérent, mais plus rien
//  n'y est nominatif. C'est la lecture retenue par le RGPD (art. 17.3 e).

import { NextResponse } from 'next/server';
import { getSessionUser, deleteSession } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { hashPassword, verifyPassword } from '@/lib/password';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

const ANON_NAME = 'Compte supprimé';

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });

  let b: { password?: string; reason?: string; from?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 }); }

  const password = b.password ?? '';
  if (!password) {
    return NextResponse.json({ error: 'Mot de passe requis pour confirmer.' }, { status: 400 });
  }

  const db = getSupabaseAdmin();

  // 1) Confirmation par mot de passe : un téléphone laissé déverrouillé sur un
  //    chantier ne doit pas suffire à effacer un compte.
  const { data: row } = await db
    .from('users')
    .select('id, role, password_hash, deleted_at')
    .eq('id', session.id)
    .single();

  if (!row || row.deleted_at) {
    return NextResponse.json({ error: 'Compte introuvable.' }, { status: 404 });
  }

  const { ok } = await verifyPassword(password, row.password_hash);
  if (!ok) return NextResponse.json({ error: 'Mot de passe incorrect.' }, { status: 403 });

  // 2) Garde-fou : le dernier administrateur actif ne peut pas se supprimer,
  //    sinon plus personne ne peut piloter l'entreprise ni rouvrir un compte.
  if (row.role === 'admin') {
    const { count } = await db
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin')
      .eq('status', 'active')
      .is('deleted_at', null)
      .neq('id', row.id);
    if (!count) {
      return NextResponse.json(
        { error: "Ce compte est le dernier administrateur : créez-en un autre avant de le supprimer." },
        { status: 409 },
      );
    }
  }

  // 3) Anonymisation du compte lui-même. L'email doit rester unique (contrainte
  //    UNIQUE) et redevenir disponible pour une future inscription : on le
  //    remplace par une adresse technique inutilisable.
  const filler = await hashPassword(randomUUID() + randomUUID());
  await db.from('users').update({
    email: `supprime+${row.id}@moncleanerpro.fr`,
    name: ANON_NAME,
    phone: null,
    status: 'inactive',
    password_hash: filler,
    deleted_at: new Date().toISOString(),
  }).eq('id', row.id);

  // 4) Fiches métier rattachées (best-effort : une table absente ne doit pas
  //    interrompre une suppression déjà engagée).
  const scrub = async (table: string, values: Record<string, unknown>) => {
    try { await db.from(table).update(values).eq('user_id', row.id); } catch { /* table absente */ }
  };
  if (row.role === 'hotel') {
    await scrub('hotels', { hotel_name: ANON_NAME, email: null, phone: null, address: null });
  } else if (row.role === 'airbnb') {
    await scrub('airbnb_partners', { partner_name: ANON_NAME, email: null, phone: null });
  } else if (row.role === 'cleaner') {
    await scrub('cleaners', { name: ANON_NAME, email: null, phone: null, status: 'inactive' });
  }

  // 5) Canaux de notification : plus aucun message ne doit partir vers cet
  //    appareil ou cette adresse.
  await db.from('push_subscriptions').delete().eq('user_id', row.id);
  try { await db.from('native_push_tokens').delete().eq('user_id', row.id); } catch { /* migration non passée */ }
  await db.from('notifications').delete().eq('user_id', row.id);

  // 6) Preuve de traitement (sans donnée personnelle) : exigée en cas de
  //    réclamation RGPD comme en cas de contrôle Apple/Google.
  try {
    await db.from('account_deletions').insert({
      user_id: row.id,
      role: row.role,
      reason: (b.reason ?? '').slice(0, 500) || null,
      requested_from: b.from ?? 'web',
    });
  } catch { /* migration non passée */ }

  await deleteSession();
  return NextResponse.json({ ok: true });
}
