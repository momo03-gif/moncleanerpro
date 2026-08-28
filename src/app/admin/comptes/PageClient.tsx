'use client';

import { useState, useEffect } from 'react';
import {
  getPendingHotelsDB, approveHotelDB, refuseHotelDB,
  getPendingAirbnbPartnersDB, approveAirbnbPartnerDB, refuseAirbnbPartnerDB,
  updateHotelRateDB, updateHotelClientTypeDB, getMissionsDB, getAirbnbs,
  getPartnerAccountsDB, updatePartnerInfoDB, setPartnerPasswordDB, setPartnerStatusDB, deletePartnerAccountDB,
  createHotelAccountDB, createAirbnbAccountDB,
  type PartnerAccount,
} from '@/lib/db';
import type { Mission, Apartment } from '@/lib/types';
import { inputStyle } from '@/lib/ui';
import { currentMonth } from '@/lib/mockData';
import Icon from '@/components/Icon';
import Loading from "@/components/Loading";

type PartnerKind = 'hotel' | 'airbnb';
interface PendingPartner {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  userId?: string;
  kind: PartnerKind;
}

const KIND_LABEL: Record<PartnerKind, string> = { hotel: 'Hôtel', airbnb: 'Airbnb / Conciergerie' };

// Normalise un nom de partenaire (espaces superflus / casse) pour un rapprochement
// fiable : les partner_name saisis sur les logements ont des variantes.
const normName = (s?: string | null) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

