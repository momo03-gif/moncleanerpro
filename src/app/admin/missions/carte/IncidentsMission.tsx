'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Mission } from '@/lib/types';
import { inputStyle } from '@/lib/ui';
import Icon from '@/components/Icon';
import { getMissionIncidentsDB, createIncidentDB, deleteIncidentDB, INCIDENT_LABEL, type RhIncidentType, type RhIncident } from '@/lib/rhApi';

// ── Incidents d'une mission (admin) ─────────────────────────────────────────────
// Signalement depuis la mission, avec distinction « lié au cleaner » (impacte ses
// stats RH) vs « externe » (cleaner_id NULL → aucun impact sur le cleaner).
const MISSION_INCIDENT_TYPES: RhIncidentType[] = [
  'retour_negatif', 'oubli', 'qualite_insuffisante', 'degradation_non_signalee', 'incident_externe', 'autre',
];

export default function MissionIncidentPanel({ mission }: { mission: Mission }) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<RhIncident[]>([]);
  const [type, setType] = useState<RhIncidentType>('retour_negatif');
  const [linked, setLinked] = useState(true);   // lié au travail du cleaner
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const hasCleaner = !!mission.cleanerId;
  // Un incident externe n'est jamais attribué ; sans cleaner assigné non plus.
  const effectiveLinked = linked && type !== 'incident_externe' && hasCleaner;

  const load = useCallback(async () => {
    setList(await getMissionIncidentsDB(mission.id));
  }, [mission.id]);

  useEffect(() => { if (open) load(); }, [open, load]);

  async function submit() {
    setBusy(true);
    await createIncidentDB({
      missionId: mission.id,
      cleanerId: effectiveLinked ? mission.cleanerId : null,
      type,
      note: note.trim() || undefined,
    });
    setNote(''); setType('retour_negatif'); setLinked(true);
    setBusy(false);
    await load();
  }

  async function remove(inc: RhIncident) {
    await deleteIncidentDB(inc.id, inc.cleanerId ?? null);
    await load();
  }

  return (
    <div className="px-5 pb-4">
      {!open ? (
        <button onClick={() => setOpen(true)}
          className="w-full py-2 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5"
          style={{ borderColor: '#B85A5040', backgroundColor: '#B85A5008', color: '#B85A50' }}>
          <Icon name="plus" size={14} /> Signaler un incident
        </button>
      ) : (
        <div className="rounded-xl p-3 space-y-3" style={{ backgroundColor: '#F8F6F2' }}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#7A7068' }}>Signaler un incident</p>
            <button onClick={() => setOpen(false)} style={{ color: '#A8A09A' }}><Icon name="close" size={14} /></button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {MISSION_INCIDENT_TYPES.map(t => (
              <button key={t} onClick={() => setType(t)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{ backgroundColor: type === t ? '#B85A50' : '#FFFFFF', color: type === t ? '#FFFFFF' : '#7A7068', border: '1px solid #E8E4DC' }}>
                {INCIDENT_LABEL[t]}
              </button>
            ))}
          </div>

          {/* Responsabilité : lié au cleaner (impacte ses stats) ou externe. */}
          <div>
            <button type="button"
              onClick={() => setLinked(v => !v)}
              disabled={type === 'incident_externe' || !hasCleaner}
              className="flex items-center gap-2 text-xs font-medium disabled:opacity-50"
              style={{ color: '#1A1A1A' }}>
              <span className="w-4 h-4 rounded flex items-center justify-center" style={{ backgroundColor: effectiveLinked ? '#C9A84C' : '#E8E4DC', color: '#1A1A1A' }}>
                {effectiveLinked && <Icon name="check" size={11} />}
              </span>
              Lié au travail du cleaner{mission.cleanerName ? ` (${mission.cleanerName})` : ''}
            </button>
            <p className="text-[11px] mt-1" style={{ color: '#A8A09A' }}>
              {effectiveLinked
                ? 'Comptera dans les statistiques RH du cleaner.'
                : type === 'incident_externe'
                  ? 'Incident externe : aucun impact sur le cleaner.'
                  : !hasCleaner ? 'Aucun cleaner assigné : incident externe.' : 'Incident non imputé au cleaner.'}
            </p>
          </div>

          <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (facultatif)"
            className="w-full px-3 py-2 rounded-lg text-sm border" style={inputStyle} />
          <button onClick={submit} disabled={busy}
            className="px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-50" style={{ backgroundColor: '#B85A50', color: '#FFFFFF' }}>
            {busy ? '...' : "Enregistrer l'incident"}
          </button>
        </div>
      )}

      {/* Liste des incidents de la mission. */}
      {list.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {list.map(inc => (
            <div key={inc.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ backgroundColor: '#FAFAF8' }}>
              <div className="min-w-0">
                <p className="text-xs font-medium" style={{ color: '#1A1A1A' }}>
                  {INCIDENT_LABEL[inc.type as RhIncidentType] ?? inc.type}
                  <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                    style={{ backgroundColor: inc.cleanerId ? '#B85A5015' : '#6B728018', color: inc.cleanerId ? '#B85A50' : '#6B7280' }}>
                    {inc.cleanerId ? 'Cleaner' : 'Externe'}
                  </span>
                </p>
                <p className="text-[11px] truncate" style={{ color: '#A8A09A' }}>{inc.date}{inc.note ? ` · ${inc.note}` : ''}</p>
              </div>
              <button onClick={() => remove(inc)} style={{ color: '#A8A09A' }} aria-label="Supprimer"><Icon name="close" size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
