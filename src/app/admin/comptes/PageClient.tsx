'use client';

import { useState, useEffect } from 'react';
import {
  getPendingHotelsDB, approveHotelDB, refuseHotelDB,
  getPendingAirbnbPartnersDB, approveAirbnbPartnerDB, refuseAirbnbPartnerDB,
  updateHotelRateDB, updateHotelClientTypeDB, getMissionsDB,
  getPartnerAccountsDB, updatePartnerInfoDB, setPartnerPasswordDB, setPartnerStatusDB, deletePartnerAccountDB,
  type PartnerAccount,
} from '@/lib/db';
import type { Mission } from '@/lib/types';
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

export default function ComptesPage() {
  const [pending, setPending] = useState<PendingPartner[]>([]);
  const [accounts, setAccounts] = useState<PartnerAccount[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState<Record<string, 'approved' | 'refused'>>({});

  async function load() {
    const [pendHotels, partners, allMissions, partnerAccounts] = await Promise.all([
      getPendingHotelsDB(), getPendingAirbnbPartnersDB(), getMissionsDB(), getPartnerAccountsDB(),
    ]);
    const list: PendingPartner[] = [
      ...pendHotels.map((h: any) => ({ ...h, kind: 'hotel' as const })),
      ...partners.map((p: any) => ({ ...p, kind: 'airbnb' as const })),
    ];
    setPending(list);
    setAccounts(partnerAccounts);
    setMissions(allMissions);
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

  useEffect(() => { load(); }, []);

  async function handleApprove(p: PendingPartner) {
    if (p.kind === 'hotel') await approveHotelDB(p.id); else await approveAirbnbPartnerDB(p.id);
    setDone(d => ({ ...d, [p.id]: 'approved' }));
  }

  async function handleRefuse(p: PendingPartner) {
    if (p.kind === 'hotel') await refuseHotelDB(p.id); else await refuseAirbnbPartnerDB(p.id);
    setDone(d => ({ ...d, [p.id]: 'refused' }));
  }

  const active = pending.filter(h => !done[h.id]);
  const processed = pending.filter(h => done[h.id]);
  const hotelAccounts = accounts.filter(a => a.kind === 'hotel');
  const airbnbAccounts = accounts.filter(a => a.kind === 'airbnb');

  const updateAccount = (u: PartnerAccount) =>
    setAccounts(list => list.map(x => (x.kind === u.kind && x.id === u.id ? u : x)));
  const removeAccount = (a: PartnerAccount) =>
    setAccounts(list => list.filter(x => !(x.kind === a.kind && x.id === a.id)));

  if (loading) return <Loading className="p-6 text-sm" />;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Partenaires</h1>
        <p className="text-sm mt-1" style={{ color: '#A8A09A' }}>Demandes d'inscription des partenaires hôtel et Airbnb / conciergerie</p>
      </div>

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
                  <p className="text-sm" style={{ color: '#A8A09A' }}>{h.email}{h.phone ? ` · ${h.phone}` : ''}</p>
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

      {/* Fiches partenaires, classées : Hôtels d'un côté, Conciergeries de l'autre. */}
      {hotelAccounts.length > 0 && (
        <div className="mt-10">
          <h2 className="font-semibold mb-1" style={{ color: '#1A1A1A' }}>Hôtels</h2>
          <p className="text-sm mb-4" style={{ color: '#A8A09A' }}>Fiche, taux horaire facturé, type, et administration du compte.</p>
          <div className="space-y-3">
            {hotelAccounts.map(a => (
              <AccountCard key={`${a.kind}-${a.id}`} account={a} hoursThisMonth={hotelHoursThisMonth}
                onUpdate={updateAccount} onDelete={() => removeAccount(a)} />
            ))}
          </div>
        </div>
      )}

      {airbnbAccounts.length > 0 && (
        <div className="mt-10">
          <h2 className="font-semibold mb-1" style={{ color: '#1A1A1A' }}>Conciergeries Airbnb</h2>
          <p className="text-sm mb-4" style={{ color: '#A8A09A' }}>Coordonnées, mot de passe, suspension et suppression du compte.</p>
          <div className="space-y-3">
            {airbnbAccounts.map(a => (
              <AccountCard key={`${a.kind}-${a.id}`} account={a}
                onUpdate={updateAccount} onDelete={() => removeAccount(a)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Fiche d'un compte partenaire : coordonnées + actions d'administration. ────────
function AccountCard({ account, onUpdate, onDelete, hoursThisMonth }: {
  account: PartnerAccount;
  onUpdate: (a: PartnerAccount) => void;
  onDelete: () => void;
  hoursThisMonth?: (name: string) => number;
}) {
  const [mode, setMode] = useState<'view' | 'edit' | 'password'>('view');
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
          </div>
          {account.address && <p className="text-xs mt-0.5" style={{ color: '#7A7068' }}>{account.address}</p>}
          <p className="text-xs mt-0.5" style={{ color: '#A8A09A' }}>{account.email}{account.phone ? ` · ${account.phone}` : ''}</p>
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
          <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Téléphone" className="px-3 py-2 rounded-xl text-sm border" style={inputStyle} />
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
    </div>
  );
}
