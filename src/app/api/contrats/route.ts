// ── /api/contrats — conditions particulières, proposées puis acceptées ──────
//
//  CE QUI SE JOUE ICI
//  Un contrat accepté doit rester lisible EXACTEMENT tel qu'il a été accepté.
//  On ne le regénère donc jamais à l'affichage : le texte est rendu une fois,
//  figé dans `contrats.articles`, et une modification = une nouvelle version.
//  Sans cela, une hausse de prix au 1er janvier réécrirait rétroactivement ce
//  que le client a signé en octobre.
//
//  L'ACCEPTATION est un clic authentifié, horodaté, avec la trace de qui et
//  d'où. Entre professionnels, c'est ce qui fait preuve — à condition de
//  conserver ces éléments, ce que fait la table (accepte_le / _par / _ip / _ua).
//
//  AUTORISATION : l'administration propose, le client accepte — et seulement le
//  sien. Le client_id vient de la session, jamais du corps de la requête.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { exigerSession, exigerAdmin } from '@/lib/apiGuard';
import { articlesContrat, totalParPassage, type DonneesContrat, type LogementContrat } from '@/lib/contrat';
import { ligneFourniture, prixKitDepuisTarifs } from '@/lib/linge';

export const runtime = 'nodejs';

const refus = (m: string, code = 403) => NextResponse.json({ error: m }, { status: code });

/** Frais de déplacement sans objet — le chiffre arrêté avec l'entreprise. */
const FRAIS_DEPLACEMENT = 20;

/** Les colonnes renvoyées : jamais `donnees`, qui porte des valeurs internes. */
const CHAMPS = 'id, client_id, version, reference, date_effet, articles, statut, accepte_le, accepte_par, created_at';

export async function GET(req: Request) {
  const { refus: sansSession, appelant } = await exigerSession();
  if (sansSession) return sansSession;

  const url = new URL(req.url);
  const estAdmin = appelant!.role === 'admin';
  const clientId = url.searchParams.get('clientId') || appelant!.id;
  if (!estAdmin && clientId !== appelant!.id) return refus('Accès refusé.');

  const db = getSupabaseAdmin();
  const { data, error } = await db.from('contrats').select(CHAMPS)
    .eq('client_id', clientId).order('version', { ascending: false });

  // La table n'existe pas encore (migration_contrats.sql non lancée) : l'écran
  // doit dire « aucun contrat », pas tomber en erreur.
  if (error) return NextResponse.json({ contrats: [], indisponible: true });
  return NextResponse.json({ contrats: data ?? [] });
}

