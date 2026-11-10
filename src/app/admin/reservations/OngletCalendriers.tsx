'use client';

// Onglet « Calendriers » : QUELS calendriers alimentent QUEL logement, rangés
// par conciergerie, et lequel est en panne. C'est aussi d'ici qu'on branche un
// calendrier POUR une conciergerie — beaucoup ne savent pas le faire, c'est
// l'exploitant qui s'en charge — et qu'on lui donne son URL de réception.

import { useMemo, useState } from 'react';
import type { Apartment, ReservationFeed } from '@/lib/types';
import type { PartnerAccount } from '@/lib/db';
import { platformLabel } from '@/lib/pms/registry';
import { useFeedback } from '@/contexts/FeedbackContext';
import Icon from '@/components/Icon';
import ConnectWizard from '@/app/airbnb/sync/ConnectWizard';
import BrancherSuperhote from './BrancherSuperhote';
import { fmtDate, postJson, titreSection, carte } from './commun';

type Diagnostic = { rattache: string; trouve: boolean; logements: { id: string; name: string }[] } | 'chargement' | string;

// Un calendrier. Un identifiant PMS ne ressemble à rien pour un humain : quand
// le bien porte un nom différent des deux côtés, on rattache le mauvais sans
// s'en apercevoir, et la synchro remonte zéro réservation sans la moindre
// erreur. D'où « quel logement ? » et « que répond le logiciel ? ».
function LigneCalendrier({ f, plusieurs }: { f: ReservationFeed; plusieurs: boolean }) {
  const [diag, setDiag] = useState<Diagnostic | null>(null);
  const enEchec = f.lastSyncStatus === 'error';

  async function quelLogement() {
    if (diag) { setDiag(null); return; }
    setDiag('chargement');
    try {
      const d = await postJson<{ ok?: boolean; error?: string } & Record<string, unknown>>('/api/reservations/pms-properties', { feedId: f.id });
      setDiag(d.ok ? d as unknown as Diagnostic : (d.error ?? 'Lecture impossible.'));
    } catch { setDiag('Lecture impossible.'); }
  }

  // Ce que l'éditeur répond vraiment : une synchro vide SANS erreur ne se
  // diagnostique qu'avec le nombre de lignes rendues et leur forme.
  async function queRepond() {
    setDiag('chargement');
    try {
      const d = await postJson<{ ok?: boolean; error?: string; diagnostic?: {
        variante: string; statut: number | 'ok'; lignes: number;
        duLogement: number; evenements: number; dansPeriode: number; enveloppe: string[];
      }[] }>('/api/reservations/pms-properties', { feedId: f.id, diagnostic: true });
      setDiag(d.ok
        ? (d.diagnostic ?? []).map(v => v.statut === 'ok'
          ? `${v.variante} : ${v.lignes} reçue(s), ${v.duLogement} du logement, ${v.dansPeriode} dans la période`
            + (v.enveloppe.length ? ` [enveloppe : ${v.enveloppe.join(', ')}]` : '')
          : `${v.variante} : refusé (${v.statut})`).join(' | ')
        : (d.error ?? 'Diagnostic impossible.'));
    } catch { setDiag('Diagnostic impossible.'); }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 border-b last:border-0" style={{ borderColor: '#F2EFE9' }}>
      <span className="text-sm font-medium min-w-[140px]" style={{ color: '#1A1A1A' }}>{f.apartmentName ?? '—'}</span>
      <span className="text-xs" style={{ color: '#7A7068' }}>{platformLabel(f.platform)}</span>
      {plusieurs && (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#C48A2A18', color: '#C48A2A' }}>
          plusieurs calendriers
        </span>
      )}
      {!f.active && (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#6B728018', color: '#6B7280' }}>inactif</span>
      )}
      <span className="flex-1" />
      {f.connectionKind === 'api' && (
        <>
          <button onClick={quelLogement} className="text-[11px] underline" style={{ color: '#A8A09A' }}>
            {diag ? 'masquer' : 'quel logement ?'}
          </button>
          <button onClick={queRepond} className="text-[11px] underline" style={{ color: '#A8A09A' }}>
            que répond le logiciel ?
          </button>
        </>
      )}
      {enEchec ? (
        <span className="text-[11px] font-semibold text-right" style={{ color: '#B85A50' }}>
          En échec{f.lastError ? ` — ${f.lastError}` : ''}
        </span>
      ) : (
        <span className="text-[11px]" style={{ color: '#A8A09A' }}>
          {f.lastSyncAt ? `Synchronisé le ${fmtDate(f.lastSyncAt.slice(0, 10))}` : 'Jamais synchronisé'}
        </span>
      )}
      {diag && (
        <div className="w-full mt-2 text-[11px]">
          {diag === 'chargement' ? <span style={{ color: '#A8A09A' }}>Lecture du logiciel…</span>
            : typeof diag === 'string' ? <span style={{ color: '#B85A50' }}>{diag}</span>
            : (
              <>
                {!diag.trouve && (
                  <p className="font-semibold mb-1" style={{ color: '#B85A50' }}>
                    L’identifiant enregistré ne correspond à aucun logement de ce compte : la connexion pointe dans le vide.
                  </p>
                )}
                <ul className="grid gap-0.5">
                  {diag.logements.map(l => (
                    <li key={l.id} style={{ color: l.id === diag.rattache ? '#1A1A1A' : '#A8A09A' }}>
                      {l.id === diag.rattache ? '● ' : '○ '}{l.name}
                      {l.id === diag.rattache ? ' — rattaché' : ''}
                    </li>
                  ))}
                </ul>
              </>
            )}
        </div>
      )}
    </div>
  );
}

