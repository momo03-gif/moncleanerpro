// ── /api/prestataire ─────────────────────────────────────────────────────────
// Sous-traitance. Deux publics, une seule route, tout en service_role :
//
//   · L'ADMIN gère les prestataires (création, taux horaire, suspension) et
//     leur CONFIE des missions — ou les leur reprend.
//   · Le PRESTATAIRE gère SES agents (comptes cleaner rattachés à lui) et
//     donne chaque mission confiée à l'un d'eux.
//
// L'identité vient de la session signée, jamais du corps de la requête. Un
// prestataire n'agit que sur SES agents et SES missions : chaque opération le
// revérifie en base.
//
// Ce qu'on doit au prestataire = son taux × durée, figé au moment où on lui
// confie la mission (cf. lib/prestataireRegles.ts). Ses agents ne sont pas
// payés par nous : leur cleaner_gain reste à 0.

import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionUser, createSession } from '@/lib/session';
import { assurerAgentPerso, lireAgentPerso, emailAgentPerso } from '@/lib/agentPerso';
import { chargerPrestataireConfiable, confierUneMission, notifierConfiees, attribuerAuPrestataireSeul } from '@/lib/prestataireConfier';
import { normalizePhone } from '@/lib/phone';
import { hashPassword } from '@/lib/password';
import { attribuable, releveDuMois, CREDIT_IMPOT_REFUS, etatVigilance, specialitesValides, metierValide, vehiculesValides, type Metier } from '@/lib/prestataireRegles';
import {
  notifyCleanerNewMission, notifyCleanerMissionUnassigned,
  notifyPrestataireMissionReprise, notifyPrestatairePaiement,
} from '@/lib/notificationEvents';
import { aujourdhuiParis, moisParis, dansJoursParis } from '@/lib/dateParis';

export const runtime = 'nodejs';

type Corps = Record<string, unknown>;
const ok = (body: Record<string, unknown> = {}) => NextResponse.json({ ok: true, ...body });
const ko = (error: string, status = 400) => NextResponse.json({ error }, { status });
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const MDP_MIN = 6;

const PRESTATAIRE_COLONNES = 'id, user_id, name, contact_name, email, phone, siret, hourly_rate, status, sap_declare, created_at, '
  + 'specialites, metier, vehicules';

async function lirePrestataires(db: SupabaseClient, filtre?: { userId: string }) {
  const q = db.from('prestataires').select(PRESTATAIRE_COLONNES);
  return filtre ? q.eq('user_id', filtre.userId) : q.order('name');
}

/** Demande d'inscription pas encore validée : le compte de connexion est 'pending'. */
async function enAttente(db: SupabaseClient, userId: unknown): Promise<boolean> {
  const { data } = await db.from('users').select('status').eq('id', userId).maybeSingle();
  return data?.status === 'pending';
}
const AGENT_COLONNES = 'id, user_id, name, email, phone, status, created_at';

/** 'YYYY-MM' du mois courant, à Paris. */
const moisCourant = moisParis;

