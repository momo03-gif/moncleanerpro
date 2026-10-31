'use client';

// Ménage récurrent à jours fixes + la liste des plannings existants
// (modifier, suspendre, supprimer, générer les prochaines missions).

import { useState } from 'react';
import { createRecurringDB, updateRecurringDB, setRecurringActiveDB, deleteRecurringDB } from '@/lib/recurring';
import type { RecurringMission } from '@/lib/types';
import { useFeedback } from '@/contexts/FeedbackContext';
import { canCleanerDoService } from '@/lib/service';
import { formatDuration, formatHour, money } from '@/lib/format';
import { inputStyle } from '@/lib/ui';
import { resolveCoords, type ProprietesCreation } from './commun';

// Jours de semaine (ordre Lun→Dim ; valeur = getUTCDay, 0=dimanche).
const WEEKDAYS: { n: number; l: string }[] = [
  { n: 1, l: 'Lun' }, { n: 2, l: 'Mar' }, { n: 3, l: 'Mer' }, { n: 4, l: 'Jeu' },
  { n: 5, l: 'Ven' }, { n: 6, l: 'Sam' }, { n: 0, l: 'Dim' },
];
function weekdaysLabel(ws: number[]): string {
  return WEEKDAYS.filter(w => ws.includes(w.n)).map(w => w.l).join(', ');
}

type Props = Pick<ProprietesCreation, 'cleaners' | 'airbnbs' | 'recurrings' | 'userId' | 'onReload' | 'onGoToMissions'>;

