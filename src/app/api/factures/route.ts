import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { exigerSession, exigerAdmin } from '@/lib/apiGuard';
import { echeance } from '@/lib/factureStatut';
import { ligneFourniture } from '@/lib/linge';

export const runtime = 'nodejs';

// ── Factures du client : déposées par nous, consultées par lui ───────────────
//
// L'entreprise dépose le PDF — qu'il vienne de l'application ou du logiciel du
// comptable — et le client le retrouve dans son espace, avec son état de
// paiement, et le télécharge.
//
// LE FICHIER N'EST JAMAIS PUBLIC. Il vit dans un dossier privé ; le client
// reçoit un lien SIGNÉ valable quelques minutes, délivré seulement après
// vérification que la facture lui appartient. Une facture porte une raison
// sociale, des montants et une adresse : une adresse de fichier devinable
// suffirait à la lire.

const BUCKET = 'factures';
const refus = (m: string, code = 403) => NextResponse.json({ error: m }, { status: code });

/** Les factures que le demandeur a le droit de voir. */
export async function GET() {
  const { refus: sansSession, appelant } = await exigerSession();
  if (sansSession) return sansSession;

  const db = getSupabaseAdmin();
  let q = db.from('invoices')
    .select('id, number, partner_label, partner_type, period_from, period_to, total, status, due_date, paid_at, file_path, created_at')
    .order('created_at', { ascending: false });

  // Un partenaire ne voit QUE les siennes. L'administration voit tout.
  if (appelant!.role !== 'admin') q = q.eq('partner_id', appelant!.id);

  const { data, error } = await q;
  if (error) { console.error('factures/list:', error.message); return refus('Lecture impossible.', 500); }

  // Le chemin du fichier ne sort pas : on dit seulement qu'il en existe un.
  const factures = (data ?? []).map(f => {
    const ligne = f as Record<string, unknown>;
    const chemin = ligne.file_path as string | null;
    delete ligne.file_path;
    return { ...ligne, hasFile: !!chemin };
  });
  return NextResponse.json({ factures });
}

