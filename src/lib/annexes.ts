import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SessionUser } from './sessionToken';
import { canEditChecklist } from './checklistAccess';

// ══════════════════════════════════════════════════════════════════════════════
//  Ce qui gravite autour des missions — photos, rapports de fin de ménage,
//  réparations, cloche de notifications, abonnements push — côté SERVEUR.
//
//  Ces tables étaient lisibles (et en partie modifiables) avec la clé publique :
//  photos des logements, dégâts signalés, notifications de tout le monde.
//  Règle unique : on ne touche à ce qui concerne une mission que si l'on est
//  l'admin, son cleaner ou la conciergerie du logement ; à un logement que si
//  l'on est l'admin, sa conciergerie ou un cleaner qui y intervient ; à ses
//  notifications que si ce sont les siennes. L'identité vient de la session.
// ══════════════════════════════════════════════════════════════════════════════

export type Corps = Record<string, unknown>;
export type Reponse = { status: number; body: Record<string, unknown> };

const ok = (body: Record<string, unknown> = {}): Reponse => ({ status: 200, body: { ok: true, ...body } });
const ko = (error: string, status = 400): Reponse => ({ status, body: { error } });
const refuse = ko('Accès refusé.', 403);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v : undefined);

const PHOTOS_BUCKET = 'mission_photos';
const MAX_PHOTOS_PER_MISSION = 8;
const MAX_REPAIR_PHOTOS = 2;
const REPAIR_SELECT = '*, airbnbs(name, address)';

// ── Droits ────────────────────────────────────────────────────────────────────

