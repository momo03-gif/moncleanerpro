'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { qrWifi, rubriquesVoyageur, type DonneesFiche } from '@/lib/ficheLogement';

// ══════════════════════════════════════════════════════════════════════════════
//  La fiche d'accueil posée dans le logement.
//
//  Elle répond aux questions qu'on pose vingt fois par semaine — le wifi, les
//  poubelles, l'heure du départ — pour que personne n'ait à les poser.
//
//  LE QR WIFI EST LE CŒUR DE LA FICHE. Recopier « Fw8!zR2k-Lm9 » sur un clavier
//  de téléphone, dans un logement qu'on découvre, c'est la première friction du
//  séjour. Un scan, et c'est connecté. Le mot de passe reste écrit en dessous :
//  un ordinateur portable ne scanne pas.
//
//  ELLE PORTE LE NOM DE LA CONCIERGERIE, pas le nôtre : c'est son accueil, pas
//  notre prestation. D'où le logo.
//
//  AUCUN CODE D'ACCÈS n'y figure — ni portail, ni boîte à clé. Le voyageur est
//  déjà entré ; les écrire reviendrait à donner l'accès à tous les suivants.
//  (Garanti par `rubriquesVoyageur`, pas par cet affichage.)
// ══════════════════════════════════════════════════════════════════════════════

export default function FicheAccueil({ logement, societe, logoUrl }: {
  logement: DonneesFiche;
  /** Nom de la conciergerie, tel qu'il doit apparaître au voyageur. */
  societe?: string;
  logoUrl?: string;
}) {
  const contenuWifi = qrWifi(logement);

  // Le QR est gardé AVEC le contenu qui l'a produit : la conciergerie corrige le
  // mot de passe en direct dans l'aperçu, et un QR resté sur l'ancienne clé
  // mènerait à un réseau qui refuse la connexion — sans que rien ne le montre.
  const [qrFait, setQrFait] = useState<{ cle: string; svg: string } | null>(null);

  useEffect(() => {
    if (!contenuWifi) return;
    let annule = false;
    // Correction haute : une fiche imprimée se tache, se plie, et le QR doit
    // rester lisible dans un couloir mal éclairé.
    QRCode.toString(contenuWifi, { type: 'svg', margin: 0, errorCorrectionLevel: 'H' })
      .then(svg => { if (!annule) setQrFait({ cle: contenuWifi, svg }); })
      .catch(() => { if (!annule) setQrFait({ cle: contenuWifi, svg: '' }); });
    return () => { annule = true; };
  }, [contenuWifi]);

  const qr = qrFait?.cle === contenuWifi ? qrFait.svg : '';

  const rubriques = rubriquesVoyageur(logement);

  return (
    <div className="fiche-accueil" style={{
      maxWidth: 760, margin: '0 auto', padding: 40,
      backgroundColor: '#FFFFFF', color: '#1A1A1A',
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    }}>
      {/* ── En-tête : la conciergerie d'abord ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, paddingBottom: 24, borderBottom: '2px solid #1A1A1A' }}>
        {logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={societe ?? ''} style={{ height: 56, width: 'auto', objectFit: 'contain' }} />
        )}
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 28, fontWeight: 700, margin: 0, lineHeight: 1.1 }}>Bienvenue</p>
          {societe && <p style={{ fontSize: 13, margin: '4px 0 0', color: '#7A7068' }}>{societe}</p>}
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <p style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>{logement.name}</p>
        <p style={{ fontSize: 13, margin: '4px 0 0', color: '#7A7068' }}>{logement.address}</p>
      </div>

      {/* ── Wifi : ce qu'on cherche en premier en arrivant ── */}
      {contenuWifi && (
        <div style={{
          marginTop: 28, padding: 20, borderRadius: 16,
          backgroundColor: '#FAF8F3', border: '1px solid #EFE9DC',
          display: 'flex', alignItems: 'center', gap: 24,
        }}>
          {qr && (
            <div style={{ width: 132, height: 132, flexShrink: 0 }}
              dangerouslySetInnerHTML={{ __html: qr }} />
          )}
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#B0A795', margin: 0 }}>
              Wifi
            </p>
            <p style={{ fontSize: 13, color: '#4A443D', margin: '8px 0 12px' }}>
              Scannez le code avec l’appareil photo : la connexion se fait toute seule.
            </p>
            <p style={{ fontSize: 14, margin: 0 }}>
              Réseau : <strong>{logement.wifiSsid}</strong>
            </p>
            {logement.wifiPassword && (
              // Un ordinateur portable ne scanne pas : le mot de passe reste lisible.
              <p style={{ fontSize: 14, margin: '4px 0 0' }}>
                Mot de passe : <strong style={{ fontFamily: 'ui-monospace, monospace' }}>{logement.wifiPassword}</strong>
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Le reste, dans l'ordre où on se pose les questions ── */}
      <div style={{ marginTop: 28, display: 'grid', gap: 18 }}>
        {rubriques.map(r => (
          <div key={r.titre}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#B0A795', margin: 0 }}>
              {r.titre}
            </p>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: '#4A443D', margin: '6px 0 0', whiteSpace: 'pre-line' }}>
              {r.texte}
            </p>
          </div>
        ))}
      </div>

      {/* ── Qui joindre : toujours en bas, toujours présent ── */}
      {(logement.onSiteContactName || logement.onSiteContactPhone) && (
        <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid #EFE9DC' }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#B0A795', margin: 0 }}>
            Un souci ?
          </p>
          <p style={{ fontSize: 16, margin: '6px 0 0' }}>
            {logement.onSiteContactName}
            {logement.onSiteContactName && logement.onSiteContactPhone ? ' — ' : ''}
            {logement.onSiteContactPhone && <strong>{logement.onSiteContactPhone}</strong>}
          </p>
        </div>
      )}

      {/* À l'impression : une page propre, sans ombre ni fond d'écran. */}
      <style>{`
        @media print {
          body { background: #FFFFFF; }
          .print-hidden { display: none !important; }
          .fiche-accueil { padding: 0; max-width: none; }
          @page { margin: 16mm; }
        }
      `}</style>
    </div>
  );
}
