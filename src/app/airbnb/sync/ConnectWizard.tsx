'use client';

// ── Connecter un logement en un seul parcours ─────────────────────────────────
//
// Avant : créer le logement dans un écran, aller dans un autre écran, choisir le
// logement, choisir la plateforme dans une liste, coller le lien, enregistrer,
// puis découvrir à la première synchro que le lien était mauvais.
//
// Ici : le logement peut être créé à la volée, la plateforme est DEVINÉE à partir
// du lien collé, et le lien est VÉRIFIÉ avant d'être enregistré — on annonce ce
// qu'on a trouvé dedans (« 12 réservations, prochain départ le 18 août »).

import { useState } from 'react';
import { createAirbnb, createReservationFeed } from '@/lib/db';
import { detectPlatform, isLikelyIcalUrl, normalizeIcalUrl, PLATFORM_HELP } from '@/lib/icalUrl';
import { pmsSelectable, findPms, platformLabel } from '@/lib/pms/registry';
import type { Apartment, ReservationFeed, ReservationPlatform } from '@/lib/types';
import { Button, Card, FIELD_SM, Label } from '@/components/ui';
import Icon from '@/components/Icon';

interface CheckResult {
  ok: boolean;
  error?: string;
  platform?: ReservationPlatform;
  total?: number;
  upcoming?: number;
  nextCheckOut?: string | null;
}