async function idCleaner(db: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await db.from('cleaners').select('id').eq('user_id', userId).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

type Lien = 'admin' | 'cleaner' | 'partner' | null;

/** Lien de la session avec une mission. */
async function lienMission(db: SupabaseClient, s: SessionUser, missionId: string): Promise<Lien> {
  if (s.role === 'admin') return 'admin';
  const { data: m } = await db.from('missions')
    .select('cleaner_id, partner_id, airbnbs(partner_id)').eq('id', missionId).maybeSingle();
  if (!m) return null;
  if (s.role === 'cleaner') {
    const cid = await idCleaner(db, s.id);
    return cid && m.cleaner_id === cid ? 'cleaner' : null;
  }
  if (s.role === 'airbnb') {
    const proprio = (m.airbnbs as { partner_id?: string } | null)?.partner_id;
    return m.partner_id === s.id || proprio === s.id ? 'partner' : null;
  }
  return null;
}

/** Lien de la session avec un logement. */
async function lienLogement(db: SupabaseClient, s: SessionUser, airbnbId: string): Promise<Lien> {
  if (s.role === 'admin') return 'admin';
  if (s.role === 'airbnb') {
    const { data } = await db.from('airbnbs').select('partner_id').eq('id', airbnbId).maybeSingle();
    return data?.partner_id === s.id ? 'partner' : null;
  }
  if (s.role === 'cleaner') {
    const cid = await idCleaner(db, s.id);
    if (!cid) return null;
    const { data } = await db.from('missions').select('id').eq('airbnb_id', airbnbId).eq('cleaner_id', cid).limit(1);
    return (data ?? []).length > 0 ? 'cleaner' : null;
  }
  return null;
}

/** Parmi des missions, celles que la session a le droit de voir. */
async function missionsVisibles(db: SupabaseClient, s: SessionUser, ids: string[]): Promise<string[]> {
  if (s.role === 'admin') return ids;
  const { data } = await db.from('missions').select('id, cleaner_id, partner_id, airbnbs(partner_id)').in('id', ids);
  const cid = s.role === 'cleaner' ? await idCleaner(db, s.id) : null;
  return (data ?? []).filter(m => {
    if (s.role === 'cleaner') return !!cid && m.cleaner_id === cid;
    if (s.role === 'airbnb') {
      return m.partner_id === s.id || (m.airbnbs as { partner_id?: string } | null)?.partner_id === s.id;
    }
    return false;
  }).map(m => m.id as string);
}

// ── Les opérations ────────────────────────────────────────────────────────────

type Op = (db: SupabaseClient, s: SessionUser, b: Corps) => Promise<Reponse>;

const OPS: Record<string, Op> = {

  // ── Photos avant / après ──
  async photos(db, s, b) {
    const missionId = str(b.missionId);
    if (!missionId) return ko('Mission manquante.');
    if (!(await lienMission(db, s, missionId))) return refuse;
    const { data, error } = await db.from('mission_photos').select('*')
      .eq('mission_id', missionId).order('created_at', { ascending: true });
    if (error) return ko('Lecture impossible.', 500);
    return ok({ data: data ?? [] });
  },

  async 'photos-missions'(db, s, b) {
    const ids = (Array.isArray(b.missionIds) ? b.missionIds : []).filter((x): x is string => typeof x === 'string').slice(0, 500);
    if (ids.length === 0) return ok({ data: [] });
    const visibles = await missionsVisibles(db, s, ids);
    if (visibles.length === 0) return ok({ data: [] });
    const { data, error } = await db.from('mission_photos').select('*')
      .in('mission_id', visibles).order('created_at', { ascending: true });
    if (error) return ko('Lecture impossible.', 500);
    return ok({ data: data ?? [] });
  },

  async 'photos-count'(db, s, b) {
    const missionId = str(b.missionId);
    if (!missionId) return ko('Mission manquante.');
    if (!(await lienMission(db, s, missionId))) return refuse;
    const { count } = await db.from('mission_photos').select('id', { count: 'exact', head: true }).eq('mission_id', missionId);
    return ok({ count: count ?? 0 });
  },

  // Le fichier est déjà dans le stockage ; on enregistre sa référence. Réservé
  // à l'admin et au cleaner de la mission. L'URL est RECALCULÉE à partir du
  // chemin, qui doit être rangé sous la mission.
  async 'photo-add'(db, s, b) {
    const missionId = str(b.missionId), path = str(b.path);
    const kind = b.kind === 'before' ? 'before' : 'after';
    if (!missionId || !path) return ko('Photo incomplète.');
    const lien = await lienMission(db, s, missionId);
    if (lien !== 'admin' && lien !== 'cleaner') return refuse;
    if (!path.startsWith(`${missionId}/`) || path.includes('..')) return ko('Chemin de photo invalide.');
    const { count } = await db.from('mission_photos').select('id', { count: 'exact', head: true }).eq('mission_id', missionId);
    if ((count ?? 0) >= MAX_PHOTOS_PER_MISSION) {
      return ko(`Limite atteinte : ${MAX_PHOTOS_PER_MISSION} photos maximum par mission.`);
    }
    const url = db.storage.from(PHOTOS_BUCKET).getPublicUrl(path).data.publicUrl;
    const { data, error } = await db.from('mission_photos').insert({
      mission_id: missionId, kind, url, storage_path: path, uploaded_by: s.id,
    }).select('*').single();
    if (error) { console.error('annexes/photo-add:', error.message); return ko('Enregistrement impossible.', 500); }
    return ok({ data });
  },

  // ── Dépôt de fichiers : autorisation à usage unique ──
  //
  // Les réserves de fichiers acceptaient dépôts et SUPPRESSIONS avec la clé
  // publique. Le navigateur demande désormais ici une autorisation de dépôt
  // pour un chemin précis, délivrée après vérification de ses droits ; il ne
  // peut ni choisir l'emplacement, ni effacer quoi que ce soit.
  async 'upload-url'(db, s, b) {
    const rand = Math.random().toString(36).slice(2, 8);
    const ts = Date.now();
    let bucket = PHOTOS_BUCKET, path: string;
    switch (b.kind) {
      case 'mission-photo': {
        const missionId = str(b.missionId);
        if (!missionId) return ko('Mission manquante.');
        const lien = await lienMission(db, s, missionId);
        if (lien !== 'admin' && lien !== 'cleaner') return refuse;
        path = `${missionId}/${b.photoKind === 'before' ? 'before' : 'after'}-${ts}-${rand}.jpg`;
        break;
      }
      case 'repair-photo': {
        const airbnbId = str(b.airbnbId);
        if (!airbnbId) return ko('Logement manquant.');
        if (s.role !== 'admin') {
          const missionId = str(b.missionId);
          if (s.role !== 'cleaner' || !missionId || (await lienMission(db, s, missionId)) !== 'cleaner') return refuse;
          const { data: m } = await db.from('missions').select('airbnb_id').eq('id', missionId).maybeSingle();
          if (m?.airbnb_id !== airbnbId) return refuse;
        }
        path = `repairs/${airbnbId}/${ts}-${rand}.jpg`;
        break;
      }
      case 'checklist-photo': {
        const airbnbId = str(b.airbnbId), itemId = str(b.itemId);
        if (!airbnbId || !itemId || !/^[0-9a-f-]{36}$/i.test(itemId)) return ko('Point manquant.');
        const { data: apt } = await db.from('airbnbs').select('partner_id').eq('id', airbnbId).maybeSingle();
        if (!canEditChecklist({ id: s.id, role: s.role }, apt ? { partnerId: (apt.partner_id as string | null) ?? null } : null)) return refuse;
        path = `checklists/${airbnbId}/${itemId}-${ts}.jpg`;
        break;
      }
      case 'receipt': {
        if (s.role !== 'admin') return refuse;
        const ext = (str(b.ext) ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || 'jpg';
        bucket = 'receipts';
        path = `${ts}-${rand}.${ext}`;
        break;
      }
      default:
        return ko('Type de fichier inconnu.');
    }
    const { data, error } = await db.storage.from(bucket).createSignedUploadUrl(path);
    if (error || !data) { console.error('annexes/upload-url:', error?.message); return ko('Dépôt impossible.', 500); }
    return ok({ bucket, path: data.path, token: data.token, publicUrl: db.storage.from(bucket).getPublicUrl(data.path).data.publicUrl });
  },

  // Annuler un dépôt de photo de ménage dont la référence n'a pas pu être
  // enregistrée : seulement un fichier de SA mission, et jamais un fichier
  // déjà référencé (preuve d'un ménage).
  async 'upload-cancel'(db, s, b) {
    const missionId = str(b.missionId), path = str(b.path);
    if (!missionId || !path || !path.startsWith(`${missionId}/`) || path.includes('..')) return ko('Fichier invalide.');
    const lien = await lienMission(db, s, missionId);
    if (lien !== 'admin' && lien !== 'cleaner') return refuse;
    const { count } = await db.from('mission_photos').select('id', { count: 'exact', head: true }).eq('storage_path', path);
    if ((count ?? 0) > 0) return ko('Photo déjà enregistrée.');
    await db.storage.from(PHOTOS_BUCKET).remove([path]);
    return ok();
  },

  // ── Rapport de fin de mission ──
  async report(db, s, b) {
    const missionId = str(b.missionId);
    if (!missionId) return ko('Mission manquante.');
    if (!(await lienMission(db, s, missionId))) return refuse;
    const { data, error } = await db.from('mission_reports').select('*').eq('mission_id', missionId).maybeSingle();
    if (error) return ko('Lecture impossible.', 500);
    return ok({ data });
  },

  async 'report-save'(db, s, b) {
    const r = (b.report ?? {}) as Corps;
    const missionId = str(r.missionId);
    if (!missionId) return ko('Mission manquante.');
    const lien = await lienMission(db, s, missionId);
    if (lien !== 'admin' && lien !== 'cleaner') return refuse;
    const issues = str(r.issues) ?? null;
    const lostFound = str(r.lostFound) ?? null;
    const { error } = await db.from('mission_reports').upsert({
      mission_id: missionId,
      consumables: Array.isArray(r.consumables) ? r.consumables.filter(x => typeof x === 'string') : [],
      consumables_note: str(r.consumablesNote) ?? null,
      issues,
      // Localisation gardée seulement si le constat existe.
      issues_unit: (issues && str(r.issuesUnit)) || null,
      lost_found: lostFound,
      lost_found_unit: (lostFound && str(r.lostFoundUnit)) || null,
      note: str(r.note) ?? null,
      submitted_by: str(r.submittedBy) ?? s.name ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'mission_id' });
    if (error) { console.error('annexes/report-save:', error.message); return ko('Enregistrement impossible.', 500); }
    return ok();
  },

  // Incidents signalés sur les rapports (tableau de bord admin).
  async incidents(db, s) {
    if (s.role !== 'admin') return refuse;
    const { data, error } = await db.from('mission_reports')
      .select('mission_id, issues, updated_at, missions(property_name, date_from, status, airbnbs(name))')
      .not('issues', 'is', null).order('updated_at', { ascending: false }).limit(200);
    if (error) { console.error('annexes/incidents:', error.message); return ko('Lecture impossible.', 500); }
    const statut: Record<string, string> = { pending: 'pending', assigned: 'accepted', inprogress: 'in_progress', done: 'completed', cancelled: 'cancelled' };
    return ok({
      data: (data ?? []).map(r => {
        const m = r.missions as { property_name?: string; date_from?: string; status?: string; airbnbs?: { name?: string } | null } | null;
        return {
          missionId: r.mission_id, issues: r.issues,
          property: m?.airbnbs?.name ?? m?.property_name ?? undefined,
          date: m?.date_from ?? undefined,
          status: m?.status ? statut[m.status] ?? m.status : undefined,
          updatedAt: r.updated_at,
        };
      }),
    });
  },

  // ── Réparations ──
  async 'repairs-partner'(db, s) {
    if (s.role !== 'airbnb') return refuse;
    const { data, error } = await db.from('repairs').select(REPAIR_SELECT).eq('partner_id', s.id)
      .order('status', { ascending: true }).order('created_at', { ascending: false });
    if (error) return ko('Lecture impossible.', 500);
    return ok({ data: data ?? [] });
  },

  async 'repairs-all'(db, s) {
    if (s.role !== 'admin') return refuse;
    const { data, error } = await db.from('repairs').select(REPAIR_SELECT)
      .order('status', { ascending: true }).order('created_at', { ascending: false });
    if (error) return ko('Lecture impossible.', 500);
    return ok({ data: data ?? [] });
  },

  async 'repairs-apartment'(db, s, b) {
    const airbnbId = str(b.airbnbId);
    if (!airbnbId) return ko('Logement manquant.');
    if (!(await lienLogement(db, s, airbnbId))) return refuse;
    const { data, error } = await db.from('repairs').select(REPAIR_SELECT).eq('airbnb_id', airbnbId)
      .order('status', { ascending: true }).order('created_at', { ascending: false });
    if (error) return ko('Lecture impossible.', 500);
    return ok({ data: data ?? [] });
  },

  async 'repairs-mission'(db, s, b) {
    const missionId = str(b.missionId);
    if (!missionId) return ko('Mission manquante.');
    if (!(await lienMission(db, s, missionId))) return refuse;
    const { data, error } = await db.from('repairs').select(REPAIR_SELECT).eq('mission_id', missionId)
      .order('created_at', { ascending: false });
    if (error) return ko('Lecture impossible.', 500);
    return ok({ data: data ?? [] });
  },

  // Signaler une réparation : l'admin, ou le cleaner depuis SA mission.
  async 'repair-create'(db, s, b) {
    const airbnbId = str(b.airbnbId), missionId = str(b.missionId);
    const description = str(b.description)?.trim();
    if (!airbnbId) return ko('Logement manquant.');
    if (!description) return ko('Description requise.');
    if (s.role === 'cleaner') {
      if (!missionId || (await lienMission(db, s, missionId)) !== 'cleaner') return refuse;
      const { data: m } = await db.from('missions').select('airbnb_id').eq('id', missionId).maybeSingle();
      if (m?.airbnb_id !== airbnbId) return refuse;
    } else if (s.role !== 'admin') {
      return refuse;
    }
    const { data: apt } = await db.from('airbnbs').select('partner_id').eq('id', airbnbId).maybeSingle();
    const photos = (Array.isArray(b.photos) ? b.photos : [])
      .filter((u): u is string => typeof u === 'string' && u.includes(`/${PHOTOS_BUCKET}/repairs/${airbnbId}/`))
      .slice(0, MAX_REPAIR_PHOTOS);
    const { data, error } = await db.from('repairs').insert({
      airbnb_id: airbnbId, partner_id: apt?.partner_id ?? null, mission_id: missionId ?? null,
      description, status: 'open',
      created_by: str(b.createdBy) ?? s.name ?? null, created_role: s.role, photos,
    }).select(REPAIR_SELECT).single();
    if (error) { console.error('annexes/repair-create:', error.message); return ko('Enregistrement impossible.', 500); }
    return ok({ data });
  },

  // Confirmer (ou rouvrir) : l'admin ou la conciergerie du logement.
  async 'repair-resolve'(db, s, b) {
    return changerReparation(db, s, b, {
      status: 'done', resolved_by: str(b.resolvedBy) ?? s.name ?? null,
      resolved_note: str(b.note)?.trim() || null, resolved_at: new Date().toISOString(),
    });
  },

  async 'repair-reopen'(db, s, b) {
    return changerReparation(db, s, b, { status: 'open', resolved_by: null, resolved_note: null, resolved_at: null });
  },

  async 'repair-delete'(db, s, b) {
    if (s.role !== 'admin') return refuse;
    const id = str(b.id);
    if (!id) return ko('Réparation manquante.');
    const { error } = await db.from('repairs').delete().eq('id', id);
    if (error) return ko('Suppression impossible.', 500);
    return ok();
  },

  // ── Cloche de notifications : uniquement les siennes ──
  async 'notifs'(db, s, b) {
    const limit = Math.min(100, Math.max(1, Number(b.limit) || 40));
    const { data, error } = await db.from('notifications').select('*').eq('user_id', s.id)
      .or(FILTRE_CLOCHE).order('created_at', { ascending: false }).limit(limit);
    if (error) return ko('Lecture impossible.', 500);
    return ok({ data: data ?? [] });
  },

  async 'notifs-unread'(db, s) {
    const { count, error } = await db.from('notifications').select('id', { count: 'exact', head: true })
      .eq('user_id', s.id).eq('read', false).or(FILTRE_CLOCHE);
    if (error) return ko('Lecture impossible.', 500);
    return ok({ count: count ?? 0 });
  },

  async 'notif-read'(db, s, b) {
    const id = str(b.id);
    if (!id) return ko('Notification manquante.');
    await db.from('notifications').update({ read: true }).eq('id', id).eq('user_id', s.id);
    return ok();
  },

  async 'notifs-read-all'(db, s) {
    await db.from('notifications').update({ read: true }).eq('user_id', s.id).eq('read', false);
    return ok();
  },

  // ── Abonnements push : rattachés à l'utilisateur de la session ──
  async 'push-save'(db, s, b) {
    const sub = b.subscription as { endpoint?: unknown } | undefined;
    const endpoint = str(sub?.endpoint);
    if (!endpoint || !/^https:\/\//.test(endpoint)) return ko('Abonnement invalide.');
    const { error } = await db.from('push_subscriptions').upsert({
      user_id: s.id, role: s.role, endpoint, subscription: sub,
      device_type: str(b.deviceType) ?? null, updated_at: new Date().toISOString(),
    }, { onConflict: 'endpoint' });
    if (error) { console.error('annexes/push-save:', error.message); return ko('Enregistrement impossible.', 500); }
    return ok();
  },

  async 'push-delete'(db, s, b) {
    const endpoint = str(b.endpoint);
    if (!endpoint) return ko('Abonnement manquant.');
    await db.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('user_id', s.id);
    return ok();
  },
};

// Mêmes types exclus de la cloche que côté écran (cf. notifications.ts).
const FILTRE_CLOCHE = 'type.is.null,type.not.in.(devis_request)';

async function changerReparation(db: SupabaseClient, s: SessionUser, b: Corps, patch: Record<string, unknown>): Promise<Reponse> {
  const id = str(b.id);
  if (!id) return ko('Réparation manquante.');
  const { data: r } = await db.from('repairs').select('airbnb_id, partner_id').eq('id', id).maybeSingle();
  if (!r) return ko('Réparation introuvable.', 404);
  const estProprio = s.role === 'airbnb' && (r.partner_id === s.id || (await lienLogement(db, s, r.airbnb_id as string)) === 'partner');
  if (s.role !== 'admin' && !estProprio) return refuse;
  const { error } = await db.from('repairs').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) { console.error('annexes/repair:', error.message); return ko('Enregistrement impossible.', 500); }
  return ok();
}

export async function executerAnnexe(db: SupabaseClient, s: SessionUser, b: Corps): Promise<Reponse | null> {
  const op = typeof b.op === 'string' ? OPS[b.op] : undefined;
  return op ? op(db, s, b) : null;
}
