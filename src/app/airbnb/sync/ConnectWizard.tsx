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
import type { Apartment, ReservationPlatform } from '@/lib/types';
import { Button, Card, FIELD_SM, Label } from '@/components/ui';
import Icon from '@/components/Icon';

const PLATFORM_LABEL: Record<string, string> = {
  airbnb: 'Airbnb', booking: 'Booking.com', guesty: 'Guesty', hostaway: 'Hostaway',
  lodgify: 'Lodgify', smoobu: 'Smoobu', beds24: 'Beds24', amenitiz: 'Amenitiz',
  ical: 'Flux iCal', other: 'Autre outil',
};

interface CheckResult {
  ok: boolean;
  error?: string;
  platform?: ReservationPlatform;
  total?: number;
  upcoming?: number;
  nextCheckOut?: string | null;
}

export default function ConnectWizard({ apartments, partnerId, partnerName, onDone, onCancel }: {
  apartments: Apartment[];
  partnerId: string;
  partnerName?: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  // Logement : existant, ou créé à la volée (première connexion).
  const [aptId, setAptId] = useState(apartments[0]?.id ?? 'new');
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

  const canConnect = (!creatingApt || (name.trim() && address.trim())) && urlLooksRight && !saving;

  return (
    <Card as="section" className="mb-5 p-4 space-y-4">
      <div>
        <p className="text-sm font-bold text-ink">Connecter un logement</p>
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
              <Icon name="check" size={12} /> {PLATFORM_LABEL[platform] ?? 'Calendrier'} reconnu
            </p>
          ) : (
            <p className="text-[11px] mt-1.5 text-warn">
              Ce lien ne ressemble pas à un export de calendrier — copiez le lien d&apos;export (.ics), pas l&apos;adresse de l&apos;annonce.
            </p>
          )
        )}

        <p className="text-[11px] mt-1.5 text-muted">{PLATFORM_HELP[platform ?? 'ical']}</p>

        {urlLooksRight && (
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
function PmsConnect({ airbnbId, onNeedApartment, onDone }: {
  airbnbId: string | null;
  onNeedApartment: () => void;
  onDone: () => void;
}) {
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [apartments, setApartments] = useState<{ id: number; name: string }[] | null>(null);
  const [chosen, setChosen] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function test() {
    setBusy(true); setErr(''); setApartments(null);
    const res = await fetch('/api/reservations/pms', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'test', platform: 'smoobu', apiKey, apiSecret }),
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
      body: JSON.stringify({ action: 'connect', platform: 'smoobu', apiKey, apiSecret, airbnbId, externalPropertyId: chosen }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || !data.ok) { setErr(data.error ?? 'Enregistrement impossible.'); return; }
    onDone();
  }

  return (
    <div className="rounded-xl p-3 space-y-2.5 bg-surface-2">
      <p className="text-[11px] text-muted">
        Dans Smoobu : Paramètres → API. Générez une clé, copiez la clé <em>et</em> le secret.
        L&apos;API apporte en plus les heures d&apos;arrivée et de départ — donc les départs tardifs.
      </p>
      <input value={apiKey} onChange={e => { setApiKey(e.target.value); setApartments(null); }}
        placeholder="Clé API (usr_live_…)" className={FIELD_SM} />
      <input value={apiSecret} onChange={e => { setApiSecret(e.target.value); setApartments(null); }}
        type="password" placeholder="Secret" className={FIELD_SM} />

      {!apartments && (
        <button type="button" onClick={test} disabled={busy || !apiKey.trim() || !apiSecret.trim()}
          className="w-full py-2.5 rounded-xl text-xs font-semibold border border-line text-muted disabled:opacity-50">
          {busy ? 'Vérification…' : 'Vérifier la clé'}
        </button>
      )}

      {apartments && (
        apartments.length === 0 ? (
          <p className="text-[11px] text-warn">Aucun logement dans ce compte Smoobu.</p>
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
            <button type="button" onClick={connect} disabled={busy || !chosen}
              className="w-full py-2.5 rounded-xl text-xs font-semibold bg-gold text-ink disabled:opacity-50">
              {busy ? '…' : 'Connecter ce logement'}
            </button>
          </>
        )
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
