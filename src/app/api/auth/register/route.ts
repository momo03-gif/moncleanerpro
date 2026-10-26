// ── POST /api/auth/register ──────────────────────────────────────────────────────
// Inscription PUBLIQUE d'un partenaire (hôtel ou conciergerie/airbnb), en attente de
// validation admin. Déplacée côté serveur pour ne plus écrire dans `users` avec la
// clé publique. Compte créé en bcrypt et en statut 'pending'.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { hashPassword } from '@/lib/password';
import { notifyAdminsNouveauPrestataire } from '@/lib/notificationEvents';
import { specialitesValides, metierValide, vehiculesValides } from '@/lib/prestataireRegles';
import { normalizePhone } from '@/lib/phone';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 }); }

  const type = b.type;
  const email = (b.email ?? '').toLowerCase().trim();
  // Prestataire : il se connecte avec son TÉLÉPHONE ; son email est demandé aussi.
  const loginPhone = type === 'prestataire' ? normalizePhone(b.phone) : null;
  if ((type !== 'hotel' && type !== 'airbnb' && type !== 'prestataire') || !email || !b.password || !b.name) {
    return NextResponse.json({ error: 'Champs manquants.' }, { status: 400 });
  }
  if (type === 'prestataire' && !loginPhone) return NextResponse.json({ error: 'Numéro de téléphone invalide.' }, { status: 400 });
  if (!email.includes('@')) return NextResponse.json({ error: 'Email invalide.' }, { status: 400 });

  const metier = metierValide(b.metier);
  const specialites = specialitesValides(b.specialites, metier);
  if (type === 'prestataire' && !specialites.length) {
    return NextResponse.json({ error: 'Choisissez au moins une spécialité.' }, { status: 400 });
  }
  // Véhiculé ? Réponse obligatoire ; si oui, au moins un véhicule.
  const vehicules = b.vehicule === true ? vehiculesValides(b.vehicules) : [];
  if (type === 'prestataire' && (typeof b.vehicule !== 'boolean' || (b.vehicule && !vehicules.length))) {
    return NextResponse.json({ error: b.vehicule ? 'Indiquez votre ou vos véhicules.' : 'Dites-nous si vous êtes véhiculé.' }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  try {
    const hash = await hashPassword(b.password);
    const { data: user, error } = await db.from('users')
      .insert({
        email, password_hash: hash, role: type, name: b.name, phone: b.phone ?? null, status: 'pending',
        ...(loginPhone ? { login_phone: loginPhone } : {}),
      })
      .select('id').single();
    if (error || !user) {
      const msg = /login_phone/i.test(error?.message ?? '') ? 'Un compte existe déjà avec ce numéro.'
        : /duplicate|unique/i.test(error?.message ?? '') ? 'Un compte existe déjà avec cet email.'
        : (error?.message ?? 'Création impossible.');
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    if (type === 'prestataire') {
      // Sous-traitant : la demande attend la validation de l'admin, qui fixe
      // alors son taux horaire. « En attente » = users.status 'pending'
      // (cf. /api/auth/login) — la fiche, elle, n'a pas de taux tant que ce
      // n'est pas validé.
      const { data: pr, error: pErr } = await db.from('prestataires').insert({
        user_id: user.id, name: b.name, email, phone: b.phone ?? null,
        contact_name: b.contactName ?? null, siret: b.siret ?? null, hourly_rate: 0, status: 'active',
      }).select('id').single();
      if (pErr || !pr) {
        await db.from('users').delete().eq('id', user.id);
        console.error('register/prestataire:', pErr?.message);
        return NextResponse.json({ error: 'Inscription impossible pour le moment.' }, { status: 500 });
      }
      // Best-effort : sans effet si les migrations specialites / metier / vehicules ne sont pas passées.
      await db.from('prestataires').update({ specialites, metier, vehicules }).eq('id', pr.id);
      await notifyAdminsNouveauPrestataire(b.name);
    } else if (type === 'hotel') {
      const { data: h, error: hErr } = await db.from('hotels').insert({
        user_id: user.id, hotel_name: b.name, address: b.address ?? null, email: b.email, phone: b.phone ?? null, status_account: 'pending',
      }).select('id').single();
      if (hErr) return NextResponse.json({ error: hErr.message }, { status: 400 });
      // Type de client (hôtel / EHPAD). Best-effort : sans effet si la colonne
      // client_type n'existe pas encore (le compte reste « hôtel » par défaut).
      if (h && b.clientType === 'ehpad') {
        await db.from('hotels').update({ client_type: 'ehpad' }).eq('id', h.id);
      }
    } else {
      const { error: pErr } = await db.from('airbnb_partners').insert({
        user_id: user.id, partner_name: b.name, email: b.email, phone: b.phone ?? null, status_account: 'pending',
      });
      if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Erreur serveur.' }, { status: 500 });
  }
}