export default function ComptesPage() {
  const [pending, setPending] = useState<PendingPartner[]>([]);
  const [accounts, setAccounts] = useState<PartnerAccount[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState<Record<string, 'approved' | 'refused'>>({});
  const [actionErr, setActionErr] = useState<string | null>(null);
  // Recherche + tri (partagés par les deux listes).
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<'name' | 'revenue' | 'sites'>('name');
  // Formulaire de création d'un compte partenaire.
  const [creating, setCreating] = useState<null | 'hotel' | 'airbnb'>(null);

  async function load() {
    const [pendHotels, partners, allMissions, partnerAccounts, apts] = await Promise.all([
      getPendingHotelsDB(), getPendingAirbnbPartnersDB(), getMissionsDB(), getPartnerAccountsDB(), getAirbnbs(),
    ]);
    const list: PendingPartner[] = [
      ...pendHotels.map((h: any) => ({ ...h, kind: 'hotel' as const })),
      ...partners.map((p: any) => ({ ...p, kind: 'airbnb' as const })),
    ];
    setPending(list);
    setAccounts(partnerAccounts);
    setMissions(allMissions);
    setApartments(apts);
    setLoading(false);
  }

  const month = currentMonth();
  // Heures RÉALISÉES (missions terminées) pour un hôtel, ce mois — base de la facturation.
  function hotelHoursThisMonth(hotelName: string): number {
    const mins = missions
      .filter(m => m.source === 'hotel' && (m.requestedBy ?? m.property) === hotelName
        && m.status === 'completed' && m.date.startsWith(month))
      .reduce((s, m) => s + (m.missionDurationMinutes ?? 0), 0);
    return Math.round((mins / 60) * 100) / 100;
  }

  // Une mission appartient à une conciergerie si elle est liée à un logement de ce
  // compte : par partner_id (fiable après backfill) ou, à défaut, par nom normalisé.
  function isAirbnbMissionOf(m: Mission, a: PartnerAccount): boolean {
    return (!!a.userId && m.partnerId === a.userId) || (!!m.airbnbId && normName(m.partnerName) === normName(a.name));
  }

  // Logements/sites rattachés à un compte (conciergerie : par compte ou par nom).
  function sitesForAccount(a: PartnerAccount): Apartment[] {
    if (a.kind !== 'airbnb') return [];
    return apartments.filter(ap => (!!a.userId && ap.partnerId === a.userId) || normName(ap.partnerName) === normName(a.name));
  }

  // Missions d'un partenaire (hôtel : par nom ; conciergerie : par compte ou nom).
  function missionsForAccount(a: PartnerAccount): Mission[] {
    if (a.kind === 'hotel') return missions.filter(m => m.source === 'hotel' && (m.requestedBy ?? m.property) === a.name);
    return missions.filter(m => isAirbnbMissionOf(m, a));
  }

  // CA du mois : hôtel = heures × taux ; conciergerie = somme des ménages terminés.
  function revenueThisMonth(a: PartnerAccount): number {
    if (a.kind === 'hotel') return Math.round(hotelHoursThisMonth(a.name) * (a.billingHourlyRate ?? 0) * 100) / 100;
    const total = missions
      .filter(m => isAirbnbMissionOf(m, a) && m.status === 'completed' && m.date.startsWith(month))
      .reduce((s, m) => s + (m.price ?? 0), 0);
    return Math.round(total * 100) / 100;
  }

  useEffect(() => { load(); }, []);

  // On ne marque « traité » qu'après confirmation du serveur : afficher un succès
  // sur un appel qui a échoué laissait la fiche en attente et bloquait la
  // connexion du partenaire, sans que personne ne s'en aperçoive.
  async function handleApprove(p: PendingPartner) {
    setActionErr(null);
    try {
      if (p.kind === 'hotel') await approveHotelDB(p.id); else await approveAirbnbPartnerDB(p.id);
      setDone(d => ({ ...d, [p.id]: 'approved' }));
    } catch (e) {
      setActionErr(`Validation impossible pour ${p.name} : ${e instanceof Error ? e.message : 'erreur inconnue'}`);
    }
  }

  async function handleRefuse(p: PendingPartner) {
    setActionErr(null);
    try {
      if (p.kind === 'hotel') await refuseHotelDB(p.id); else await refuseAirbnbPartnerDB(p.id);
      setDone(d => ({ ...d, [p.id]: 'refused' }));
    } catch (e) {
      setActionErr(`Refus impossible pour ${p.name} : ${e instanceof Error ? e.message : 'erreur inconnue'}`);
    }
  }

  const active = pending.filter(h => !done[h.id]);
  const processed = pending.filter(h => done[h.id]);

  // Filtre par nom + tri, appliqué à chaque liste.
  function prepare(list: PartnerAccount[]): PartnerAccount[] {
    const q = query.toLowerCase().trim();
    const out = q ? list.filter(a => a.name.toLowerCase().includes(q)) : [...list];
    out.sort((a, b) => {
      if (sortKey === 'revenue') return revenueThisMonth(b) - revenueThisMonth(a);
      if (sortKey === 'sites') return sitesForAccount(b).length - sitesForAccount(a).length;
      return a.name.localeCompare(b.name);
    });
    return out;
  }
  const hotelAccounts = prepare(accounts.filter(a => a.kind === 'hotel'));
  const airbnbAccounts = prepare(accounts.filter(a => a.kind === 'airbnb'));

  const updateAccount = (u: PartnerAccount) =>
    setAccounts(list => list.map(x => (x.kind === u.kind && x.id === u.id ? u : x)));
  const removeAccount = (a: PartnerAccount) =>
    setAccounts(list => list.filter(x => !(x.kind === a.kind && x.id === a.id)));

  if (loading) return <Loading className="p-6 text-sm" />;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Partenaires</h1>
          <p className="text-sm mt-1" style={{ color: '#A8A09A' }}>Demandes d'inscription, comptes hôtels et conciergeries</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setCreating(c => (c === 'hotel' ? null : 'hotel'))}
            className="px-3 py-2 rounded-xl text-sm font-semibold border" style={{ borderColor: creating === 'hotel' ? '#C9A84C' : '#E8E4DC', color: '#1A1A1A' }}>
            + Hôtel
          </button>
          <button onClick={() => setCreating(c => (c === 'airbnb' ? null : 'airbnb'))}
            className="px-3 py-2 rounded-xl text-sm font-semibold border" style={{ borderColor: creating === 'airbnb' ? '#C9A84C' : '#E8E4DC', color: '#1A1A1A' }}>
            + Conciergerie
          </button>
        </div>
      </div>

      {creating && (
        <CreatePartnerForm kind={creating} onClose={() => setCreating(null)} onCreated={() => { setCreating(null); load(); }} />
      )}

      {actionErr && (
        <div role="alert" className="mb-4 rounded-xl border px-4 py-3 text-sm"
          style={{ borderColor: '#E4B7B1', backgroundColor: '#FDF3F2', color: '#8A3A31' }}>
          {actionErr}
        </div>
      )}

      {active.length === 0 && processed.length === 0 && (
        <div className="rounded-2xl p-10 flex flex-col items-center text-center border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
          <span className="mb-3" style={{ color: '#D4CEC4' }}><Icon name="accounts" size={30} /></span>
          <p className="font-medium" style={{ color: '#1A1A1A' }}>Aucune demande en attente</p>
          <p className="text-sm mt-1" style={{ color: '#A8A09A' }}>Toutes les demandes ont été traitées</p>
        </div>
      )}

      {active.length > 0 && (
        <div className="space-y-3 mb-8">
          {active.map(h => (
            <div key={h.id} className="rounded-2xl border p-5" style={{ backgroundColor: '#FFFFFF', borderColor: '#C48A2A40' }}>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="font-semibold" style={{ color: '#1A1A1A' }}>{h.name}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: h.kind === 'airbnb' ? '#C9A84C15' : '#F5F3EF', color: h.kind === 'airbnb' ? '#C9A84C' : '#7A7068' }}>
                      {KIND_LABEL[h.kind]}
                    </span>
                  </div>
                  {h.address && <p className="text-sm" style={{ color: '#7A7068' }}>{h.address}</p>}
                  <p className="text-sm" style={{ color: '#A8A09A' }}>
                    {h.email && <a href={`mailto:${h.email}`} className="hover:underline" style={{ color: '#A8A09A' }}>{h.email}</a>}
                    {h.phone && (<>{h.email ? ' · ' : ''}<a href={`tel:${h.phone.replace(/\s+/g, '')}`} className="font-medium hover:underline" style={{ color: '#C9A84C' }}>{h.phone}</a></>)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleApprove(h)} className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
                    Valider
                  </button>
                  <button onClick={() => handleRefuse(h)} className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-sm border" style={{ borderColor: '#E8E4DC', color: '#B85A50' }}>
                    Refuser
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {processed.length > 0 && (
        <>
          <h2 className="font-semibold mb-3" style={{ color: '#1A1A1A' }}>Traitées cette session</h2>
          <div className="space-y-2">
            {processed.map(h => (
              <div key={h.id} className="rounded-xl px-5 py-3 flex items-center gap-4 border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FAFAF8' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{h.name}</p>
                  <p className="text-xs" style={{ color: '#A8A09A' }}>{h.email}</p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full font-medium" style={{
                  backgroundColor: done[h.id] === 'approved' ? '#5A8A6A15' : '#B85A5015',
                  color: done[h.id] === 'approved' ? '#5A8A6A' : '#B85A50',
                }}>
                  {done[h.id] === 'approved' ? '✓ Validé' : '✕ Refusé'}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Recherche + tri, partagés par les deux listes de fiches. */}
      {accounts.length > 0 && (
        <div className="mt-10 flex flex-wrap items-center gap-2">
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher un partenaire…"
            className="flex-1 min-w-[180px] px-3 py-2 rounded-xl text-sm border" style={inputStyle} />
          <div className="flex gap-1">
            {([['name', 'Nom'], ['revenue', 'CA'], ['sites', 'Sites']] as const).map(([key, label]) => {
              const on = sortKey === key;
              return (
                <button key={key} onClick={() => setSortKey(key)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold border"
                  style={{ borderColor: on ? '#C9A84C' : '#E8E4DC', backgroundColor: on ? '#C9A84C' : '#FFFFFF', color: on ? '#1A1A1A' : '#A8A09A' }}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Fiches partenaires, classées : Hôtels d'un côté, Conciergeries de l'autre. */}
      {hotelAccounts.length > 0 && (
        <div className="mt-6">
          <h2 className="font-semibold mb-1" style={{ color: '#1A1A1A' }}>Hôtels</h2>
          <p className="text-sm mb-4" style={{ color: '#A8A09A' }}>Fiche, taux horaire facturé, type, et administration du compte.</p>
          <div className="space-y-3">
            {hotelAccounts.map(a => (
              <AccountCard key={`${a.kind}-${a.id}`} account={a} hoursThisMonth={hotelHoursThisMonth}
                revenue={revenueThisMonth(a)} sites={sitesForAccount(a)} recentMissions={missionsForAccount(a)}
                onUpdate={updateAccount} onDelete={() => removeAccount(a)} />
            ))}
          </div>
        </div>
      )}

      {airbnbAccounts.length > 0 && (
        <div className="mt-10">
          <h2 className="font-semibold mb-1" style={{ color: '#1A1A1A' }}>Conciergeries Airbnb</h2>
          <p className="text-sm mb-4" style={{ color: '#A8A09A' }}>Coordonnées, logements, CA, et administration du compte.</p>
          <div className="space-y-3">
            {airbnbAccounts.map(a => (
              <AccountCard key={`${a.kind}-${a.id}`} account={a}
                revenue={revenueThisMonth(a)} sites={sitesForAccount(a)} recentMissions={missionsForAccount(a)}
                onUpdate={updateAccount} onDelete={() => removeAccount(a)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Formulaire de création directe d'un compte partenaire (admin). ────────────────
function CreatePartnerForm({ kind, onClose, onCreated }: {
  kind: 'hotel' | 'airbnb';
  onClose: () => void;
  onCreated: () => void;
}) {
  const isHotel = kind === 'hotel';
  const [f, setF] = useState({ name: '', email: '', phone: '', address: '', password: '', rate: '', clientType: 'hotel' as 'hotel' | 'ehpad' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    // Téléphone OBLIGATOIRE : une fiche client sans numéro, c'est un client
    // qu'on ne peut pas rappeler le jour où une intervention pose question.
    if (!f.name.trim() || !f.email.trim() || !f.phone.trim() || f.password.length < 6) {
      setErr('Nom, email, téléphone et mot de passe (6 caractères min) requis.'); return;
    }
    setBusy(true);
    const res = isHotel
      ? await createHotelAccountDB({ name: f.name, address: f.address, email: f.email, phone: f.phone, password: f.password, rate: Number(f.rate) || 0, clientType: f.clientType })
      : await createAirbnbAccountDB({ name: f.name, email: f.email, phone: f.phone, password: f.password });
    setBusy(false);
    if (res.error) { setErr(res.error); return; }
    onCreated();
  }

  return (
    <div className="rounded-2xl border p-5 mb-6" style={{ backgroundColor: '#FFFFFF', borderColor: '#C9A84C40' }}>
      <p className="font-semibold mb-3" style={{ color: '#1A1A1A' }}>Nouveau compte {isHotel ? 'hôtel' : 'conciergerie'}</p>
      <div className="grid gap-2">
        <input value={f.name} onChange={e => setF(s => ({ ...s, name: e.target.value }))} placeholder={isHotel ? 'Nom de l’hôtel' : 'Nom de la conciergerie'} className="px-3 py-2 rounded-xl text-sm border" style={inputStyle} />
        <input value={f.email} onChange={e => setF(s => ({ ...s, email: e.target.value }))} placeholder="Email (identifiant de connexion)" className="px-3 py-2 rounded-xl text-sm border" style={inputStyle} />
        <input value={f.phone} onChange={e => setF(s => ({ ...s, phone: e.target.value }))} placeholder="Téléphone (obligatoire)" className="px-3 py-2 rounded-xl text-sm border" style={inputStyle} />
        {isHotel && (
          <input value={f.address} onChange={e => setF(s => ({ ...s, address: e.target.value }))} placeholder="Adresse" className="px-3 py-2 rounded-xl text-sm border" style={inputStyle} />
        )}
        <input value={f.password} onChange={e => setF(s => ({ ...s, password: e.target.value }))} placeholder="Mot de passe provisoire" className="px-3 py-2 rounded-xl text-sm border" style={inputStyle} />
        {isHotel && (
          <div className="flex items-center gap-2">
            <input type="number" min="0" step="0.5" value={f.rate} onChange={e => setF(s => ({ ...s, rate: e.target.value }))} placeholder="Taux €/h" className="w-28 px-3 py-2 rounded-xl text-sm border text-right" style={inputStyle} />
            <span className="text-sm" style={{ color: '#7A7068' }}>€ / h</span>
            <div className="flex gap-1 ml-2">
              {(['hotel', 'ehpad'] as const).map(ct => {
                const on = f.clientType === ct;
                return (
                  <button key={ct} onClick={() => setF(s => ({ ...s, clientType: ct }))}
                    className="text-[11px] px-2.5 py-1 rounded-full font-semibold border"
                    style={{ borderColor: on ? '#C9A84C' : '#E8E4DC', backgroundColor: on ? '#C9A84C' : '#FFFFFF', color: on ? '#1A1A1A' : '#A8A09A' }}>
                    {ct === 'hotel' ? 'Hôtel' : 'EHPAD'}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {err && <p className="text-xs mt-2" style={{ color: '#B85A50' }}>{err}</p>}
      <div className="flex gap-2 mt-3">
        <button disabled={busy} onClick={submit} className="px-4 py-2 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
          {busy ? 'Création…' : 'Créer le compte'}
        </button>
        <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm border" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>Annuler</button>
      </div>
    </div>
  );
}

// ── Fiche d'un compte partenaire : coordonnées + actions d'administration. ────────
function AccountCard({ account, onUpdate, onDelete, hoursThisMonth, revenue = 0, sites = [], recentMissions = [] }: {
  account: PartnerAccount;
  onUpdate: (a: PartnerAccount) => void;
  onDelete: () => void;
  hoursThisMonth?: (name: string) => number;
  revenue?: number;
  sites?: Apartment[];
  recentMissions?: Mission[];
}) {
  const [mode, setMode] = useState<'view' | 'edit' | 'password'>('view');
  const [showDetail, setShowDetail] = useState(false);
  const [form, setForm] = useState({ name: account.name, email: account.email, phone: account.phone, address: account.address });
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const suspended = account.status === 'suspended';

  // Facturation hôtel (fusionnée dans la fiche) : taux €/h + type + heures réalisées.
  const isHotel = account.kind === 'hotel';
  const [rate, setRate] = useState(account.billingHourlyRate != null ? String(account.billingHourlyRate) : '');
  const [clientType, setClientType] = useState<'hotel' | 'ehpad'>(account.clientType ?? 'hotel');
  const [rateSaved, setRateSaved] = useState(false);
  const hours = isHotel && hoursThisMonth ? hoursThisMonth(account.name) : 0;
  const toBill = Math.round(hours * (Number(rate) || 0) * 100) / 100;

  async function saveRate() {
    await updateHotelRateDB(account.id, Number(rate) || 0);
    onUpdate({ ...account, billingHourlyRate: Number(rate) || 0 });
    setRateSaved(true);
    setTimeout(() => setRateSaved(false), 1500);
  }

  async function saveType(ct: 'hotel' | 'ehpad') {
    if (ct === clientType) return;
    const prev = clientType;
    setClientType(ct);
    const res = await updateHotelClientTypeDB(account.id, ct);
    if (res.error) { setClientType(prev); flash(res.error); return; }
    onUpdate({ ...account, clientType: ct });
  }

  function flash(text: string) { setMsg(text); setTimeout(() => setMsg(m => (m === text ? null : m)), 1800); }

  async function saveEdit() {
    // Même règle qu'à la création : on n'enregistre pas une fiche sans numéro.
    if (!form.phone.trim()) { flash('Le téléphone est obligatoire.'); return; }
    setBusy(true);
    const { error } = await updatePartnerInfoDB(account.kind, account.id, form);
    setBusy(false);
    if (error) { flash(error); return; }
    onUpdate({ ...account, ...form });
    setMode('view'); flash('Coordonnées enregistrées');
  }

  async function savePassword() {
    if (password.length < 6) { flash('6 caractères minimum'); return; }
    setBusy(true);
    const { error } = await setPartnerPasswordDB(account.kind, account.id, password);
    setBusy(false);
    if (error) { flash(error); return; }
    setPassword(''); setMode('view'); flash('Mot de passe réinitialisé');
  }

  async function toggleSuspend() {
    setBusy(true);
    const { error } = await setPartnerStatusDB(account.kind, account.id, !suspended);
    setBusy(false);
    if (error) { flash(error); return; }
    onUpdate({ ...account, status: suspended ? 'approved' : 'suspended' });
    flash(suspended ? 'Compte réactivé' : 'Compte suspendu');
  }

  async function remove() {
    setBusy(true);
    const { error } = await deletePartnerAccountDB(account.kind, account.id);
    setBusy(false);
    if (error) { flash(error); return; }
    onDelete();
  }

  const kindLabel = account.kind === 'airbnb' ? 'Airbnb / Conciergerie' : 'Hôtel';

  return (
    <div className="rounded-2xl border p-4" style={{ backgroundColor: '#FFFFFF', borderColor: suspended ? '#B85A5040' : '#E8E4DC' }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{account.name}</p>
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: account.kind === 'airbnb' ? '#C9A84C15' : '#F5F3EF', color: account.kind === 'airbnb' ? '#C9A84C' : '#7A7068' }}>
              {kindLabel}
            </span>
            {suspended && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#B85A5015', color: '#B85A50' }}>Suspendu</span>
            )}
            {!isHotel && sites.length > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#F5F3EF', color: '#7A7068' }}>{sites.length} logement{sites.length > 1 ? 's' : ''}</span>
            )}
          </div>
          {account.address && <p className="text-xs mt-0.5" style={{ color: '#7A7068' }}>{account.address}</p>}
          <p className="text-xs mt-0.5" style={{ color: '#A8A09A' }}>
            {account.email && (
              <a href={`mailto:${account.email}`} className="hover:underline" style={{ color: '#A8A09A' }}>{account.email}</a>
            )}
            {account.phone && (
              <>
                {account.email ? ' · ' : ''}
                <a href={`tel:${account.phone.replace(/\s+/g, '')}`} className="font-medium hover:underline" style={{ color: '#C9A84C' }}>{account.phone}</a>
              </>
            )}
          </p>
          {!isHotel && (
            <p className="text-xs mt-0.5" style={{ color: '#A8A09A' }}>CA ce mois : <span className="font-semibold" style={{ color: '#5A8A6A' }}>{revenue} €</span></p>
          )}
        </div>
        {msg && <span className="text-xs font-medium" style={{ color: '#5A8A6A' }}>{msg}</span>}
      </div>

      {/* Bloc facturation — hôtels uniquement : taux €/h, type, heures réalisées. */}
      {isHotel && (
        <div className="mt-3 pt-3 border-t" style={{ borderColor: '#F2EFE9' }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-1">
              {(['hotel', 'ehpad'] as const).map(ct => {
                const on = clientType === ct;
                return (
                  <button key={ct} onClick={() => saveType(ct)}
                    className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold border transition-all"
                    style={{ borderColor: on ? '#C9A84C' : '#E8E4DC', backgroundColor: on ? '#C9A84C' : '#FFFFFF', color: on ? '#1A1A1A' : '#A8A09A' }}>
                    {ct === 'hotel' ? 'Hôtel' : 'EHPAD'}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <input type="number" min="0" step="0.5" value={rate}
                  onChange={e => setRate(e.target.value)}
                  placeholder="0" className="w-24 px-3 py-2 rounded-xl text-sm border text-right" style={inputStyle} />
                <span className="text-sm" style={{ color: '#7A7068' }}>€ / h</span>
              </div>
              <button onClick={saveRate}
                className="px-4 py-2 rounded-xl text-sm font-semibold" style={{ backgroundColor: rateSaved ? '#5A8A6A' : '#C9A84C', color: rateSaved ? '#FFFFFF' : '#1A1A1A' }}>
                {rateSaved ? '✓ Enregistré' : 'Enregistrer'}
              </button>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1">
            <span className="text-xs" style={{ color: '#A8A09A' }}>Heures réalisées ce mois : <span className="font-semibold" style={{ color: '#1A1A1A' }}>{hours} h</span></span>
            <span className="text-xs" style={{ color: '#A8A09A' }}>À facturer ce mois : <span className="font-semibold" style={{ color: '#5A8A6A' }}>{toBill} €</span></span>
          </div>
        </div>
      )}

      {mode === 'edit' && (
        <div className="mt-3 pt-3 border-t grid gap-2" style={{ borderColor: '#F2EFE9' }}>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nom" className="px-3 py-2 rounded-xl text-sm border" style={inputStyle} />
          <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Email" className="px-3 py-2 rounded-xl text-sm border" style={inputStyle} />
          <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Téléphone (obligatoire)" className="px-3 py-2 rounded-xl text-sm border" style={inputStyle} />
          {account.kind === 'hotel' && (
            <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Adresse" className="px-3 py-2 rounded-xl text-sm border" style={inputStyle} />
          )}
          <div className="flex gap-2 mt-1">
            <button disabled={busy} onClick={saveEdit} className="px-4 py-2 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>Enregistrer</button>
            <button onClick={() => { setMode('view'); setForm({ name: account.name, email: account.email, phone: account.phone, address: account.address }); }} className="px-4 py-2 rounded-xl text-sm border" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>Annuler</button>
          </div>
        </div>
      )}

      {mode === 'password' && (
        <div className="mt-3 pt-3 border-t flex flex-wrap items-center gap-2" style={{ borderColor: '#F2EFE9' }}>
          <input type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="Nouveau mot de passe" className="flex-1 min-w-[180px] px-3 py-2 rounded-xl text-sm border" style={inputStyle} />
          <button disabled={busy} onClick={savePassword} className="px-4 py-2 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>Définir</button>
          <button onClick={() => { setMode('view'); setPassword(''); }} className="px-4 py-2 rounded-xl text-sm border" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>Annuler</button>
        </div>
      )}

      {mode === 'view' && (
        <div className="mt-3 pt-3 border-t flex flex-wrap gap-2" style={{ borderColor: '#F2EFE9' }}>
          <button onClick={() => setShowDetail(d => !d)} className="px-3 py-1.5 rounded-lg text-xs font-medium border" style={{ borderColor: showDetail ? '#C9A84C' : '#E8E4DC', color: '#1A1A1A' }}>Détail</button>
          <button onClick={() => setMode('edit')} className="px-3 py-1.5 rounded-lg text-xs font-medium border" style={{ borderColor: '#E8E4DC', color: '#1A1A1A' }}>Modifier</button>
          <button onClick={() => setMode('password')} className="px-3 py-1.5 rounded-lg text-xs font-medium border" style={{ borderColor: '#E8E4DC', color: '#1A1A1A' }}>Mot de passe</button>
          <button disabled={busy} onClick={toggleSuspend} className="px-3 py-1.5 rounded-lg text-xs font-medium border" style={{ borderColor: '#E8E4DC', color: suspended ? '#5A8A6A' : '#C48A2A' }}>
            {suspended ? 'Réactiver' : 'Suspendre'}
          </button>
          {confirmDel ? (
            <span className="flex items-center gap-2">
              <button disabled={busy} onClick={remove} className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ backgroundColor: '#B85A50', color: '#FFFFFF' }}>Confirmer la suppression</button>
              <button onClick={() => setConfirmDel(false)} className="px-3 py-1.5 rounded-lg text-xs border" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>Annuler</button>
            </span>
          ) : (
            <button onClick={() => setConfirmDel(true)} className="px-3 py-1.5 rounded-lg text-xs font-medium border" style={{ borderColor: '#B85A5040', color: '#B85A50' }}>Supprimer</button>
          )}
        </div>
      )}

      {/* Panneau détail : logements rattachés + missions récentes. */}
      {showDetail && mode === 'view' && (
        <div className="mt-3 pt-3 border-t grid gap-4 sm:grid-cols-2" style={{ borderColor: '#F2EFE9' }}>
          {!isHotel && (
            <div>
              <p className="text-xs font-semibold mb-1.5" style={{ color: '#1A1A1A' }}>Logements ({sites.length})</p>
              {sites.length === 0 ? (
                <p className="text-xs" style={{ color: '#A8A09A' }}>Aucun logement rattaché.</p>
              ) : (
                <ul className="space-y-1">
                  {sites.map(s => (
                    <li key={s.id} className="text-xs" style={{ color: '#7A7068' }}>
                      <span className="font-medium" style={{ color: '#1A1A1A' }}>{s.name}</span>
                      {s.clientPrice != null ? ` · ${s.clientPrice} €/ménage` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className={isHotel ? 'sm:col-span-2' : ''}>
            <p className="text-xs font-semibold mb-1.5" style={{ color: '#1A1A1A' }}>Missions récentes</p>
            {recentMissions.length === 0 ? (
              <p className="text-xs" style={{ color: '#A8A09A' }}>Aucune mission.</p>
            ) : (
              <ul className="space-y-1">
                {[...recentMissions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6).map(m => (
                  <li key={m.id} className="text-xs flex items-center justify-between gap-2" style={{ color: '#7A7068' }}>
                    <span>{m.date} · {m.property}</span>
                    <span className="font-medium" style={{ color: m.status === 'completed' ? '#5A8A6A' : '#A8A09A' }}>{m.price ? `${m.price} €` : '—'}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
