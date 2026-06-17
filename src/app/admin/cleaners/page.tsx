'use client';

import { useState, useEffect, useCallback } from 'react';
import { getCleaners, getMissionsDB, getPaymentsDB, createCleaner, setCleanerActive, updateCleanerHourlyRateDB, updateCleanerPasswordDB, updateCleanerInfoDB, deleteCleanerDB, createPaymentDB } from '@/lib/db';
import type { Mission, Payment, CleanerRow } from '@/lib/types';
import { inputStyle } from '@/lib/ui';
import { currentMonth } from '@/lib/mockData';
import { formatDuration } from '@/lib/format';

const emptyForm = { name: '', email: '', phone: '', password: '', hourlyRate: '' };
const TABS_MAIN = ['Profils', 'Paie'] as const;

export default function CleanersPage() {
  const [tab, setTab] = useState<typeof TABS_MAIN[number]>('Profils');
  const [cleaners, setCleaners] = useState<CleanerRow[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [managing, setManaging] = useState<string | null>(null);
  const [manageForm, setManageForm] = useState({ name: '', email: '', phone: '', hourlyRate: '', password: '' });
  const [saving, setSaving] = useState(false);

  const month = currentMonth();

  const load = useCallback(async () => {
    const [c, m, p] = await Promise.all([getCleaners(), getMissionsDB(), getPaymentsDB()]);
    setCleaners(c as CleanerRow[]);
    setMissions(m);
    setPayments(p);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleToggleActive(id: string, currentStatus: string) {
    await setCleanerActive(id, currentStatus !== 'active');
    await load();
  }

  function openManage(c: CleanerRow) {
    setManaging(c.id);
    setManageForm({
      name: c.name ?? '', email: c.email ?? '', phone: c.phone ?? '',
      hourlyRate: String(c.hourly_rate ?? ''),
      password: '',
    });
  }

  // Enregistre en une fois : infos + tarifs + mot de passe (si renseigné)
  async function handleSaveManage(id: string) {
    if (!manageForm.name.trim() || !manageForm.email.trim()) return;
    setSaving(true);
    await updateCleanerInfoDB(id, { name: manageForm.name.trim(), email: manageForm.email.trim(), phone: manageForm.phone.trim() || undefined });
    await updateCleanerHourlyRateDB(id, Number(manageForm.hourlyRate) || 0);
    if (manageForm.password.trim()) await updateCleanerPasswordDB(id, manageForm.password.trim());
    setManaging(null);
    await load();
    setSaving(false);
  }

  async function handleDeleteCleaner(id: string, name: string) {
    if (!confirm(`Supprimer définitivement le cleaner « ${name} » ? Ses missions passées sont conservées (sans cleaner assigné).`)) return;
    await deleteCleanerDB(id);
    await load();
  }

  async function handleAddCleaner(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await createCleaner({
      name: form.name, email: form.email,
      phone: form.phone || undefined,
      password: form.password || 'cleaner123',
      hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : undefined,
    });
    await load();
    setForm(emptyForm);
    setShowForm(false);
    setSaving(false);
  }

  async function handlePay(cleanerId: string, cleanerName: string, missionIds: string[], amount: number) {
    await createPaymentDB({ cleanerId, cleanerName, amount, missionIds, month });
    await load();
  }

  function getPayData(cleanerId: string) {
    const paidIds = payments.filter(p => p.cleanerId === cleanerId && p.month === month).flatMap(p => p.missionIds);
    const completedThisMonth = missions.filter(m => m.cleanerId === cleanerId && m.status === 'completed' && m.date.startsWith(month));
    const unpaid = completedThisMonth.filter(m => !paidIds.includes(m.id));
    const unpaidTotal = unpaid.reduce((s, m) => s + (m.cleanerGain ?? 0), 0);
    const paidTotal = payments.filter(p => p.cleanerId === cleanerId && p.month === month).reduce((s, p) => s + p.amount, 0);
    const historyPayments = payments.filter(p => p.cleanerId === cleanerId).sort((a, b) => b.date.localeCompare(a.date));
    return { completedThisMonth, unpaid, unpaidTotal, paidTotal, historyPayments };
  }

  if (loading) return <div className="p-4 md:p-6 text-sm" style={{ color: '#A8A09A' }}>Chargement...</div>;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Cleaners</h1>
          <p className="text-sm mt-1" style={{ color: '#A8A09A' }}>{cleaners.filter(c => c.status === 'active').length} actif{cleaners.filter(c => c.status === 'active').length > 1 ? 's' : ''} · {cleaners.length} total</p>
        </div>
        {tab === 'Profils' && (
          <button onClick={() => setShowForm(s => !s)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ backgroundColor: showForm ? '#F5F3EF' : '#C9A84C', color: showForm ? '#7A7068' : '#1A1A1A' }}>
            <span>{showForm ? '✕' : '+'}</span>
            {showForm ? 'Annuler' : 'Ajouter un cleaner'}
          </button>
        )}
      </div>

      <div className="flex gap-1 mb-6 p-1 rounded-2xl w-fit" style={{ backgroundColor: '#F5F3EF' }}>
        {TABS_MAIN.map(t => (
          <button key={t} onClick={() => setTab(t)} className="px-5 py-2 rounded-xl text-sm font-medium transition-all"
            style={{ backgroundColor: tab === t ? '#FFFFFF' : 'transparent', color: tab === t ? '#1A1A1A' : '#A8A09A', boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
            {t}
          </button>
        ))}
      </div>

      {/* ══ TAB : PROFILS ══ */}
      {tab === 'Profils' && (
        <>
          {showForm && (
            <form onSubmit={handleAddCleaner} className="rounded-2xl border p-6 mb-6" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
              <h2 className="font-semibold mb-5" style={{ color: '#1A1A1A' }}>Nouveau cleaner</h2>
              <div className="grid md:grid-cols-2 gap-4 mb-5">
                {[
                  { label: 'Nom complet', key: 'name', placeholder: 'Sophie Martin', required: true, type: 'text' },
                  { label: 'Email', key: 'email', placeholder: 'sophie@email.com', required: true, type: 'email' },
                  { label: 'Téléphone', key: 'phone', placeholder: '06 12 34 56 78', required: false, type: 'text' },
                  { label: 'Mot de passe', key: 'password', placeholder: 'Par défaut : cleaner123', required: false, type: 'password' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>{f.label}</label>
                    <input required={f.required} type={f.type} value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.placeholder} className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                      onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Taux horaire cleaner (€ / heure)</label>
                  <input type="number" min="0" step="0.5" value={form.hourlyRate} onChange={e => setForm(p => ({ ...p, hourlyRate: e.target.value }))}
                    placeholder="12" className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                    onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
                  <p className="text-xs mt-1.5" style={{ color: '#A8A09A' }}>Gain par mission = taux horaire × durée du ménage ÷ 60</p>
                </div>
              </div>
              <button type="submit" disabled={saving} className="px-6 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
                {saving ? 'Création...' : 'Ajouter le cleaner'}
              </button>
            </form>
          )}

          <div className="space-y-4">
            {cleaners.map(cleaner => {
              const isActive = cleaner.status === 'active';
              const cm = missions.filter(m => m.cleanerId === cleaner.id);
              const completed = cm.filter(m => m.status === 'completed').length;
              const upcoming = cm.filter(m => ['accepted', 'validated', 'in_progress'].includes(m.status)).length;
              const hoursMonth = cm.filter(m => m.status === 'completed' && m.date.startsWith(month)).reduce((s, m) => s + m.duration, 0);

              return (
                <div key={cleaner.id} className="rounded-2xl border overflow-hidden" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC', opacity: isActive ? 1 : 0.65 }}>
                  <div className="px-4 md:px-6 py-5 flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0" style={{ backgroundColor: isActive ? '#C9A84C18' : '#F5F3EF', color: isActive ? '#C9A84C' : '#A8A09A' }}>
                      {cleaner.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold" style={{ color: '#1A1A1A' }}>{cleaner.name}</h3>
                        {!isActive && <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#F5F3EF', color: '#B85A50' }}>Désactivé</span>}
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: '#A8A09A' }}>{cleaner.email}</p>
                      {cleaner.phone && <p className="text-xs" style={{ color: '#A8A09A' }}>{cleaner.phone}</p>}
                    </div>
                    <button onClick={() => (managing === cleaner.id ? setManaging(null) : openManage(cleaner))}
                      className="shrink-0 px-4 py-2 rounded-xl text-xs font-semibold border transition-all"
                      style={{ borderColor: managing === cleaner.id ? '#C9A84C' : '#E8E4DC', backgroundColor: managing === cleaner.id ? '#C9A84C12' : '#FAFAF8', color: managing === cleaner.id ? '#C9A84C' : '#7A7068' }}>
                      {managing === cleaner.id ? 'Fermer' : 'Gérer'}
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 px-4 md:px-6 pb-5">
                    {[{ v: completed, l: 'Terminées', c: '#1A1A1A' }, { v: upcoming, l: 'À venir', c: '#1A1A1A' }, { v: `${hoursMonth}h`, l: 'Ce mois', c: '#C9A84C' }].map(s => (
                      <div key={s.l} className="rounded-xl p-3 text-center" style={{ backgroundColor: '#F8F6F2' }}>
                        <p className="text-xl font-bold" style={{ color: s.c }}>{s.v}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#A8A09A' }}>{s.l}</p>
                      </div>
                    ))}
                  </div>

                  {managing !== cleaner.id ? (
                    <div className="px-4 md:px-6 pb-5 border-t pt-4" style={{ borderColor: '#F2EFE9' }}>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#7A7068' }}>Taux horaire</p>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold" style={{ color: cleaner.hourly_rate ? '#1A1A1A' : '#A8A09A' }}>{cleaner.hourly_rate ? `${cleaner.hourly_rate}€` : '—'}</span>
                        {cleaner.hourly_rate ? <span className="text-xs" style={{ color: '#A8A09A' }}>/ heure</span> : null}
                      </div>
                    </div>
                  ) : (
                    <div className="px-4 md:px-6 pb-5 border-t pt-4 space-y-4" style={{ borderColor: '#F2EFE9' }}>
                      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#7A7068' }}>Modifier le cleaner</p>
                      <div className="grid md:grid-cols-2 gap-3">
                        {[
                          { key: 'name', label: 'Nom complet', type: 'text' },
                          { key: 'email', label: 'Email', type: 'email' },
                          { key: 'phone', label: 'Téléphone', type: 'text' },
                          { key: 'password', label: 'Nouveau mot de passe', type: 'password' },
                        ].map(f => (
                          <div key={f.key}>
                            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#7A7068' }}>{f.label}</label>
                            <input type={f.type} value={(manageForm as any)[f.key]} onChange={e => setManageForm(p => ({ ...p, [f.key]: e.target.value }))}
                              placeholder={f.key === 'password' ? 'Laisser vide pour ne pas changer' : ''}
                              className="w-full px-4 py-2.5 rounded-xl text-sm border" style={inputStyle}
                              onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
                          </div>
                        ))}
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#7A7068' }}>Taux horaire cleaner (€ / heure)</label>
                          <input type="number" min="0" step="0.5" value={manageForm.hourlyRate} onChange={e => setManageForm(p => ({ ...p, hourlyRate: e.target.value }))}
                            className="w-full px-4 py-2.5 rounded-xl text-sm border" style={inputStyle}
                            onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleSaveManage(cleaner.id)} disabled={saving || !manageForm.name.trim() || !manageForm.email.trim()} className="px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
                          {saving ? 'Enregistrement...' : 'Enregistrer'}
                        </button>
                        <button onClick={() => setManaging(null)} className="px-5 py-2.5 rounded-xl text-sm font-medium border" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>Annuler</button>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-3 border-t" style={{ borderColor: '#F2EFE9' }}>
                        <button onClick={() => handleToggleActive(cleaner.id, cleaner.status)} className="px-4 py-2 rounded-xl text-xs font-semibold border"
                          style={{ borderColor: isActive ? '#E8E4DC' : '#C9A84C', backgroundColor: isActive ? '#FAFAF8' : '#C9A84C12', color: isActive ? '#B85A50' : '#C9A84C' }}>
                          {isActive ? 'Désactiver le compte' : 'Activer le compte'}
                        </button>
                        <button onClick={() => handleDeleteCleaner(cleaner.id, cleaner.name)} className="px-4 py-2 rounded-xl text-xs font-semibold border"
                          style={{ borderColor: '#B85A5040', backgroundColor: '#B85A5010', color: '#B85A50' }}>
                          Supprimer définitivement
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ══ TAB : PAIE ══ */}
      {tab === 'Paie' && (
        <div className="space-y-6">
          {cleaners.filter(c => c.status === 'active').map(cleaner => {
            const { completedThisMonth, unpaid, unpaidTotal, paidTotal, historyPayments } = getPayData(cleaner.id);
            return (
              <div key={cleaner.id} className="rounded-2xl border overflow-hidden" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
                <div className="px-4 md:px-6 py-4 border-b flex flex-wrap items-center justify-between gap-2" style={{ borderColor: '#F2EFE9' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold" style={{ backgroundColor: '#C9A84C18', color: '#C9A84C' }}>{cleaner.name.charAt(0)}</div>
                    <div>
                      <p className="font-semibold" style={{ color: '#1A1A1A' }}>{cleaner.name}</p>
                      <p className="text-xs" style={{ color: '#A8A09A' }}>{completedThisMonth.length} mission{completedThisMonth.length > 1 ? 's' : ''} ce mois</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs mb-1" style={{ color: '#A8A09A' }}>Déjà payé ce mois</p>
                    <p className="text-lg font-bold" style={{ color: '#5A8A6A' }}>{paidTotal}€</p>
                  </div>
                </div>

                <div className="px-4 md:px-6 py-4">
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#7A7068' }}>
                    À payer ce mois — <span style={{ color: unpaidTotal > 0 ? '#C48A2A' : '#5A8A6A' }}>{unpaidTotal}€</span>
                  </p>
                  {unpaid.length === 0 ? (
                    <p className="text-sm py-2" style={{ color: '#5A8A6A' }}>✓ Tout est payé ce mois</p>
                  ) : (
                    <>
                      <div className="space-y-2 mb-4">
                        {unpaid.map(m => (
                          <div key={m.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl" style={{ backgroundColor: '#F8F6F2' }}>
                            <div>
                              <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{m.property}</p>
                              <p className="text-xs" style={{ color: '#A8A09A' }}>{m.date} · {formatDuration(m.missionDurationMinutes)} · {m.type}</p>
                            </div>
                            <span className="text-sm font-semibold" style={{ color: '#C9A84C' }}>{m.cleanerGain ?? 0}€</span>
                          </div>
                        ))}
                      </div>
                      <button onClick={() => handlePay(cleaner.id, cleaner.name, unpaid.map(m => m.id), unpaidTotal)}
                        className="w-full py-3 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
                        Marquer comme payé — {unpaidTotal}€
                      </button>
                    </>
                  )}
                </div>

                {historyPayments.length > 0 && (
                  <div className="px-4 md:px-6 pb-5 border-t pt-4" style={{ borderColor: '#F2EFE9' }}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#7A7068' }}>Historique paiements</p>
                    <div className="space-y-2">
                      {historyPayments.map(p => (
                        <div key={p.id} className="flex items-center justify-between">
                          <div>
                            <p className="text-sm" style={{ color: '#1A1A1A' }}>{p.month}</p>
                            <p className="text-xs" style={{ color: '#A8A09A' }}>Payé le {p.date} · {p.missionIds.length} mission{p.missionIds.length > 1 ? 's' : ''}</p>
                          </div>
                          <span className="text-sm font-semibold" style={{ color: '#5A8A6A' }}>{p.amount}€</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