export default function ConnectWizard({
  apartments, feeds, initialApartmentId, partnerId, partnerName, onDone, onCancel,
}: {
  apartments: Apartment[];
  /** Calendriers déjà connectés — sert à dire au partenaire ce qu'il ajoute. */
  feeds: ReservationFeed[];
  /** Logement pré-sélectionné (bouton « Ajouter un calendrier » d'un logement). */
  initialApartmentId?: string | null;
  partnerId: string;
  partnerName?: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  // Logement : existant, ou créé à la volée (première connexion).
  const [aptId, setAptId] = useState(initialApartmentId ?? apartments[0]?.id ?? 'new');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');

  // Lien iCal (universel, dates seules) ou clé API du PMS (dates + horaires).
  const [source, setSource] = useState<'ical' | 'api'>('ical');
  const [url, setUrl] = useState('');
  const [checking, setChecking] = useState(false);
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const creatingApt = aptId === 'new';
  // Ce que ce logement porte déjà — pour l'annoncer plutôt que de le laisser deviner.
  const alreadyConnected = creatingApt ? [] : feeds.filter(f => f.airbnbId === aptId);
  const platform = detectPlatform(url);
  const urlLooksRight = isLikelyIcalUrl(url);

  async function verify() {
    setChecking(true); setCheck(null); setError('');
    try {
      const res = await fetch('/api/reservations/check', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: normalizeIcalUrl(url) }),
      });
      setCheck(await res.json());
    } catch {
      setCheck({ ok: false, error: 'Vérification impossible pour le moment.' });
    }
    setChecking(false);
  }

  async function connect() {
    setSaving(true); setError('');

    // 1. Le logement — créé maintenant s'il n'existe pas encore.
    let targetId = aptId;
    if (creatingApt) {
      if (!name.trim() || !address.trim()) { setError('Nom et adresse du logement requis.'); setSaving(false); return; }
      const created = await createAirbnb({
        name: name.trim(), address: address.trim(), entryDirectives: '',
        partnerId, partnerName,
      });
      if (!created) { setError('Création du logement impossible.'); setSaving(false); return; }
      targetId = created;
    }

    // 2. Le calendrier.
    const res = await createReservationFeed({
      airbnbId: targetId, partnerId,
      platform: (check?.platform ?? platform ?? 'ical') as ReservationPlatform,
      icalUrl: normalizeIcalUrl(url),
    });
    setSaving(false);
    if (res.error) { setError(res.error); return; }
    onDone();
  }

  // Connectable dès que le lien ressemble à un calendrier OU que la vérification
  // en a lu un pour de bon : aucun logiciel ne doit rester à la porte à cause de
  // la forme de son adresse.
  const linkUsable = urlLooksRight || check?.ok === true;
  const canConnect = (!creatingApt || (name.trim() && address.trim())) && linkUsable && !saving;

  return (
    <Card as="section" className="mb-5 p-4 space-y-4">
      <div>
        <p className="text-sm font-bold text-ink">
          {alreadyConnected.length > 0 ? 'Ajouter un calendrier' : 'Connecter un logement'}
        </p>
        <p className="text-xs mt-0.5 text-muted">
          Une fois connecté, chaque départ crée automatiquement le ménage correspondant.
        </p>
      </div>

      {/* ── 1. Le logement ───────────────────────────────────────────────── */}
      <div>
        <Step n={1} title="Quel logement ?" />
        {apartments.length > 0 && (
          <select value={aptId} onChange={e => setAptId(e.target.value)} className={`${FIELD_SM} appearance-none`}>
            {apartments.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            <option value="new">+ Nouveau logement…</option>
          </select>
        )}
        {/* Un logement peut porter plusieurs calendriers : Airbnb + Booking +
            Abritel pour un propriétaire sans logiciel de gestion. On le dit ici,
            sinon personne ne devine qu'il faut repasser par le même écran. */}
        {alreadyConnected.length > 0 && (
          <p className="text-[11px] mt-1.5 text-muted">
            Ce logement a déjà {alreadyConnected.length} calendrier{alreadyConnected.length > 1 ? 's' : ''} ({alreadyConnected.map(f => platformLabel(f.platform)).join(', ')}).
            Vous pouvez en ajouter un autre : les départs sont fusionnés, un seul ménage par date.
          </p>
        )}

        {creatingApt && (
          <div className="space-y-2 mt-2">
            <div>
              <Label htmlFor="cw-name">Nom du logement</Label>
              <input id="cw-name" value={name} onChange={e => setName(e.target.value)}
                placeholder="Ex. T2 Croix-Rousse" className={FIELD_SM} />
            </div>
            <div>
              <Label htmlFor="cw-address">Adresse</Label>
              <input id="cw-address" value={address} onChange={e => setAddress(e.target.value)}
                placeholder="12 rue des Tables Claudiennes, Lyon" className={FIELD_SM} />
            </div>
            <p className="text-[11px] text-faint">
              Vous compléterez codes d&apos;accès, prix et standard de ménage ensuite, sur la fiche du logement.
            </p>
          </div>
        )}
      </div>

      {/* ── 2. La source des réservations ────────────────────────────────── */}
      <div>
        <Step n={2} title="D’où viennent vos réservations ?" />
        <div className="flex gap-2 mb-3">
          <SourceChoice active={source === 'ical'} onClick={() => setSource('ical')}
            title="Lien de calendrier" desc="Airbnb, Booking… — les dates" />
          <SourceChoice active={source === 'api'} onClick={() => setSource('api')}
            title="Clé de mon logiciel" desc="Smoobu — dates + horaires" />
        </div>

        {source === 'api' && (
          <PmsConnect
            airbnbId={creatingApt ? null : aptId}
            onNeedApartment={() => setError('Choisissez d’abord un logement existant (la clé se rattache à un logement).')}
            onFallbackToIcal={() => setSource('ical')}
            onDone={onDone}
          />
        )}
      </div>

      {source === 'ical' && (
      <div>
        <Step n={3} title="Collez le lien de votre calendrier" />
        <input value={url} onChange={e => { setUrl(e.target.value); setCheck(null); }}
          placeholder="https://…​.ics" inputMode="url" className={FIELD_SM} />

        {/* La plateforme se devine — pas de liste déroulante à remplir. */}
        {url.trim().length > 8 && (
          platform && urlLooksRight ? (
            <p className="text-[11px] mt-1.5 flex items-center gap-1.5 text-success">
              <Icon name="check" size={12} /> {platformLabel(platform)} reconnu
            </p>
          ) : (
            // On ne bloque pas : certains logiciels servent leur calendrier sur
            // une adresse qui n'annonce ni « .ics » ni « calendar ». Le bouton
            // Vérifier reste offert, et c'est le contenu qui tranche.
            <p className="text-[11px] mt-1.5 text-warn">
              Ce lien ne ressemble pas à un export de calendrier — vérifiez-le : s&apos;il en est
              un, vous pourrez le connecter quand même.
            </p>
          )
        )}

        <p className="text-[11px] mt-1.5 text-muted">{PLATFORM_HELP[platform ?? 'ical']}</p>

        {url.trim().length > 8 && (
          <button type="button" onClick={verify} disabled={checking}
            className="mt-2 text-xs font-semibold px-3 py-2 rounded-lg border border-line text-muted disabled:opacity-50">
            {checking ? 'Vérification…' : 'Vérifier le lien'}
          </button>
        )}

        {/* Résultat de la vérification : on dit ce qu'on a vu dans le calendrier. */}
        {check && (
          <div className={`mt-2 rounded-xl border px-3 py-2.5 ${check.ok ? 'border-success-line bg-success-soft' : 'border-danger-line bg-danger-soft'}`}>
            {check.ok ? (
              <>
                <p className="text-xs font-semibold text-success">Calendrier lu correctement</p>
                <p className="text-[11px] mt-0.5 text-success">
                  {check.upcoming ?? 0} réservation{(check.upcoming ?? 0) > 1 ? 's' : ''} à venir
                  {check.nextCheckOut
                    ? ` · prochain départ le ${new Date(check.nextCheckOut + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`
                    : ''}
                </p>
              </>
            ) : (
              <p className="text-xs text-danger">{check.error}</p>
            )}
          </div>
        )}
      </div>
      )}

      {/* ── 4. Connexion ─────────────────────────────────────────────────── */}
      <div>
        <Step n={4} title="C’est tout" />
        <p className="text-[11px] mb-2 text-muted">
          La synchronisation tourne ensuite automatiquement 2×/jour. Vous pouvez la forcer à tout moment.
        </p>
        {error && <p role="alert" className="text-xs px-3 py-2 rounded-lg mb-2 bg-danger-soft text-danger">{error}</p>}
        <div className="flex gap-2">
          {source === 'ical' && (
            <Button onClick={connect} disabled={!canConnect} className="flex-1">
              {saving ? '…' : 'Connecter le logement'}
            </Button>
          )}
          <Button variant="ghost" onClick={onCancel} className={source === 'api' ? 'flex-1' : undefined}>
            {source === 'api' ? 'Fermer' : 'Annuler'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function SourceChoice({ active, onClick, title, desc }: {
  active: boolean; onClick: () => void; title: string; desc: string;
}) {
  return (
    <button type="button" onClick={onClick}
      className={`flex-1 text-left rounded-xl border px-3 py-2.5 ${active ? 'border-gold bg-gold-soft' : 'border-line bg-card'}`}>
      <span className={`block text-xs font-semibold ${active ? 'text-gold-ink' : 'text-ink'}`}>{title}</span>
      <span className="block text-[10px] text-muted">{desc}</span>
    </button>
  );
}

// ── Connexion par clé API (Smoobu) ────────────────────────────────────────────
// En deux temps volontairement : on teste la clé et on affiche LES LOGEMENTS du
// compte, puis la conciergerie désigne celui qui correspond. Coller une clé sans
// savoir si elle marche, c'est exactement ce qu'on reproche aux autres.
function PmsConnect({ airbnbId, onNeedApartment, onFallbackToIcal, onDone }: {
  airbnbId: string | null;
  onNeedApartment: () => void;
  onFallbackToIcal: () => void;
  onDone: () => void;
}) {
  // Les logiciels proposés : ceux qu'on sait lire par API d'abord, puis ceux qui
  // passent par le lien de calendrier, et « Autre logiciel » pour les absents.
  const SOFTWARE = pmsSelectable();
  const [pmsId, setPmsId] = useState('smoobu');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  // L'identifiant du logement chez l'éditeur : nombre chez les uns, UUID chez
// les autres. On le traite en texte de bout en bout.
  const [apartments, setApartments] = useState<{ id: number | string; name: string }[] | null>(null);
  const [chosen, setChosen] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function test() {
    setBusy(true); setErr(''); setApartments(null);
    const res = await fetch('/api/reservations/pms', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'test', platform: pmsId, apiKey, apiSecret }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!data.ok) { setErr(data.error ?? 'Connexion refusée.'); return; }
    setApartments(data.apartments ?? []);
    if ((data.apartments ?? []).length === 1) setChosen(String(data.apartments[0].id));
  }

  async function connect() {
    if (!airbnbId) { onNeedApartment(); return; }
    setBusy(true); setErr('');
    const res = await fetch('/api/reservations/pms', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'connect', platform: pmsId, apiKey, apiSecret, airbnbId, externalPropertyId: chosen }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || !data.ok) { setErr(data.error ?? 'Enregistrement impossible.'); return; }
    onDone();
  }

  const pms = findPms(pmsId);
  const apiReady = pms?.api !== false && !!pms;
  const fields = pms && pms.api !== false ? pms.api.fields : [];
  const canTest = fields.every(f => (f.name === 'apiKey' ? apiKey : apiSecret).trim().length > 0);

  return (
    <div className="rounded-xl p-3 space-y-2.5 bg-surface-2">
      <div>
        <Label htmlFor="pms-soft">Votre logiciel</Label>
        <select id="pms-soft" value={pmsId}
          onChange={e => { setPmsId(e.target.value); setApartments(null); setErr(''); }}
          className={`${FIELD_SM} appearance-none`}>
          {/* Deux groupes, pour que personne ne cherche : ce qu'on sait lire par
              clé, puis le reste — qui se connecte par le lien de calendrier. */}
          <optgroup label="Connexion directe (clé API)">
            {SOFTWARE.filter(p => p.api !== false).map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </optgroup>
          <optgroup label="Par lien de calendrier">
            {SOFTWARE.filter(p => p.api === false).map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </optgroup>
        </select>
      </div>

      {/* Pas de connecteur pour ce logiciel : on le dit, et on renvoie vers la
          voie qui marche avec tous. Mieux vaut ça qu'une clé enregistrée que la
          synchro ne saurait pas lire. */}
      {!apiReady ? (
        <div className="rounded-xl border border-warn-line bg-warn-soft px-3 py-2.5">
          <p className="text-[11px] text-warn">
            Pas encore de connexion directe pour {pms && pms.id !== 'other' ? pms.label : 'ce logiciel'}.
            Le lien de calendrier fonctionne avec lui — vous aurez les dates, mais pas les
            horaires d&apos;arrivée et de départ.
          </p>
          <button type="button" onClick={onFallbackToIcal}
            className="mt-2 text-[11px] font-semibold underline text-warn">
            Passer au lien de calendrier
          </button>
        </div>
      ) : (
      <>
      <p className="text-[11px] text-muted">
        {pms!.api !== false && pms!.api.help} L&apos;API apporte en plus les heures d&apos;arrivée
        et de départ — donc les départs tardifs.
      </p>

      {/* Connecteur décrit d'après ce que l'éditeur publie, jamais essayé contre
          un vrai compte. On le dit avant la saisie plutôt que de laisser
          découvrir l'échec — et « Vérifier la clé » tranche en deux secondes. */}
      {pms!.api !== false && pms!.api.verified === false && (
        <p className="text-[11px] rounded-xl border px-3 py-2 border-warn-line bg-warn-soft text-warn">
          Connexion {pms!.label} encore jamais confirmée sur un compte réel. Vérifiez votre clé
          ci-dessous : si elle passe, tout fonctionne ; sinon, le lien de calendrier prend le relais.
        </p>
      )}
      {/* Chaque éditeur demande ce qui lui est propre : Smoobu une clé et un
          secret, Beds24 et Lodgify une clé seule. On n'affiche que le nécessaire. */}
      {fields.map((f, i) => (
        <input key={f.name}
          value={f.name === 'apiKey' ? apiKey : apiSecret}
          onChange={e => {
            if (f.name === 'apiKey') setApiKey(e.target.value); else setApiSecret(e.target.value);
            setApartments(null);
          }}
          type={f.secret ? 'password' : 'text'}
          autoFocus={i === 0}
          placeholder={f.label} className={FIELD_SM} />
      ))}

      {!apartments && (
        <button type="button" onClick={test} disabled={busy || !canTest}
          className="w-full py-2.5 rounded-xl text-xs font-semibold border border-line text-muted disabled:opacity-50">
          {busy ? 'Vérification…' : 'Vérifier la clé'}
        </button>
      )}

      {apartments && (
        apartments.length === 0 ? (
          <p className="text-[11px] text-warn">Aucun logement dans ce compte {pms!.label}.</p>
        ) : (
          <>
            <p className="text-[11px] flex items-center gap-1.5 text-success">
              <Icon name="check" size={12} /> Clé valide — {apartments.length} logement{apartments.length > 1 ? 's' : ''} trouvé{apartments.length > 1 ? 's' : ''}
            </p>
            <div>
              <Label htmlFor="pms-apt">Lequel correspond à ce logement ?</Label>
              <select id="pms-apt" value={chosen} onChange={e => setChosen(e.target.value)}
                className={`${FIELD_SM} appearance-none`}>
                <option value="">Sélectionner</option>
                {apartments.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            {/* La conciergerie doit savoir exactement ce qu'on lit chez elle :
                un seul logement, celui qu'on entretient. Pas son activité. */}
            <p className="text-[10px] text-faint">
              Nous ne lisons que les réservations du logement choisi. Vos autres logements
              restent invisibles pour nous, même s&apos;ils apparaissent dans cette liste.
            </p>
            <button type="button" onClick={connect} disabled={busy || !chosen}
              className="w-full py-2.5 rounded-xl text-xs font-semibold bg-gold text-ink disabled:opacity-50">
              {busy ? '…' : 'Connecter ce logement'}
            </button>
          </>
        )
      )}
      </>
      )}

      {err && <p role="alert" className="text-[11px] text-danger">{err}</p>}
    </div>
  );
}

function Step({ n, title }: { n: number; title: string }) {
  return (
    <p className="text-xs font-semibold mb-1.5 flex items-center gap-2 text-ink">
      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 bg-gold-soft text-gold-ink border border-gold-line">{n}</span>
      {title}
    </p>
  );
}