// Les boutons de branchement d'une conciergerie, et son URL de réception
// directe (le logiciel du client nous appelle à chaque réservation ; l'URL
// secrète suffit, aucune clé à stocker). L'URL est demandée à la volée : le
// secret ne vit qu'en base.
function ActionsConciergerie({ p, onSuperhote, onAutre }: {
  p: PartnerAccount; onSuperhote: () => void; onAutre: () => void;
}) {
  const { toast } = useFeedback();
  const [url, setUrl] = useState<string | null>(null);

  async function urlReception() {
    if (url) { setUrl(null); return; }
    try {
      const d = await postJson<{ ok?: boolean; secret?: string; error?: string }>(
        '/api/reservations/webhook-admin', { action: 'abonnement', partnerId: p.userId, source: 'superhote' });
      if (d.ok) setUrl(`${window.location.origin}/api/reservations/webhook/${d.secret}`);
      else toast(d.error ?? 'Génération impossible.', 'error');
    } catch { toast('Génération impossible.', 'error'); }
  }

  // Copie, avec repli quand le navigateur refuse le presse-papiers (mobile,
  // HTTP) : l'URL reste sélectionnable au doigt dans tous les cas.
  async function copier() {
    if (!url) return;
    try { await navigator.clipboard.writeText(url); toast('URL de réception copiée.', 'success'); }
    catch { toast('Copie impossible — sélectionnez le texte.', 'error'); }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={onSuperhote} className="px-3 py-1.5 rounded-lg text-xs font-semibold border"
          style={{ borderColor: '#C9A84C', color: '#1A1A1A' }}>Brancher SuperHote</button>
        <button onClick={onAutre} className="px-3 py-1.5 rounded-lg text-xs font-medium border"
          style={{ borderColor: '#E8E4DC', color: '#1A1A1A' }}>Autre calendrier</button>
        <button onClick={urlReception} className="text-[11px] underline" style={{ color: '#A8A09A' }}>
          {url ? 'masquer l’URL' : 'URL de réception'}
        </button>
      </div>
      {url && (
        <div className="w-full mt-2 flex flex-wrap items-center gap-2">
          <span className="text-[11px] flex-1 min-w-[220px] break-all select-all font-medium" style={{ color: '#1A1A1A' }}>{url}</span>
          <button onClick={copier} className="px-3 py-1.5 rounded-lg text-xs font-medium border inline-flex items-center gap-1.5"
            style={{ borderColor: '#E8E4DC', color: '#1A1A1A' }}>
            <Icon name="copy" size={13} /> Copier
          </button>
        </div>
      )}
    </>
  );
}

