'use client';

import { useState, useEffect, useCallback } from 'react';
import { getCleaners, getMissionsDB, getPaymentsDB, createCleaner, setCleanerActive, updateCleanerHourlyRateDB, updateCleanerPasswordDB, updateCleanerInfoDB, updateCleanerCapabilitiesDB, updateCleanerDeliveryRateDB, updateCleanerEmploymentTypeDB, deleteCleanerDB, createPaymentDB } from '@/lib/db';
import type { Mission, Payment, CleanerRow } from '@/lib/types';
import { capabilitiesLabel, serviceParts } from '@/lib/service';
import { getIncidentsForCleanerDB, createIncidentDB, deleteIncidentDB, INCIDENT_LABEL, type RhIncident, type RhIncidentType } from '@/lib/rhApi';
import { inputStyle } from '@/lib/ui';
import { currentMonth } from '@/lib/mockData';
import { formatDuration } from '@/lib/format';
import Icon from '@/components/Icon';
import Loading from "@/components/Loading";
import { useFeedback } from '@/contexts/FeedbackContext';

const emptyForm = { name: '', email: '', phone: '', password: '', hourlyRate: '', canClean: true, canDeliver: false, deliveryRate: '' };
const TABS_MAIN = ['Profils', 'Paie'] as const;

export default function CleanersPage() {
  const { confirm, toast } = useFeedback();
  const [tab, setTab] = useState<typeof TABS_MAIN[number]>('Profils');
  const [cleaners, setCleaners] = useState<CleanerRow[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [managing, setManaging] = useState<string | null>(null);
  const [manageForm, setManageForm] = useState({ name: '', email: '', phone: '', hourlyRate: '', password: '', canClean: true, canDeliver: false, deliveryRate: '', employmentType: 'auto' as 'auto' | 'cdi' });
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
      canClean: c.can_clean ?? true, canDeliver: c.can_deliver ?? false,
      deliveryRate: c.delivery_rate != null ? String(c.delivery_rate) : '',
      employmentType: (c.employment_type ?? 'auto') as 'auto' | 'cdi',
    });
  }

  // Enregistre en une fois : infos + tarifs + mot de passe (si renseigné)
  async function handleSaveManage(id: string) {
    if (!manageForm.name.trim() || !manageForm.email.trim()) return;
    setSaving(true);
    await updateCleanerInfoDB(id, { name: manageForm.name.trim(), email: manageForm.email.trim(), phone: manageForm.phone.trim() || undefined });
    await updateCleanerHourlyRateDB(id, Number(manageForm.hourlyRate) || 0);
    await updateCleanerCapabilitiesDB(id, { canClean: manageForm.canClean, canDeliver: manageForm.canDeliver });
    await updateCleanerDeliveryRateDB(id, manageForm.canDeliver ? (Number(manageForm.deliveryRate) || 0) : 0);
    await updateCleanerEmploymentTypeDB(id, manageForm.employmentType);
    if (manageForm.password.trim()) await updateCleanerPasswordDB(id, manageForm.password.trim());
    setManaging(null);
    await load();
    setSaving(false);
  }

  async function handleDeleteCleaner(id: string, name: string) {
    const ok = await confirm({
      title: `Supprimer « ${name} » ?`,
      message: 'Ses missions passées sont conservées (sans cleaner assigné). Cette action est définitive.',
      confirmLabel: 'Supprimer', danger: true,
    });
    if (!ok) return;
    await deleteCleanerDB(id);
    await load();
    toast('Cleaner supprimé.', 'success');
  }

  async function handleAddCleaner(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await createCleaner({
      name: form.name, email: form.email,
      phone: form.phone || undefined,
      password: form.password || 'cleaner123',
      hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : undefined,
      canClean: form.canClean, canDeliver: form.canDeliver,
      deliveryRate: form.canDeliver ? (Number(form.deliveryRate) || 0) : 0,
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

  if (loading) return <Loading className="p-4 md:p-6 text-sm" />;

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
                <CapabilityToggles canClean={form.canClean} canDeliver={form.canDeliver}
                  onChange={caps => setForm(p => ({ ...p, ...caps }))}
                  deliveryRate={form.deliveryRate} onRateChange={v => setForm(p => ({ ...p, deliveryRate: v }))} />
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
              const upcoming = cm.filter(m => ['accepted', 'in_progress'].includes(m.status)).length;
              // Heures du mois = uniquement le nettoyage (horaire). Les livraisons sont
              // payées au forfait et ne comptent pas dans les heures travaillées.
              const hoursMonth = cm.filter(m => m.status === 'completed' && m.date.startsWith(month) && serviceParts(m.service).cleaning).reduce((s, m) => s + m.duration, 0);

              return (
                <div key={cleaner.id} className="rounded-2xl border overflow-hidden" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC', opacity: isActive ? 1 : 0.65 }}>
                  <div className="px-4 md:px-6 py-5 flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0" style={{ backgroundColor: isActive ? '#C9A84C18' : '#F5F3EF', color: isActive ? '#C9A84C' : '#A8A09A' }}>
                      {cleaner.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold" style={{ color: '#1A1A1A' }}>{cleaner.name}</h3>
                        {cleaner.can_deliver && (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#C48A2A15', color: '#C48A2A' }}>
                            <Icon name="delivery" size={12} /> {capabilitiesLabel(cleaner)}
                          </span>
                        )}
                        {!isActive && <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#F5F3EF', color: '#B85A50' }}>Désactivé</span>}
                      </div>
                      {cleaner.email && (
                        <a href={`mailto:${cleaner.email}`} className="text-xs mt-0.5 block hover:underline" style={{ color: '#A8A09A' }}>{cleaner.email}</a>
                      )}
                      {cleaner.phone && (
                        <a href={`tel:${cleaner.phone.replace(/\s+/g, '')}`}
                          className="inline-flex items-center gap-1.5 text-xs mt-0.5 font-medium hover:underline" style={{ color: '#3E63DD' }}>
                          <Icon name="phone" size={11} />{cleaner.phone}
                        </a>
                      )}
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
                      <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#7A7068' }}>Tarifs</p>
                      <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold" style={{ color: cleaner.hourly_rate ? '#1A1A1A' : '#A8A09A' }}>{cleaner.hourly_rate ? `${cleaner.hourly_rate}€` : '—'}</span>
                          {cleaner.hourly_rate ? <span className="text-xs" style={{ color: '#A8A09A' }}>/ heure</span> : null}
                        </div>
                        {cleaner.can_deliver && (
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold" style={{ color: cleaner.delivery_rate ? '#C48A2A' : '#A8A09A' }}>{cleaner.delivery_rate ? `${cleaner.delivery_rate}€` : '—'}</span>
                            <span className="text-xs" style={{ color: '#A8A09A' }}>/ livraison</span>
                          </div>
                        )}
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
                        <CapabilityToggles canClean={manageForm.canClean} canDeliver={manageForm.canDeliver}
                          onChange={caps => setManageForm(p => ({ ...p, ...caps }))}
                          deliveryRate={manageForm.deliveryRate} onRateChange={v => setManageForm(p => ({ ...p, deliveryRate: v }))} />
                        {/* Type de contrat — impacte le coût réel (charges patronales sur un CDI). */}
                        <div>
                          <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#7A7068' }}>Type de contrat</label>
                          <div className="flex gap-2">
                            {(['auto', 'cdi'] as const).map(t => (
                              <button key={t} type="button" onClick={() => setManageForm(p => ({ ...p, employmentType: t }))}
                                className="flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all"
                                style={{ borderColor: manageForm.employmentType === t ? '#C9A84C' : '#E8E4DC', backgroundColor: manageForm.employmentType === t ? '#C9A84C12' : '#FFFFFF', color: manageForm.employmentType === t ? '#C9A84C' : '#7A7068' }}>
                                {t === 'auto' ? 'Auto-entrepreneur' : 'CDI (charges)'}
                              </button>
                            ))}
                          </div>
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

                      <IncidentPanel cleanerId={cleaner.id} />
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

// ── Capacités d'un cleaner : nettoyage / livraison ──────────────────────────────
// Détermine les missions qu'on peut lui attribuer. Défaut : nettoyage seul.
function CapabilityToggles({ canClean, canDeliver, onChange, deliveryRate, onRateChange }: {
  canClean: boolean; canDeliver: boolean;
  onChange: (caps: { canClean: boolean; canDeliver: boolean }) => void;
  deliveryRate: string;
  onRateChange: (v: string) => void;
}) {
  return (
    <div className="md:col-span-2">
      <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Prestations</label>
      <div className="flex gap-2 flex-wrap">
        <button type="button" onClick={() => onChange({ canClean: !canClean, canDeliver })}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all"
          style={{ borderColor: canClean ? '#C9A84C' : '#E8E4DC', backgroundColor: canClean ? '#C9A84C12' : '#FFFFFF', color: canClean ? '#C9A84C' : '#7A7068' }}>
          <span className="w-4 h-4 rounded flex items-center justify-center" style={{ color: '#1A1A1A', backgroundColor: canClean ? '#C9A84C' : '#E8E4DC' }}>
            {canClean && <Icon name="check" size={11} />}
          </span>
          Nettoyage
        </button>
        <button type="button" onClick={() => onChange({ canClean, canDeliver: !canDeliver })}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all"
          style={{ borderColor: canDeliver ? '#C9A84C' : '#E8E4DC', backgroundColor: canDeliver ? '#C9A84C12' : '#FFFFFF', color: canDeliver ? '#C9A84C' : '#7A7068' }}>
          <span className="w-4 h-4 rounded flex items-center justify-center" style={{ color: '#1A1A1A', backgroundColor: canDeliver ? '#C9A84C' : '#E8E4DC' }}>
            {canDeliver && <Icon name="check" size={11} />}
          </span>
          Livraison
        </button>
      </div>
      <p className="text-xs mt-1.5" style={{ color: '#A8A09A' }}>Ce que ce cleaner peut réaliser. Détermine les missions qu&apos;on peut lui attribuer.</p>

      {/* Montant par livraison — visible et modifiable par l'admin uniquement. */}
      {canDeliver && (
        <div className="mt-3">
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Montant par livraison (€)</label>
          <input type="number" min="0" step="0.5" value={deliveryRate} onChange={e => onRateChange(e.target.value)}
            placeholder="Ex : 4" className="w-full md:w-48 px-4 py-2.5 rounded-xl text-sm border" style={inputStyle}
            onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
          <p className="text-xs mt-1.5" style={{ color: '#A8A09A' }}>Gain fixe par mission de livraison, indépendant de la durée.</p>
        </div>
      )}
    </div>
  );
}

// ── Incidents RH (admin) : signaler + historique. Réservé à l'admin. ────────────
// Incidents directement imputés au cleaner (les incidents externes se signalent
// depuis une mission). « oubli_majeur » reste accepté pour l'historique.
const INCIDENT_TYPES: RhIncidentType[] = ['retour_negatif', 'oubli', 'qualite_insuffisante', 'degradation_non_signalee', 'autre'];

function IncidentPanel({ cleanerId }: { cleanerId: string }) {
  const [incidents, setIncidents] = useState<RhIncident[]>([]);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<RhIncidentType>('retour_negatif');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setIncidents(await getIncidentsForCleanerDB(cleanerId));
  }, [cleanerId]);
  useEffect(() => { load(); }, [load]);

  async function submit() {
    setBusy(true);
    await createIncidentDB({ cleanerId, type, note: note.trim() || undefined });
    setNote(''); setOpen(false); setBusy(false);
    await load();
  }
  async function remove(inc: RhIncident) {
    await deleteIncidentDB(inc.id, cleanerId);
    await load();
  }

  return (
    <div className="pt-3 border-t" style={{ borderColor: '#F2EFE9' }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#7A7068' }}>
          Incidents {incidents.length > 0 && <span style={{ color: '#B85A50' }}>· {incidents.length}</span>}
        </p>
        {!open && (
          <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border"
            style={{ borderColor: '#B85A5040', backgroundColor: '#B85A5010', color: '#B85A50' }}>
            <Icon name="plus" size={14} /> Signaler un incident
          </button>
        )}
      </div>

      {open && (
        <div className="rounded-xl p-3 mb-3 space-y-3" style={{ backgroundColor: '#F8F6F2' }}>
          <div className="flex flex-wrap gap-1.5">
            {INCIDENT_TYPES.map(t => (
              <button key={t} onClick={() => setType(t)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{ backgroundColor: type === t ? '#B85A50' : '#FFFFFF', color: type === t ? '#FFFFFF' : '#7A7068', border: '1px solid #E8E4DC' }}>
                {INCIDENT_LABEL[t]}
              </button>
            ))}
          </div>
          <input value={note} onChange={e => setNote(e.target.value)}
            placeholder="Note (facultatif)"
            className="w-full px-3 py-2 rounded-lg text-sm border" style={inputStyle} />
          <div className="flex gap-2">
            <button onClick={submit} disabled={busy}
              className="px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
              style={{ backgroundColor: '#B85A50', color: '#FFFFFF' }}>
              {busy ? '...' : 'Enregistrer l’incident'}
            </button>
            <button onClick={() => { setOpen(false); setNote(''); }}
              className="px-4 py-2 rounded-lg text-xs border" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {incidents.length > 0 && (
        <div className="space-y-1.5">
          {incidents.map(inc => (
            <div key={inc.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ backgroundColor: '#FAFAF8' }}>
              <div className="min-w-0">
                <p className="text-xs font-medium" style={{ color: '#1A1A1A' }}>{INCIDENT_LABEL[inc.type]}</p>
                <p className="text-xs truncate" style={{ color: '#A8A09A' }}>{inc.date}{inc.note ? ` · ${inc.note}` : ''}</p>
              </div>
              <button onClick={() => remove(inc)} style={{ color: '#A8A09A' }} aria-label="Supprimer l’incident">
                <Icon name="close" size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