export default function CreationRecurrente({ cleaners, airbnbs, recurrings, userId, onReload, onGoToMissions }: Props) {
  const { confirm, toast } = useFeedback();
  const [recForm, setRecForm] = useState({ siteId: '', property: '', address: '', time: '', durationMinutes: '60', price: '', cleanerId: '', startDate: '', endDate: '' });
  const [recWeekdays, setRecWeekdays] = useState<Set<number>>(new Set());
  const [recBusy, setRecBusy] = useState(false);
  const [recError, setRecError] = useState('');
  const [editingRecId, setEditingRecId] = useState<string | null>(null);

  // ── Ménage récurrent ──
  function selectRecSite(id: string) {
    const a = airbnbs.find(x => x.id === id);
    setRecForm(p => ({
      ...p, siteId: id,
      property: a?.name ?? p.property,
      address: a?.address ?? p.address,
      durationMinutes: a?.estimatedCleaningMinutes != null ? String(a.estimatedCleaningMinutes) : p.durationMinutes,
      price: a?.clientPrice != null ? String(a.clientPrice) : p.price,
    }));
  }
  function resetRecForm() {
    setRecForm({ siteId: '', property: '', address: '', time: '', durationMinutes: '60', price: '', cleanerId: '', startDate: '', endDate: '' });
    setRecWeekdays(new Set());
    setEditingRecId(null);
    setRecError('');
  }
  function startEditRec(rec: RecurringMission) {
    setEditingRecId(rec.id);
    setRecForm({
      siteId: rec.airbnbId ?? '',
      property: rec.propertyName ?? '',
      address: rec.address ?? '',
      time: rec.timeFrom ?? '',
      durationMinutes: String(rec.durationMinutes ?? 60),
      price: rec.price != null ? String(rec.price) : '',
      cleanerId: rec.cleanerId ?? '',
      startDate: rec.startDate ?? '',
      endDate: rec.endDate ?? '',
    });
    setRecWeekdays(new Set(rec.weekdays));
    setRecError('');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function handleCreateRecurring(e: React.FormEvent) {
    e.preventDefault();
    if (!recForm.property.trim() || recWeekdays.size === 0 || !recForm.startDate) {
      setRecError('Nom du site, au moins un jour, et date de début requis.'); return;
    }
    setRecBusy(true); setRecError('');
    const c = cleaners.find(x => x.id === recForm.cleanerId);
    const coords = await resolveCoords(airbnbs, recForm.siteId, recForm.address);
    const payload = {
      airbnbId: recForm.siteId || undefined,
      propertyName: recForm.property.trim(), address: recForm.address,
      cleanerId: recForm.cleanerId || undefined, cleanerName: c?.name,
      weekdays: Array.from(recWeekdays).sort((x, y) => x - y), timeFrom: recForm.time,
      durationMinutes: Number(recForm.durationMinutes) || 60, price: Number(recForm.price) || 0,
      startDate: recForm.startDate, endDate: recForm.endDate || undefined,
      addressLat: coords.lat, addressLng: coords.lng,
    };
    const res = editingRecId
      ? await updateRecurringDB(editingRecId, payload)
      : await createRecurringDB({ ...payload, createdBy: userId });
    setRecBusy(false);
    if (res.error) { setRecError(res.error); return; }
    const wasEditing = !!editingRecId;
    resetRecForm();
    toast(wasEditing ? 'Ménage récurrent mis à jour.' : 'Ménage récurrent programmé.', 'success');
    await onReload(); onGoToMissions();
  }
  async function regenRecurring() {
    setRecBusy(true);
    // La génération calcule des gains : elle tourne côté serveur.
    try {
      await fetch('/api/missions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate-recurring' }),
      });
    }
    catch (e) { console.error('regen recurring:', e); }
    setRecBusy(false);
    await onReload();
  }
  async function toggleRecActive(id: string, active: boolean) { await setRecurringActiveDB(id, active); await onReload(); }
  async function removeRec(id: string) {
    const ok = await confirm({ title: 'Supprimer ce ménage récurrent ?', message: 'Les missions déjà créées sont conservées.', confirmLabel: 'Supprimer', danger: true });
    if (!ok) return;
    await deleteRecurringDB(id); await onReload();
    toast('Ménage récurrent supprimé.', 'success');
  }

  return (
    /* ── MÉNAGE RÉCURRENT (jours fixes) ── */
    <div className="space-y-5">
      <form onSubmit={handleCreateRecurring} className="rounded-2xl border p-4 sm:p-6" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
        <h2 className="font-semibold mb-1" style={{ color: '#1A1A1A' }}>{editingRecId ? 'Modifier le ménage récurrent' : 'Ménage récurrent'}</h2>
        <p className="text-xs mb-6" style={{ color: '#A8A09A' }}>
          {editingRecId
            ? 'Les missions futures non démarrées seront réalignées sur la nouvelle programmation.'
            : 'Programmé à jours fixes (ex. salle de sport tous les lundis/mercredis/vendredis). Les missions sont créées automatiquement.'}
        </p>

        <div className="mb-4">
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Site (facultatif — pré-remplit)</label>
          <select value={recForm.siteId} onChange={e => selectRecSite(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm border appearance-none"
            style={{ ...inputStyle, color: recForm.siteId ? '#1A1A1A' : '#A8A09A' }}>
            <option value="">Saisie libre</option>
            {airbnbs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Nom / lieu</label>
            <input value={recForm.property} onChange={e => setRecForm(p => ({ ...p, property: e.target.value }))}
              placeholder="Ex : Salle de sport FitClub" className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Adresse</label>
            <input value={recForm.address} onChange={e => setRecForm(p => ({ ...p, address: e.target.value }))}
              placeholder="Adresse" className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle} />
          </div>
        </div>

        {/* Jours de la semaine — flex-wrap : s'adapte à toutes les largeurs. */}
        <div className="mb-4">
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Jours</label>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map(w => {
              const on = recWeekdays.has(w.n);
              return (
                <button type="button" key={w.n}
                  onClick={() => setRecWeekdays(prev => { const n = new Set(prev); if (n.has(w.n)) n.delete(w.n); else n.add(w.n); return n; })}
                  className="flex-1 min-w-[56px] py-2.5 rounded-xl text-sm font-semibold border-2 transition-all"
                  style={{ borderColor: on ? '#C9A84C' : '#E8E4DC', backgroundColor: on ? '#C9A84C12' : '#FFFFFF', color: on ? '#C9A84C' : '#7A7068' }}>
                  {w.l}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Heure</label>
            <input type="time" value={recForm.time} onChange={e => setRecForm(p => ({ ...p, time: e.target.value }))}
              className="w-full px-3 py-3 rounded-xl text-sm border" style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Durée (min)</label>
            <input type="number" min={0} value={recForm.durationMinutes} onChange={e => setRecForm(p => ({ ...p, durationMinutes: e.target.value }))}
              className="w-full px-3 py-3 rounded-xl text-sm border" style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Prix (€)</label>
            <input type="number" min={0} step="0.01" value={recForm.price} onChange={e => setRecForm(p => ({ ...p, price: e.target.value }))}
              placeholder="0" className="w-full px-3 py-3 rounded-xl text-sm border" style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Cleaner</label>
            <select value={recForm.cleanerId} onChange={e => setRecForm(p => ({ ...p, cleanerId: e.target.value }))}
              className="w-full px-3 py-3 rounded-xl text-sm border appearance-none"
              style={{ ...inputStyle, color: recForm.cleanerId ? '#1A1A1A' : '#A8A09A' }}>
              <option value="">Plus tard</option>
              {cleaners.filter(c => canCleanerDoService(c, 'cleaning')).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Début</label>
            <input type="date" value={recForm.startDate} onChange={e => setRecForm(p => ({ ...p, startDate: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Fin (facultatif)</label>
            <input type="date" value={recForm.endDate} min={recForm.startDate} onChange={e => setRecForm(p => ({ ...p, endDate: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle} />
          </div>
        </div>

        {recError && <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: '#B85A5012', color: '#B85A50' }}>{recError}</div>}
        <div className="flex flex-col sm:flex-row gap-2">
          <button type="submit" disabled={recBusy}
            className="w-full sm:w-auto px-8 py-3 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all"
            style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
            {recBusy ? 'Enregistrement...' : editingRecId ? 'Enregistrer les modifications' : 'Programmer le ménage récurrent'}
          </button>
          {editingRecId && (
            <button type="button" onClick={resetRecForm} disabled={recBusy}
              className="w-full sm:w-auto px-6 py-3 rounded-xl text-sm font-semibold border disabled:opacity-50"
              style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>
              Annuler
            </button>
          )}
        </div>
      </form>

      {/* Plannings existants — gestion (activer/suspendre/supprimer). */}
      {recurrings.length > 0 && (
        <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          <div className="px-4 sm:px-5 py-3.5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2" style={{ borderColor: '#F2EFE9' }}>
            <h3 className="font-semibold text-sm" style={{ color: '#1A1A1A' }}>Ménages récurrents ({recurrings.length})</h3>
            <button type="button" onClick={regenRecurring} disabled={recBusy}
              className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold border disabled:opacity-50"
              style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>
              {recBusy ? '...' : 'Générer les prochaines missions'}
            </button>
          </div>
          {recurrings.map((rec, i) => (
            <div key={rec.id} className={`px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 ${i < recurrings.length - 1 ? 'border-b' : ''}`} style={{ borderColor: '#F2EFE9' }}>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold truncate" style={{ color: '#1A1A1A' }}>{rec.propertyName || 'Site'}</p>
                  {!rec.active && <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ backgroundColor: '#F5F3EF', color: '#A8A09A' }}>Suspendu</span>}
                </div>
                <p className="text-xs mt-0.5" style={{ color: '#7A7068' }}>
                  {weekdaysLabel(rec.weekdays)}{rec.timeFrom ? ` · ${formatHour(rec.timeFrom)}` : ''}
                  {` · ${formatDuration(rec.durationMinutes)}`}{rec.price ? ` · ${money(rec.price)}` : ''}
                  {rec.cleanerName ? ` · ${rec.cleanerName}` : ' · non assigné'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <button type="button" onClick={() => startEditRec(rec)}
                  className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-semibold border"
                  style={{ borderColor: '#C9A84C', color: '#C9A84C' }}>
                  Modifier
                </button>
                <button type="button" onClick={() => toggleRecActive(rec.id, !rec.active)}
                  className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-semibold border"
                  style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>
                  {rec.active ? 'Suspendre' : 'Réactiver'}
                </button>
                <button type="button" onClick={() => removeRec(rec.id)}
                  className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-medium border"
                  style={{ borderColor: '#E8E4DC', color: '#B85A50' }}>
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