/** Bornes [début, fin[ d'un mois 'YYYY-MM'. */
function bornes(periode: string): [string, string] {
  const [a, m] = periode.split('-').map(Number);
  const fin = m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, '0')}-01`;
  return [`${periode}-01`, fin];
}

/** Crée un compte `users` ; renvoie son id ou un message d'erreur lisible. */
async function creerCompte(db: SupabaseClient, f: {
  email: string; password: string; name: string; phone?: string; role: string;
  /** Téléphone normalisé servant d'identifiant de connexion (prestataires). */
  loginPhone?: string | null;
}) {
  const { data, error } = await db.from('users').insert({
    email: f.email, password_hash: await hashPassword(f.password), role: f.role,
    name: f.name, phone: f.phone ?? null, status: 'active',
    ...(f.loginPhone ? { login_phone: f.loginPhone } : {}),
  }).select('id').single();
  if (error || !data) {
    const msg = error?.message ?? '';
    return { error: /login_phone/i.test(msg) ? 'Un compte existe déjà avec ce numéro.'
      : /duplicate|unique/i.test(msg) ? 'Un compte existe déjà avec cet email.' : 'Création impossible.' };
  }
  return { id: data.id as string };
}

const DOCS_BUCKET = 'prestataire_docs';
const TYPES_DOC = ['urssaf', 'kbis', 'assurance', 'autre'];

/** Documents d'un prestataire, avec un lien de lecture signé (1 h) et l'état de vigilance. */
async function documents(db: SupabaseClient, prestataireId: string) {
  const { data } = await db.from('prestataire_documents')
    .select('id, kind, storage_path, file_name, delivered_on, uploaded_at')
    .eq('prestataire_id', prestataireId).order('uploaded_at', { ascending: false });
  const docs = await Promise.all((data ?? []).map(async d => {
    const { data: s } = await db.storage.from(DOCS_BUCKET).createSignedUrl(d.storage_path as string, 3600);
    return { id: d.id, kind: d.kind, fileName: d.file_name, deliveredOn: d.delivered_on, uploadedAt: d.uploaded_at, url: s?.signedUrl ?? null };
  }));
  return { documents: docs, vigilance: etatVigilance(data ?? [], aujourdhuiParis()) };
}

/** Enregistre un document déposé (le fichier est déjà dans la réserve, sous le dossier du prestataire). */
async function ajouterDocument(db: SupabaseClient, prestataireId: string, b: Corps) {
  const path = str(b.path), kind = str(b.kind);
  if (!path || !kind || !TYPES_DOC.includes(kind)) return ko('Document incomplet.');
  if (!path.startsWith(`${prestataireId}/`) || path.includes('..')) return ko('Chemin de document invalide.');
  const livre = str(b.deliveredOn);
  if (livre && !/^\d{4}-\d{2}-\d{2}$/.test(livre)) return ko('Date de délivrance invalide.');
  const { error } = await db.from('prestataire_documents').insert({
    prestataire_id: prestataireId, kind, storage_path: path,
    file_name: str(b.fileName)?.slice(0, 200) ?? null, delivered_on: livre ?? null,
  });
  if (error) { console.error('prestataire/doc-add:', error.message); return ko('Enregistrement impossible.', 500); }
  return ok();
}

async function supprimerDocument(db: SupabaseClient, prestataireId: string, docId: string | undefined) {
  if (!docId) return ko('Document manquant.');
  const { data: d } = await db.from('prestataire_documents').select('storage_path, prestataire_id').eq('id', docId).maybeSingle();
  if (!d || d.prestataire_id !== prestataireId) return ko('Document introuvable.', 404);
  await db.storage.from(DOCS_BUCKET).remove([d.storage_path as string]);
  await db.from('prestataire_documents').delete().eq('id', docId);
  return ok();
}

/** Relevé d'un mois pour un prestataire : missions terminées et montant dû. */
async function releve(db: SupabaseClient, prestataireId: string, periode: string) {
  const [debut, fin] = bornes(periode);
  const { data, error } = await db.from('missions')
    .select('id, status, date_from, time_from, property_name, cleaner_name, mission_duration_minutes, prestataire_gain, airbnbs(name)')
    .eq('prestataire_id', prestataireId).gte('date_from', debut).lt('date_from', fin)
    .order('date_from');
  if (error) throw new Error(error.message);
  const lignes = data ?? [];
  const { data: paiement } = await db.from('prestataire_paiements')
    .select('montant, paid_at, note').eq('prestataire_id', prestataireId).eq('periode', periode).maybeSingle();
  return {
    periode,
    ...releveDuMois(lignes, periode),
    paiement: paiement ? { montant: Number(paiement.montant) || 0, paidAt: paiement.paid_at as string, note: (paiement.note as string | null) ?? null } : null,
    lignes: lignes.filter(l => l.status === 'done').map(l => ({
      id: l.id, date: l.date_from, time: (l.time_from ?? '').slice(0, 5),
      lieu: (l.airbnbs as { name?: string } | null)?.name || l.property_name || 'Mission',
      agent: l.cleaner_name ?? null,
      minutes: Number(l.mission_duration_minutes) || 0,
      montant: Number(l.prestataire_gain) || 0,
    })),
  };
}

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return ko('Non authentifié.', 401);
  let b: Corps;
  try { b = await req.json(); } catch { return ko('Requête invalide.'); }
  const db = getSupabaseAdmin();
  const op = String(b.op ?? '');

  try {
    if (session.role === 'admin') return await opAdmin(db, op, b);
    if (session.role === 'prestataire') {
      const { data: lignes } = await lirePrestataires(db, { userId: session.id });
      const moi = (lignes?.[0] ?? null) as Record<string, unknown> | null;
      if (!moi) return ko('Compte prestataire introuvable.', 403);
      if (moi.status !== 'active') return ko('Compte suspendu. Contactez MonCleanerPro.', 403);
      if (await enAttente(db, session.id)) return ko('Compte en attente de validation.', 403);
      return await opPrestataire(db, op, b, moi as unknown as Record<string, unknown>);
    }
    return ko('Accès refusé.', 403);
  } catch (e) {
    console.error(`prestataire/${op}:`, (e as Error).message);
    return ko('Erreur serveur.', 500);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  ADMIN
// ══════════════════════════════════════════════════════════════════════════════
async function opAdmin(db: SupabaseClient, op: string, b: Corps) {
  switch (op) {
    case 'list': {
      const { data: lues, error } = await lirePrestataires(db);
      const data = lues as Record<string, unknown>[] | null;
      if (error) return ko('Lecture impossible.', 500);
      const ids = (data ?? []).map(p => p.id as string);
      // Demandes d'inscription en attente (compte de connexion 'pending').
      const userIds = (data ?? []).map(p => p.user_id as string).filter(Boolean);
      const { data: comptes } = userIds.length
        ? await db.from('users').select('id, status').in('id', userIds)
        : { data: [] as { id: string; status: string }[] };
      const attente = new Set((comptes ?? []).filter(c => c.status === 'pending').map(c => c.id));
      const { data: docs } = ids.length
        ? await db.from('prestataire_documents').select('prestataire_id, kind, delivered_on, uploaded_at').in('prestataire_id', ids)
        : { data: [] as { prestataire_id: string; kind: string; delivered_on: string | null; uploaded_at: string }[] };
      const jour = aujourdhuiParis();
      // Nombre d'agents et dû du mois, pour la liste.
      const { data: agents } = ids.length
        ? await db.from('cleaners').select('prestataire_id, status').in('prestataire_id', ids)
        : { data: [] as { prestataire_id: string; status: string }[] };
      const periode = moisCourant();
      const [debut, fin] = bornes(periode);
      const { data: faites } = ids.length
        ? await db.from('missions').select('prestataire_id, status, date_from, prestataire_gain, mission_duration_minutes')
          .in('prestataire_id', ids).gte('date_from', debut).lt('date_from', fin)
        : { data: [] as Record<string, unknown>[] };
      return ok({
        periode,
        prestataires: (data ?? []).map(p => ({
          ...p,
          en_attente: attente.has(p.user_id as string),
          vigilance_ok: etatVigilance((docs ?? []).filter(d => d.prestataire_id === p.id), jour).aJour,
          agents: (agents ?? []).filter(a => a.prestataire_id === p.id && a.status === 'active').length,
          duMois: releveDuMois((faites ?? []).filter(m => m.prestataire_id === p.id) as never, periode).montant,
        })),
      });
    }

    case 'create': {
      const name = str(b.name), email = str(b.email)?.toLowerCase(), password = str(b.password);
      // Il se connecte avec son téléphone ; son email est demandé aussi.
      const loginPhone = normalizePhone(str(b.phone));
      if (!name || !email || !loginPhone) return ko('Nom, téléphone et email obligatoires.');
      if (!password || password.length < MDP_MIN) return ko(`Mot de passe : ${MDP_MIN} caractères minimum.`);
      const compte = await creerCompte(db, { email, password, name, phone: str(b.phone), role: 'prestataire', loginPhone });
      if (compte.error) return ko(compte.error);
      const { data: cree, error } = await db.from('prestataires').insert({
        user_id: compte.id, name, email, phone: str(b.phone) ?? null,
        contact_name: str(b.contactName) ?? null, siret: str(b.siret) ?? null,
        hourly_rate: Math.max(0, Number(b.hourlyRate) || 0), status: 'active',
      }).select('id').single();
      if (error) {
        await db.from('users').delete().eq('id', compte.id);   // pas de compte orphelin
        console.error('prestataire/create:', error.message);
        return ko('Création impossible.', 500);
      }
      const metier = metierValide(b.metier);
      if (cree) await db.from('prestataires').update({
        metier, specialites: specialitesValides(b.specialites, metier),
        ...(Array.isArray(b.vehicules) ? { vehicules: vehiculesValides(b.vehicules) } : {}),
      }).eq('id', cree.id);
      return ok();
    }

    case 'update': {
      const id = str(b.id);
      if (!id) return ko('Prestataire manquant.');
      const patch: Record<string, unknown> = {};
      if (b.name !== undefined) { const n = str(b.name); if (!n) return ko('Le nom est obligatoire.'); patch.name = n; }
      if (b.contactName !== undefined) patch.contact_name = str(b.contactName) ?? null;
      if (b.phone !== undefined) {
        // Le téléphone est l'identifiant de connexion : jamais vide ni illisible.
        if (!normalizePhone(str(b.phone))) return ko('Numéro de téléphone invalide.');
        patch.phone = str(b.phone);
      }
      if (b.siret !== undefined) patch.siret = str(b.siret) ?? null;
      if (b.email !== undefined) {
        const e = str(b.email)?.toLowerCase();
        if (!e || !e.includes('@')) return ko('Email invalide.');
        patch.email = e;
      }
      // Le nouveau taux vaut pour les missions confiées À PARTIR DE MAINTENANT.
      if (b.hourlyRate !== undefined) patch.hourly_rate = Math.max(0, Number(b.hourlyRate) || 0);
      if (b.sapDeclare !== undefined) patch.sap_declare = b.sapDeclare === true;
      if (b.metier !== undefined) patch.metier = metierValide(b.metier);
      // [] = pas véhiculé ; null = on ne sait pas.
      if (b.vehicules !== undefined) patch.vehicules = b.vehicules === null ? null : vehiculesValides(b.vehicules);
      if (b.specialites !== undefined) patch.specialites = specialitesValides(b.specialites, patch.metier as Metier | undefined);
      if (b.status !== undefined) {
        if (b.status !== 'active' && b.status !== 'suspended') return ko('Statut invalide.');
        patch.status = b.status;
      }
      const { data, error } = await db.from('prestataires').update(patch).eq('id', id).select('user_id').maybeSingle();
      if (error || !data) return ko('Enregistrement impossible.', 500);
      // Le compte de connexion suit le nom / l'email / le téléphone.
      const compte: Record<string, unknown> = {};
      if (patch.name) compte.name = patch.name;
      if (patch.email) compte.email = patch.email;
      if (b.phone !== undefined) { compte.phone = patch.phone; compte.login_phone = normalizePhone(patch.phone as string); }
      if (Object.keys(compte).length) {
        const { error: uErr } = await db.from('users').update(compte).eq('id', data.user_id);
        if (uErr) return ko(/login_phone/i.test(uErr.message) ? 'Un compte existe déjà avec ce numéro.'
          : /duplicate|unique/i.test(uErr.message) ? 'Un compte existe déjà avec cet email.' : 'Enregistrement impossible.');
      }
      return ok();
    }

    // ── Demande d'inscription : valider (avec son taux) ou refuser ──
    case 'approve': {
      const id = str(b.id);
      const taux = Number(b.hourlyRate);
      if (!id) return ko('Prestataire manquant.');
      if (!(taux > 0)) return ko('Indiquez le taux horaire payé au prestataire.');
      const { data: pr } = await db.from('prestataires').select('user_id').eq('id', id).maybeSingle();
      if (!pr) return ko('Prestataire introuvable.', 404);
      await db.from('prestataires').update({ hourly_rate: taux, status: 'active' }).eq('id', id);
      const { error } = await db.from('users').update({ status: 'active' }).eq('id', pr.user_id);
      if (error) return ko('Validation impossible.', 500);
      return ok();
    }

    case 'refuse': {
      const id = str(b.id);
      if (!id) return ko('Prestataire manquant.');
      const { data: pr } = await db.from('prestataires').select('user_id').eq('id', id).maybeSingle();
      if (!pr) return ko('Prestataire introuvable.', 404);
      // Seule une DEMANDE se refuse : un prestataire validé se suspend.
      if (!(await enAttente(db, pr.user_id))) return ko('Ce prestataire est déjà validé : suspendez-le plutôt.');
      await db.from('prestataires').delete().eq('id', id);
      await db.from('users').delete().eq('id', pr.user_id);
      return ok();
    }

    case 'set-password': {
      const id = str(b.id), password = str(b.password);
      if (!id) return ko('Prestataire manquant.');
      if (!password || password.length < MDP_MIN) return ko(`Mot de passe : ${MDP_MIN} caractères minimum.`);
      const { data } = await db.from('prestataires').select('user_id').eq('id', id).maybeSingle();
      if (!data) return ko('Prestataire introuvable.', 404);
      await db.from('users').update({ password_hash: await hashPassword(password) }).eq('id', data.user_id);
      return ok();
    }

    case 'agents': {
      const id = str(b.id);
      if (!id) return ko('Prestataire manquant.');
      const { data } = await db.from('cleaners').select(AGENT_COLONNES).eq('prestataire_id', id).order('name');
      // Sa fiche « moi-même » (mode terrain) n'est pas un agent.
      const perso = emailAgentPerso(id);
      return ok({ agents: (data ?? []).filter(a => (a as { email?: string | null }).email !== perso) });
    }

    case 'releve': {
      const id = str(b.id);
      const periode = /^\d{4}-\d{2}$/.test(String(b.periode ?? '')) ? String(b.periode) : moisCourant();
      if (!id) return ko('Prestataire manquant.');
      return ok({ releve: await releve(db, id, periode) });
    }

    // ── Paiement : marquer le relevé d'un mois comme payé (ou l'annuler) ──
    case 'marquer-paye': {
      const id = str(b.id);
      const periode = String(b.periode ?? '');
      if (!id || !/^\d{4}-\d{2}$/.test(periode)) return ko('Prestataire ou mois manquant.');
      const r = await releve(db, id, periode);
      const montant = b.montant != null && b.montant !== '' ? Math.max(0, Number(b.montant) || 0) : r.montant;
      const { error } = await db.from('prestataire_paiements').upsert({
        prestataire_id: id, periode, montant, paid_at: new Date().toISOString(), note: str(b.note) ?? null,
      }, { onConflict: 'prestataire_id,periode' });
      if (error) { console.error('prestataire/marquer-paye:', error.message); return ko('Enregistrement impossible.', 500); }
      const { data: pr } = await db.from('prestataires').select('user_id').eq('id', id).maybeSingle();
      if (pr?.user_id) await notifyPrestatairePaiement(pr.user_id as string, periode, montant);
      return ok();
    }

    case 'annuler-paiement': {
      const id = str(b.id);
      const periode = String(b.periode ?? '');
      if (!id || !/^\d{4}-\d{2}$/.test(periode)) return ko('Prestataire ou mois manquant.');
      await db.from('prestataire_paiements').delete().eq('prestataire_id', id).eq('periode', periode);
      return ok();
    }

    case 'docs': {
      const id = str(b.id);
      if (!id) return ko('Prestataire manquant.');
      return ok(await documents(db, id));
    }
    case 'doc-add': {
      const id = str(b.id);
      if (!id) return ko('Prestataire manquant.');
      return ajouterDocument(db, id, b);
    }
    case 'doc-delete': {
      const id = str(b.id);
      if (!id) return ko('Prestataire manquant.');
      return supprimerDocument(db, id, str(b.docId));
    }

    // ── Confier des missions à un prestataire ──
    case 'confier': {
      const pid = str(b.prestataireId);
      const ids = Array.isArray(b.missionIds) ? (b.missionIds as unknown[]).map(String).filter(Boolean) : [];
      if (!pid || ids.length === 0) return ko('Mission ou prestataire manquant.');
      const r = await chargerPrestataireConfiable(db, pid);
      if (!('pr' in r)) return ko(r.erreur, r.code);

      let count = 0, bloquees = 0;
      const confiees: string[] = [];
      for (const id of ids) {
        const { data: m } = await db.from('missions').select('*, airbnbs(estimated_cleaning_minutes, credit_impot)').eq('id', id).maybeSingle();
        if (!m) continue;
        const res = await confierUneMission(db, m, r.pr);
        if (res === 'erreur') return ko('Attribution impossible.', 500);
        if (res === 'credit_impot') { bloquees++; continue; }
        // Déjà chez ce prestataire : rien de neuf à lui annoncer, mais c'est fait.
        if (res === 'ignoree') { if (m.prestataire_id === r.pr.id && attribuable(m.status as string)) count++; continue; }
        count++;
        confiees.push(id);
      }
      await notifierConfiees(db, r.pr, confiees);
      if (count === 0 && bloquees > 0) return ko(CREDIT_IMPOT_REFUS);
      return ok({ count, bloquees });
    }

    // ── Reprendre une mission à un prestataire ──
    case 'reprendre': {
      const id = str(b.missionId);
      if (!id) return ko('Mission manquante.');
      const { data: m } = await db.from('missions').select('id, status, cleaner_id, prestataire_id').eq('id', id).maybeSingle();
      if (!m?.prestataire_id) return ko('Cette mission n’est confiée à aucun prestataire.');
      if (!attribuable(m.status as string)) return ko('Mission déjà démarrée, terminée ou annulée.');
      const { data: maj, error } = await db.from('missions').update({
        prestataire_id: null, prestataire_name: null, prestataire_rate_snapshot: null, prestataire_gain: null,
        status: 'pending', cleaner_id: null, cleaner_name: null, cleaner_gain: 0, cleaner_hourly_rate_snapshot: null,
      }).eq('id', id).in('status', ['pending', 'assigned']).select('id');
      if (error) { console.error('prestataire/reprendre:', error.message); return ko('Retrait impossible.', 500); }
      if (!maj?.length) return ko('Cette mission ne peut plus être modifiée.');
      if (m.cleaner_id) await notifyCleanerMissionUnassigned(id, m.cleaner_id as string);
      const { data: pr } = await db.from('prestataires').select('user_id').eq('id', m.prestataire_id).maybeSingle();
      if (pr?.user_id) await notifyPrestataireMissionReprise(id, pr.user_id as string);
      return ok();
    }

    default:
      return ko('Opération inconnue.');
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  PRESTATAIRE (sur SES agents et SES missions uniquement)
// ══════════════════════════════════════════════════════════════════════════════
async function opPrestataire(db: SupabaseClient, op: string, b: Corps, moi: Record<string, unknown>) {
  const pid = moi.id as string;
  // Téléphone de connexion d'un agent. Un indépendant qui est aussi son propre
  // agent a le même numéro que son compte prestataire : un numéro ne sert qu'à
  // un compte, l'agent se connecte alors avec son email.
  async function identifiantAgent(telephone: string): Promise<string | null> {
    const { data: compte } = await db.from('users').select('login_phone').eq('id', moi.user_id as string).maybeSingle();
    return compte?.login_phone === telephone ? null : telephone;
  }

  /** Un de MES agents, ou null. */
  async function monAgent(id: string | undefined) {
    if (!id) return null;
    const { data } = await db.from('cleaners').select(AGENT_COLONNES + ', prestataire_id').eq('id', id).maybeSingle();
    return data && (data as { prestataire_id?: string }).prestataire_id === pid ? data as unknown as Record<string, unknown> : null;
  }

  switch (op) {
    case 'me': {
      const perso = await lireAgentPerso(db, pid);
      return ok({
        prestataire: { name: moi.name, contactName: moi.contact_name, email: moi.email, phone: moi.phone, hourlyRate: Number(moi.hourly_rate) || 0 },
        moiAgentId: perso?.cleanerId ?? null,
      });
    }

    // ── Le prestataire fait la mission lui-même : l'appli terrain sur SA fiche ──
    case 'mode-terrain': {
      const perso = await assurerAgentPerso(db, moi as { id: string; name: string; contact_name?: string | null; phone?: string | null });
      if ('erreur' in perso) return ko(perso.erreur, 500);
      // Seul : tout ce qui attend un agent (y compris un peu en retard) est à
      // son nom, pour le trouver DIRECTEMENT dans l'appli terrain.
      const depuis = dansJoursParis(-30);
      const { data: enAttente } = await db.from('missions').select('id')
        .eq('prestataire_id', pid).eq('status', 'pending').is('cleaner_id', null).gte('date_from', depuis);
      await attribuerAuPrestataireSeul(db, pid, (enAttente ?? []).map(m => m.id as string));
      await createSession({ id: perso.userId, name: perso.name, email: perso.email, role: 'cleaner', isActive: true, agent: true, agentPerso: true });
      return ok({ redirect: '/cleaner' });
    }

    case 'agents': {
      const { data } = await db.from('cleaners').select(AGENT_COLONNES).eq('prestataire_id', pid).order('name');
      // Sa fiche « moi-même » n'est pas un agent à gérer (filtré ici : un
      // `neq` SQL écarterait aussi les agents sans email).
      const perso = emailAgentPerso(pid);
      return ok({ agents: (data ?? []).filter(a => (a as { email?: string | null }).email !== perso) });
    }

    case 'agent-create': {
      const name = str(b.name), email = str(b.email)?.toLowerCase(), password = str(b.password);
      // L'agent se connecte avec son téléphone (email demandé aussi).
      const telephone = normalizePhone(str(b.phone));
      if (!name || !email || !telephone) return ko('Nom, téléphone et email obligatoires.');
      if (!password || password.length < MDP_MIN) return ko(`Mot de passe : ${MDP_MIN} caractères minimum.`);
      const loginPhone = await identifiantAgent(telephone);
      const compte = await creerCompte(db, { email, password, name, phone: str(b.phone), role: 'cleaner', loginPhone });
      if (compte.error) return ko(compte.error);
      // Un agent est un cleaner « hors équipe » : taux 0 (on paie le prestataire,
      // pas l'agent), ménage uniquement.
      const { error } = await db.from('cleaners').insert({
        user_id: compte.id, name, email, phone: str(b.phone) ?? null,
        hourly_rate: 0, delivery_rate: 0, can_clean: true, can_deliver: false,
        status: 'active', prestataire_id: pid,
      });
      if (error) {
        await db.from('users').delete().eq('id', compte.id);
        console.error('prestataire/agent-create:', error.message);
        return ko('Création impossible.', 500);
      }
      return ok({ connexion: loginPhone ? 'telephone' : 'email' });
    }

    case 'agent-update': {
      const agent = await monAgent(str(b.id));
      if (!agent) return ko('Agent introuvable.', 404);
      const name = str(b.name), email = str(b.email)?.toLowerCase();
      const telephone = normalizePhone(str(b.phone));
      if (!name || !email || !telephone) return ko('Nom, téléphone et email obligatoires.');
      const loginPhone = await identifiantAgent(telephone);
      const { error: uErr } = await db.from('users')
        .update({ name, email, phone: str(b.phone), login_phone: loginPhone }).eq('id', agent.user_id);
      if (uErr) return ko(/login_phone/i.test(uErr.message) ? 'Ce numéro sert déjà à se connecter à un autre compte.'
        : /duplicate|unique/i.test(uErr.message) ? 'Un compte existe déjà avec cet email.' : 'Enregistrement impossible.');
      await db.from('cleaners').update({ name, email, phone: str(b.phone) }).eq('id', agent.id);
      return ok({ connexion: loginPhone ? 'telephone' : 'email' });
    }

    case 'agent-password': {
      const agent = await monAgent(str(b.id));
      if (!agent) return ko('Agent introuvable.', 404);
      const password = str(b.password);
      if (!password || password.length < MDP_MIN) return ko(`Mot de passe : ${MDP_MIN} caractères minimum.`);
      await db.from('users').update({ password_hash: await hashPassword(password) }).eq('id', agent.user_id);
      return ok();
    }

    case 'agent-active': {
      const agent = await monAgent(str(b.id));
      if (!agent) return ko('Agent introuvable.', 404);
      const actif = b.active === true;
      // Désactiver bloque aussi la connexion (cf. /api/auth/login).
      await db.from('cleaners').update({ status: actif ? 'active' : 'inactive' }).eq('id', agent.id);
      await db.from('users').update({ status: actif ? 'active' : 'inactive' }).eq('id', agent.user_id);
      if (!actif) {
        // Ses missions à venir reviennent « à attribuer » chez le prestataire.
        const { data: rendues } = await db.from('missions').update({ status: 'pending', cleaner_id: null, cleaner_name: null })
          .eq('cleaner_id', agent.id).eq('prestataire_id', pid).eq('status', 'assigned').select('id');
        return ok({ rendues: rendues?.length ?? 0 });
      }
      return ok();
    }

    // ── Donner une mission confiée à l'un de ses agents (ou la lui reprendre) ──
    case 'attribuer': {
      const missionId = str(b.missionId);
      if (!missionId) return ko('Mission manquante.');
      const { data: m } = await db.from('missions').select('id, status, cleaner_id, prestataire_id').eq('id', missionId).maybeSingle();
      if (!m || m.prestataire_id !== pid) return ko('Mission introuvable.', 404);
      if (!attribuable(m.status as string)) return ko('Mission déjà démarrée, terminée ou annulée.');

      let cleanerId = str(b.cleanerId);
      // « Moi-même » : le prestataire fait la mission, sur sa fiche personnelle.
      if (cleanerId === 'moi') {
        const perso = await assurerAgentPerso(db, moi as { id: string; name: string; contact_name?: string | null; phone?: string | null });
        if ('erreur' in perso) return ko(perso.erreur, 500);
        cleanerId = perso.cleanerId;
      }
      let patch: Record<string, unknown>;
      if (cleanerId) {
        const agent = await monAgent(cleanerId);
        if (!agent) return ko('Agent introuvable.', 404);
        if (agent.status !== 'active') return ko('Cet agent est désactivé.');
        patch = { cleaner_id: agent.id, cleaner_name: agent.name, status: 'assigned', cleaner_gain: 0, cleaner_hourly_rate_snapshot: 0 };
      } else {
        patch = { cleaner_id: null, cleaner_name: null, status: 'pending', cleaner_gain: 0, cleaner_hourly_rate_snapshot: null };
      }
      const { data: maj, error } = await db.from('missions').update(patch)
        .eq('id', missionId).eq('prestataire_id', pid).in('status', ['pending', 'assigned']).select('id');
      if (error) { console.error('prestataire/attribuer:', error.message); return ko('Attribution impossible.', 500); }
      if (!maj?.length) return ko('Cette mission ne peut plus être modifiée.');

      const ancien = m.cleaner_id as string | null;
      if (ancien && ancien !== cleanerId) await notifyCleanerMissionUnassigned(missionId, ancien, String(moi.name ?? 'votre prestataire'));
      if (cleanerId && ancien !== cleanerId) await notifyCleanerNewMission(missionId);
      return ok({ cleanerId: cleanerId ?? null });
    }

    case 'releve': {
      const periode = /^\d{4}-\d{2}$/.test(String(b.periode ?? '')) ? String(b.periode) : moisCourant();
      return ok({ releve: await releve(db, pid, periode) });
    }

    // Documents administratifs (Kbis, attestation URSSAF, assurance) : les siens.
    case 'docs':
      return ok(await documents(db, pid));
    case 'doc-add':
      return ajouterDocument(db, pid, b);
    case 'doc-delete':
      return supprimerDocument(db, pid, str(b.docId));

    default:
      return ko('Opération inconnue.');
  }
}