export default function OngletCalendriers({ feeds, apartments, partenaires, onRecharger }: {
  feeds: ReservationFeed[];
  apartments: Apartment[];
  partenaires: PartnerAccount[];
  onRecharger: () => void | Promise<void>;
}) {
  const [superhotePour, setSuperhotePour] = useState<PartnerAccount | null>(null);
  const [autrePour, setAutrePour] = useState<PartnerAccount | null>(null);
  const [recus, setRecus] = useState<{ source: string; resultat: string; note?: string; recuLe: string; champs: string[] }[] | null>(null);

  // Par conciergerie, les pannes d'abord ; et le compte de calendriers par
  // logement, parce qu'un logement qui en porte trois est la cause la plus
  // fréquente de lignes qui se contredisent.
  const { groupes, sansCalendrier, enEchec, parLogement } = useMemo(() => {
    const parLogement = new Map<string, number>();
    for (const f of feeds) parLogement.set(f.airbnbId, (parLogement.get(f.airbnbId) ?? 0) + 1);
    const tri = (a: ReservationFeed, b: ReservationFeed) =>
      (a.lastSyncStatus === 'error' ? 0 : 1) - (b.lastSyncStatus === 'error' ? 0 : 1)
      || (a.apartmentName ?? '').localeCompare(b.apartmentName ?? '', 'fr');
    const groupes = partenaires
      .map(p => ({ p, feeds: feeds.filter(f => f.partnerId === p.userId).sort(tri) }))
      .filter(g => g.feeds.length > 0)
      .sort((a, b) => a.p.name.localeCompare(b.p.name, 'fr'));
    const connus = new Set(partenaires.map(p => p.userId));
    const orphelins = feeds.filter(f => !f.partnerId || !connus.has(f.partnerId)).sort(tri);
    return {
      groupes: orphelins.length ? [...groupes, { p: null, feeds: orphelins }] : groupes,
      sansCalendrier: partenaires.filter(p => !feeds.some(f => f.partnerId === p.userId))
        .sort((a, b) => a.name.localeCompare(b.name, 'fr')),
      enEchec: feeds.filter(f => f.lastSyncStatus === 'error').length,
      parLogement,
    };
  }, [feeds, partenaires]);

  async function voirRecus() {
    if (recus) { setRecus(null); return; }
    try {
      const d = await postJson<{ ok?: boolean; evenements?: typeof recus }>('/api/reservations/webhook-admin', { action: 'evenements' });
      setRecus(d.ok ? (d.evenements ?? []) : []);
    } catch { setRecus([]); }
  }

  const ouvrirSuperhote = (p: PartnerAccount) => { setAutrePour(null); setSuperhotePour(p); };
  const ouvrirAutre = (p: PartnerAccount) => { setSuperhotePour(null); setAutrePour(p); };

  return (
    <>
      {superhotePour && (
        <BrancherSuperhote partenaire={superhotePour} apartments={apartments}
          onFermer={() => setSuperhotePour(null)}
          onBranche={async () => { setSuperhotePour(null); await onRecharger(); }} />
      )}
      {autrePour && (
        <div className="rounded-2xl border p-4 mb-6" style={{ backgroundColor: '#FFFFFF', borderColor: '#C9A84C40' }}>
          <p className="text-sm font-semibold mb-3" style={{ color: '#1A1A1A' }}>Connecter un calendrier pour {autrePour.name}</p>
          <ConnectWizard
            apartments={apartments.filter(a => a.partnerId === autrePour.userId)}
            feeds={feeds.filter(f => f.partnerId === autrePour.userId)}
            partnerId={autrePour.userId!}
            partnerName={autrePour.name}
            onDone={() => { setAutrePour(null); void onRecharger(); }}
            onCancel={() => setAutrePour(null)}
          />
        </div>
      )}

      {enEchec > 0 && (
        <p className="text-xs font-semibold mb-4 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FDF3F2', color: '#8A3A31', border: '1px solid #E4B7B1' }}>
          {enEchec} calendrier{enEchec > 1 ? 's' : ''} en échec : ils sont en tête de leur conciergerie.
        </p>
      )}

      {groupes.length === 0 ? (
        <div className="rounded-2xl p-10 text-center border mb-8" style={carte}>
          <p className="text-sm" style={{ color: '#A8A09A' }}>Aucun calendrier connecté.</p>
        </div>
      ) : (
        <div className="space-y-5 mb-8">
          {groupes.map(({ p, feeds: liste }) => (
            <section key={p?.id ?? '__sans__'}>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h2 className={titreSection} style={{ color: '#1A1A1A' }}>{p?.name ?? 'Sans conciergerie'}</h2>
                <span className="text-xs" style={{ color: '#A8A09A' }}>
                  {liste.length} calendrier{liste.length > 1 ? 's' : ''}
                </span>
                <span className="flex-1" />
                {p && <ActionsConciergerie p={p} onSuperhote={() => ouvrirSuperhote(p)} onAutre={() => ouvrirAutre(p)} />}
              </div>
              <div className="rounded-2xl border overflow-hidden" style={carte}>
                {liste.map(f => <LigneCalendrier key={f.id} f={f} plusieurs={(parLogement.get(f.airbnbId) ?? 0) > 1} />)}
              </div>
            </section>
          ))}
        </div>
      )}

      {sansCalendrier.length > 0 && (
        <>
          <h2 className={`${titreSection} mb-3`} style={{ color: '#7A7068' }}>Conciergeries sans calendrier</h2>
          <div className="rounded-2xl border overflow-hidden mb-8" style={carte}>
            {sansCalendrier.map(p => (
              <div key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3 border-b last:border-0" style={{ borderColor: '#F2EFE9' }}>
                <span className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{p.name}</span>
                <span className="flex-1" />
                <ActionsConciergerie p={p} onSuperhote={() => ouvrirSuperhote(p)} onAutre={() => ouvrirAutre(p)} />
              </div>
            ))}
          </div>
        </>
      )}

      {/* Réception directe : ce que les logiciels des clients nous ont envoyé. */}
      <div className="flex items-baseline justify-between mb-3">
        <h2 className={titreSection} style={{ color: '#7A7068' }}>Réception directe</h2>
        <button onClick={voirRecus} className="text-[11px] underline" style={{ color: '#A8A09A' }}>
          {recus ? 'masquer' : 'évènements reçus'}
        </button>
      </div>
      {recus && (
        <div className="rounded-2xl border p-4" style={{ backgroundColor: '#FAFAF8', borderColor: '#E8E4DC' }}>
          <p className="text-xs font-semibold mb-2" style={{ color: '#1A1A1A' }}>20 derniers évènements reçus</p>
          {recus.length === 0 ? (
            <p className="text-xs" style={{ color: '#A8A09A' }}>
              Rien encore. Dès que le logiciel d’un client appellera son URL de réception, la forme de son message s’affichera ici.
            </p>
          ) : (
            <div className="grid gap-1.5">
              {recus.map((e, i) => (
                <p key={i} className="text-[11px]" style={{ color: e.resultat === 'rattache' ? '#5A8A6A' : '#B85A50' }}>
                  <span className="font-semibold">{e.source} · {e.resultat}</span>
                  {e.note ? ` — ${e.note}` : ''}
                  {e.champs.length ? <span style={{ color: '#A8A09A' }}> · champs : {e.champs.join(', ')}</span> : null}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
