'use client';

// Rendez-vous interne (entretien client, réunion…) : planifié, non facturé.

import { useState } from 'react';
import { createAppointmentDB } from '@/lib/db';
import { useFeedback } from '@/contexts/FeedbackContext';
import { inputStyle } from '@/lib/ui';
import type { ProprietesCreation } from './commun';

type Props = Pick<ProprietesCreation, 'staff' | 'userId' | 'onReload' | 'onGoToMissions'>;

export default function CreationRendezVous({ staff, userId, onReload, onGoToMissions }: Props) {
  const { toast } = useFeedback();
  const [apptForm, setApptForm] = useState({ title: '', description: '', date: '', time: '', assigneeId: '' });
  const [apptBusy, setApptBusy] = useState(false);
  const [apptError, setApptError] = useState('');

  // ── Rendez-vous ──
  async function handleCreateAppointment(e: React.FormEvent) {
    e.preventDefault();
    if (!apptForm.title.trim() || !apptForm.date) { setApptError('Titre et date requis.'); return; }
    setApptBusy(true); setApptError('');
    const a = staff.find(s => s.id === apptForm.assigneeId);
    const res = await createAppointmentDB({
      title: apptForm.title.trim(), description: apptForm.description, date: apptForm.date, time: apptForm.time,
      assigneeId: apptForm.assigneeId || undefined, assigneeRole: a?.role, assigneeName: a?.name, createdBy: userId,
    });
    setApptBusy(false);
    if (res.error) { setApptError(res.error); return; }
    setApptForm({ title: '', description: '', date: '', time: '', assigneeId: '' });
    toast('Rendez-vous créé.', 'success');
    await onReload(); onGoToMissions();
  }

  return (
    /* ── RENDEZ-VOUS (assigné admin ou cleaner, interne) ── */
    <form onSubmit={handleCreateAppointment} className="rounded-2xl border p-6" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
      <h2 className="font-semibold mb-1" style={{ color: '#1A1A1A' }}>Nouveau rendez-vous</h2>
      <p className="text-xs mb-6" style={{ color: '#A8A09A' }}>Entretien client, réunion… Planifié, non facturé.</p>

      <div className="mb-4">
        <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Intitulé</label>
        <input value={apptForm.title} onChange={e => setApptForm(p => ({ ...p, title: e.target.value }))}
          placeholder="Ex : entretien client Dupont" className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle} />
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Date</label>
          <input type="date" value={apptForm.date} onChange={e => setApptForm(p => ({ ...p, date: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle} />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Heure</label>
          <input type="time" value={apptForm.time} onChange={e => setApptForm(p => ({ ...p, time: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle} />
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Assigné à</label>
        <select value={apptForm.assigneeId} onChange={e => setApptForm(p => ({ ...p, assigneeId: e.target.value }))}
          className="w-full px-4 py-3 rounded-xl text-sm border appearance-none"
          style={{ ...inputStyle, color: apptForm.assigneeId ? '#1A1A1A' : '#A8A09A' }}>
          <option value="">Assigner plus tard</option>
          {staff.map(s => <option key={`${s.role}-${s.id}`} value={s.id}>{s.name} · {s.role === 'admin' ? 'Admin' : 'Équipe'}</option>)}
        </select>
      </div>

      <div className="mb-6">
        <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Descriptif</label>
        <textarea value={apptForm.description} onChange={e => setApptForm(p => ({ ...p, description: e.target.value }))}
          rows={3} placeholder="Objet du rendez-vous, lieu, points à aborder…"
          className="w-full px-4 py-3 rounded-xl text-sm border resize-none" style={inputStyle} />
      </div>

      {apptError && <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: '#B85A5012', color: '#B85A50' }}>{apptError}</div>}
      <button type="submit" disabled={apptBusy}
        className="w-full sm:w-auto px-8 py-3 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all"
        style={{ backgroundColor: '#7C5CBF', color: '#FFFFFF' }}>
        {apptBusy ? 'Création...' : 'Créer le rendez-vous'}
      </button>
    </form>
  );
}