export async function POST(req: Request) {
  let b: { action?: string; id?: string; clientId?: string; dateEffet?: string; note?: string } = {};
  try { b = await req.json(); } catch { return refus('Requête invalide.', 400); }

  const { refus: sansSession, appelant } = await exigerSession();
  if (sansSession) return sansSession;
  const db = getSupabaseAdmin();

  switch (b.action) {
    // ── Le client accepte ce qui lui est proposé ────────────────────────────
    case 'accepter': {
      if (!b.id) return refus('Contrat manquant.', 400);
      const { data: c } = await db.from('contrats')
        .select('id, client_id, statut').eq('id', b.id).maybeSingle();
      if (!c) return refus('Contrat introuvable.', 404);
      if (c.client_id !== appelant!.id) return refus('Ce contrat n’est pas le vôtre.');
      if (c.statut === 'accepte') return NextResponse.json({ ok: true, deja: true });
      if (c.statut !== 'propose') return refus('Ce contrat n’est plus à accepter.', 409);

      // La trace de l'acceptation : sans elle, le clic ne prouve rien.
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
        ?? req.headers.get('x-real-ip') ?? null;
      const { error } = await db.from('contrats').update({
        statut: 'accepte',
        accepte_le: new Date().toISOString(),
        accepte_par: appelant!.name ?? appelant!.id,
        accepte_ip: ip,
        accepte_ua: (req.headers.get('user-agent') ?? '').slice(0, 300),
      }).eq('id', b.id).eq('statut', 'propose');
      if (error) { console.error('contrats/accepter:', error.message); return refus('Enregistrement impossible.', 500); }
      return NextResponse.json({ ok: true });
    }

    // ── L'entreprise établit (ou renouvelle) le contrat d'un client ─────────
    case 'generer': {
      const { refus: pasAdmin } = await exigerAdmin();
      if (pasAdmin) return pasAdmin;
      const clientId = b.clientId;
      if (!clientId) return refus('Client manquant.', 400);

      const donnees = await construireDonnees(db, clientId, b.dateEffet);
      if (!donnees) return refus('Client introuvable.', 404);

      const { data: derniers } = await db.from('contrats')
        .select('version, reference').eq('client_id', clientId)
        .order('version', { ascending: false }).limit(1);
      const precedent = derniers?.[0];
      const version = (precedent?.version ?? 0) + 1;
      // Un avenant garde la référence du contrat d'origine : c'est la même
      // relation, à une version près.
      const reference = precedent?.reference
        ?? `CTR-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;

      const { data: cree, error } = await db.from('contrats').insert({
        client_id: clientId, version, reference,
        date_effet: donnees.dateEffet,
        articles: articlesContrat(donnees),
        donnees,
        statut: 'propose',
        created_by: appelant!.name ?? 'administration',
      }).select(CHAMPS).single();
      if (error) { console.error('contrats/generer:', error.message); return refus('Création impossible.', 500); }

      // Les versions antérieures ne sont plus à accepter.
      if (version > 1) {
        await db.from('contrats').update({ statut: 'remplace' })
          .eq('client_id', clientId).lt('version', version).in('statut', ['propose', 'accepte']);
      }
      return NextResponse.json({ contrat: cree, totalParPassage: totalParPassage(donnees.logements) });
    }

    // ── Aperçu avant envoi : on rend le texte sans rien écrire ──────────────
    case 'apercu': {
      const { refus: pasAdmin } = await exigerAdmin();
      if (pasAdmin) return pasAdmin;
      if (!b.clientId) return refus('Client manquant.', 400);
      const donnees = await construireDonnees(db, b.clientId, b.dateEffet);
      if (!donnees) return refus('Client introuvable.', 404);
      return NextResponse.json({
        articles: articlesContrat(donnees),
        totalParPassage: totalParPassage(donnees.logements),
      });
    }

    case 'resilier': {
      const { refus: pasAdmin } = await exigerAdmin();
      if (pasAdmin) return pasAdmin;
      if (!b.id) return refus('Contrat manquant.', 400);
      const { error } = await db.from('contrats').update({
        statut: 'resilie', resilie_le: new Date().toISOString(), resilie_note: b.note ?? null,
      }).eq('id', b.id);
      if (error) { console.error('contrats/resilier:', error.message); return refus('Enregistrement impossible.', 500); }
      return NextResponse.json({ ok: true });
    }

    default:
      return refus('Action inconnue.', 400);
  }
}

// ── Assemblage du contrat à partir de ce qu'on possède déjà ──────────────────
// Profil de facturation du client, logements avec leur prix et leur fourniture
// de linge, identité de l'entreprise. Rien n'est ressaisi : c'est précisément ce
// qui rend le document générable sans travail manuel.
async function construireDonnees(
  db: ReturnType<typeof getSupabaseAdmin>,
  clientId: string,
  dateEffet?: string,
): Promise<DonneesContrat | null> {
  const [{ data: entreprise }, { data: partenaire }, { data: hotel }, { data: grille }] = await Promise.all([
    db.from('company_info').select('*').eq('id', 1).maybeSingle(),
    db.from('airbnb_partners').select('*').eq('user_id', clientId).maybeSingle(),
    db.from('hotels').select('*').eq('user_id', clientId).maybeSingle(),
    db.from('tarifs').select('nom_prestation, prix_unitaire, prix_min, actif'),
  ]);

  const fiche: any = partenaire ?? hotel;
  if (!fiche) return null;

  const { data: apparts } = await db.from('airbnbs')
    .select('name, address, client_price, estimated_cleaning_minutes, linge_mode, linge_kits, linge_forfait, linge_libelle')
    .eq('partner_id', clientId).order('name');

  // Le prix d'un kit est celui de la grille tarifaire (section « Linge &
  // consommables »), la même qui sert au devis en ligne.
  const { prix: prixKit } = prixKitDepuisTarifs((grille ?? []).map((t: any) => ({
    nom: t.nom_prestation, prix: Number(t.prix_unitaire) || 0,
    prixMin: t.prix_min, actif: t.actif,
  })));
  const logements: LogementContrat[] = (apparts ?? []).map((a: any) => {
    const f = ligneFourniture({
      mode: a.linge_mode ?? 'aucun', kits: a.linge_kits,
      forfait: a.linge_forfait, libelle: a.linge_libelle,
    }, prixKit);
    return {
      nom: a.name ?? 'Logement',
      adresse: a.address ?? '',
      prix: Number(a.client_price) || 0,
      minutes: Number(a.estimated_cleaning_minutes) || undefined,
      fourniture: f ? { libelle: f.libelle, montant: f.montant } : null,
    };
  });

  return {
    prestataire: {
      raisonSociale: entreprise?.name ?? 'MonCleanerPro',
      adresse: entreprise?.address ?? '',
      siret: entreprise?.siret ?? undefined,
      tvaIntracom: entreprise?.vat ?? undefined,
      email: entreprise?.email ?? undefined,
      telephone: entreprise?.phone ?? undefined,
    },
    client: {
      raisonSociale: fiche.partner_name ?? fiche.hotel_name ?? '',
      adresse: fiche.address ?? '',
      siret: fiche.siret ?? undefined,
      tvaIntracom: fiche.tva_intracom ?? undefined,
      email: fiche.email ?? undefined,
      telephone: fiche.phone ?? undefined,
    },
    logements,
    dateEffet: dateEffet || new Date().toISOString().slice(0, 10),
    fraisDeplacement: FRAIS_DEPLACEMENT,
  };
}