export async function POST(req: NextRequest) {
  const ctype = req.headers.get('content-type') ?? '';

  // ── Dépôt d'un PDF (multipart) — administration seulement ─────────────────
  if (ctype.includes('multipart/form-data')) {
    const { refus: pasAdmin } = await exigerAdmin();
    if (pasAdmin) return pasAdmin;

    const form = await req.formData();
    const fichier = form.get('file');
    const invoiceId = String(form.get('invoiceId') ?? '');
    if (!(fichier instanceof File) || !invoiceId) return refus('Fichier ou facture manquant.', 400);
    if (fichier.type !== 'application/pdf') return refus('Un PDF est attendu.', 400);
    if (fichier.size > 10 * 1024 * 1024) return refus('Fichier trop lourd (10 Mo maximum).', 400);

    const db = getSupabaseAdmin();
    const { data: facture } = await db.from('invoices')
      .select('id, number').eq('id', invoiceId).maybeSingle();
    if (!facture) return refus('Facture introuvable.', 404);

    const nom = String(facture.number ?? 'facture').replace(/[^\w-]/g, '_');
    const chemin = `${invoiceId}/${nom}.pdf`;
    const { error: up } = await db.storage.from(BUCKET)
      .upload(chemin, fichier, { contentType: 'application/pdf', upsert: true });
    if (up) { console.error('factures/upload:', up.message); return refus('Dépôt impossible.', 500); }

    const { error } = await db.from('invoices').update({ file_path: chemin }).eq('id', invoiceId);
    if (error) { console.error('factures/upload(save):', error.message); return refus('Enregistrement impossible.', 500); }
    return NextResponse.json({ ok: true });
  }

  let b: {
    action?: string; id?: string; dueDate?: string; paid?: boolean; partnerId?: string;
    missionIds?: string[]; figer?: boolean;
  } = {};
  try { b = await req.json(); } catch { return refus('Requête invalide.', 400); }

  const { refus: sansSession, appelant } = await exigerSession();
  if (sansSession) return sansSession;
  const db = getSupabaseAdmin();
  const estAdmin = appelant!.role === 'admin';

  switch (b.action) {
    // ── Le lien de téléchargement, signé et court ────────────────────────────
    case 'lien': {
      if (!b.id) return refus('Facture manquante.', 400);
      const { data: f } = await db.from('invoices')
        .select('id, partner_id, file_path').eq('id', b.id).maybeSingle();
      if (!f?.file_path) return refus('Aucun document pour cette facture.', 404);
      if (!estAdmin && f.partner_id !== appelant!.id) return refus('Cette facture n’est pas la vôtre.');

      // Cinq minutes : le temps de cliquer, pas celui de faire circuler le lien.
      const { data, error } = await db.storage.from(BUCKET).createSignedUrl(f.file_path as string, 300);
      if (error || !data) { console.error('factures/lien:', error?.message); return refus('Lien indisponible.', 500); }
      return NextResponse.json({ url: data.signedUrl });
    }

    // ── La fourniture de linge à facturer, ménage par ménage ────────────────
    //
    // Le prix d'un kit vit dans `profit_config`, fermée à la clé publique : le
    // navigateur ne peut donc pas calculer cette ligne, et c'est très bien — il
    // n'a pas à connaître ce que l'entreprise facture ses marchandises avant
    // qu'on le lui dise.
    //
    // ORDRE DE PRIORITÉ : le snapshot posé sur la mission l'emporte sur la fiche
    // du logement. Une facture déjà émise ne doit pas changer de montant parce
    // qu'on a renégocié le forfait le mois suivant.
    case 'fournitures': {
      if (!estAdmin) return refus('Réservé à l’administration.');
      const ids = (b.missionIds ?? []).filter(Boolean);
      if (ids.length === 0) return NextResponse.json({ fournitures: {} });

      // Tant que migration_linge.sql n'est pas passée, les colonnes n'existent
      // pas : on rend une facture sans fourniture plutôt qu'une erreur.
      const { data: missions, error: errM } = await db.from('missions')
        .select('id, airbnb_id, supplies_amount, supplies_label, supplies_kits').in('id', ids);
      if (errM) return NextResponse.json({ fournitures: {}, indisponible: true });

      const { data: cfg } = await db.from('profit_config').select('linen_kit_price').limit(1).maybeSingle();
      const prixKit = Number(cfg?.linen_kit_price) || 0;

      const aptIds = Array.from(new Set((missions ?? []).map(m => m.airbnb_id).filter(Boolean)));
      const { data: apts, error: errA } = aptIds.length > 0
        ? await db.from('airbnbs')
            .select('id, linge_mode, linge_kits, linge_forfait, linge_libelle').in('id', aptIds)
        : { data: [], error: null };
      if (errA) return NextResponse.json({ fournitures: {}, indisponible: true });
      const parLogement = new Map((apts ?? []).map((a: any) => [a.id, a]));

      const fournitures: Record<string, { montant: number; libelle: string; kits: number }> = {};
      const aFiger: { id: string; montant: number; libelle: string; kits: number }[] = [];

      for (const m of missions ?? []) {
        const fige = Number(m.supplies_amount) || 0;
        if (fige > 0) {
          fournitures[m.id] = {
            montant: fige,
            libelle: (m.supplies_label as string) || 'Linge et consommables',
            kits: Number(m.supplies_kits) || 0,
          };
          continue;
        }
        const apt: any = m.airbnb_id ? parLogement.get(m.airbnb_id) : null;
        if (!apt) continue;
        const l = ligneFourniture({
          mode: apt.linge_mode ?? 'aucun', kits: apt.linge_kits,
          forfait: apt.linge_forfait, libelle: apt.linge_libelle,
        }, prixKit);
        if (!l) continue;
        fournitures[m.id] = l;
        aFiger.push({ id: m.id, ...l });
      }

      // `figer` n'est demandé qu'au moment où la facture part : le montant
      // devient celui qui a été facturé, et ne suit plus la fiche.
      if (b.figer && aFiger.length > 0) {
        for (const f of aFiger) {
          const { error } = await db.from('missions').update({
            supplies_amount: f.montant, supplies_label: f.libelle, supplies_kits: f.kits,
          }).eq('id', f.id);
          if (error) { console.error('factures/figer:', error.message); break; }
        }
      }

      return NextResponse.json({ fournitures });
    }

    // ── Marquer payée, ou revenir en arrière ─────────────────────────────────
    case 'paiement': {
      if (!estAdmin) return refus('Réservé à l’administration.');
      if (!b.id) return refus('Facture manquante.', 400);
      const { error } = await db.from('invoices').update(
        b.paid === false
          ? { status: 'sent', paid_at: null }
          : { status: 'paid', paid_at: new Date().toISOString() },
      ).eq('id', b.id);
      if (error) { console.error('factures/paiement:', error.message); return refus('Enregistrement impossible.', 500); }
      return NextResponse.json({ ok: true });
    }

    // ── Rattacher une facture à un compte, et poser son échéance ─────────────
    case 'rattacher': {
      if (!estAdmin) return refus('Réservé à l’administration.');
      if (!b.id) return refus('Facture manquante.', 400);
      const patch: Record<string, unknown> = {};
      if (b.partnerId !== undefined) patch.partner_id = b.partnerId || null;
      if (b.dueDate !== undefined) patch.due_date = b.dueDate || null;
      if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true });
      const { error } = await db.from('invoices').update(patch).eq('id', b.id);
      if (error) { console.error('factures/rattacher:', error.message); return refus('Enregistrement impossible.', 500); }
      return NextResponse.json({ ok: true });
    }

    // ── Échéance par défaut : trente jours, comme le contrat ─────────────────
    case 'echeance': {
      const base = b.dueDate ?? new Date().toISOString().slice(0, 10);
      return NextResponse.json({ dueDate: echeance(base) });
    }

    default:
      return refus('Action inconnue.', 400);
  }
}
