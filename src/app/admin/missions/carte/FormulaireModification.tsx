'use client';

// Formulaire de modification d'une mission (admin), ouvert depuis sa carte.
// Monté à l'ouverture : il part toujours des valeurs actuelles de la mission.

import { useState } from 'react';
import { updateMissionDB } from '@/lib/db';
import type { Mission, MissionService, MissionType } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { serviceParts, estAuTemps } from '@/lib/service';
import { computeMissionGain } from '@/lib/pay';
import { formatHour, DEPARTURE_TIMES, money } from '@/lib/format';
import ArriveeSuivante from '@/components/ArriveeSuivante';
import { inputStyle } from '@/lib/ui';
import { specialitesDuMetier } from '@/lib/prestataireRegles';

export default function FormulaireModification({ mission, cleaners, source, onError, onSaved, onCancel }: {
  mission: Mission;
  /** Pour l'aperçu du gain : le taux du cleaner assigné. */
  cleaners: { id: string; hourly_rate?: number; delivery_rate?: number }[];
  source: string;
  onError: (message: string) => void;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [editForm, setEditForm] = useState({
    date: mission.date, time: mission.time,
    durationMinutes: String(mission.missionDurationMinutes ?? 60),
    type: mission.type, price: String(mission.price ?? 0),
    service: mission.service ?? 'cleaning' as MissionService,
    deliveryInstructions: mission.deliveryInstructions ?? '',
    repairSpecialite: mission.repairSpecialite ?? '', repairDetails: mission.repairDetails ?? '',
    errandDetails: mission.errandDetails ?? '', errandBudget: mission.errandBudget != null ? String(mission.errandBudget) : '',
    errandBonus: mission.errandBonus != null ? String(mission.errandBonus) : '',
    nextArrival: mission.nextArrival ?? '', nextArrivalTime: mission.nextArrivalTime ?? '',
  });

  // Aperçu du gain recalculé en direct dans le formulaire d'édition.
  const editCleaner = cleaners.find(c => c.id === mission.cleanerId);
  const editGainPreview = computeMissionGain({
    service: editForm.service,
    hourlyRate: editCleaner?.hourly_rate ?? mission.cleanerHourlyRateSnapshot ?? 0,
    deliveryRate: editCleaner?.delivery_rate ?? 0,
    durationMinutes: Number(editForm.durationMinutes) || 0,
    bonus: editForm.service === 'errand' ? Number(editForm.errandBonus) || 0 : 0,
  });

  async function saveEdit() {
    if (!user) return;
    setBusy(true); onError('');
    const res = await updateMissionDB(mission.id, { id: user.id, role: 'admin' }, {
      dateFrom: editForm.date,
      timeFrom: editForm.time,
      // Livraison : forfait, on ne suit aucun temps → durée 0.
      missionDurationMinutes: editForm.service === 'delivery' ? 0 : (Number(editForm.durationMinutes) || 0),
      type: editForm.type,
      service: editForm.service,
      deliveryInstructions: serviceParts(editForm.service).delivery ? editForm.deliveryInstructions : '',
      ...(editForm.service === 'repair' ? {
        repairSpecialite: editForm.repairSpecialite,
        repairDetails: editForm.repairDetails.trim(),
      } : {}),
      ...(editForm.service === 'errand' ? {
        errandDetails: editForm.errandDetails.trim(),
        errandBudget: Number(editForm.errandBudget) > 0 ? Number(editForm.errandBudget) : null,
        errandBonus: Math.max(0, Number(editForm.errandBonus) || 0),
      } : {}),
      price: Number(editForm.price) || 0,  // prix CLIENT uniquement
      // Arrivée suivante : saisie à la main uniquement. Pour un ménage issu de
      // la synchro, elle est recalculée depuis les réservations — on n'y touche pas.
      ...(mission.autoSynced ? {} : {
        nextArrival: editForm.nextArrival || null,
        nextArrivalTime: editForm.nextArrival ? (editForm.nextArrivalTime || null) : null,
      }),
    });
    setBusy(false);
    if (res.error) { onError(res.error); return; }
    onSaved();
  }

  return (
    /* Formulaire de modification (admin) */
    <div className="space-y-3 rounded-xl p-3" style={{ backgroundColor: '#F8F6F2' }}>
      <div className="grid grid-cols-2 gap-2" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <div>
          <label className="block text-[11px] font-medium mb-1" style={{ color: '#A8A09A' }}>Date</label>
          <input type="date" value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg text-sm border" style={inputStyle} />
        </div>
        <div>
          <label className="block text-[11px] font-medium mb-1" style={{ color: '#A8A09A' }}>{source === 'airbnb' && editForm.service !== 'repair' && editForm.service !== 'errand' ? 'Heure départ clients' : 'Heure'}</label>
          {source === 'airbnb' && editForm.service !== 'repair' && editForm.service !== 'errand' ? (
            <select value={editForm.time} onChange={e => setEditForm(f => ({ ...f, time: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg text-sm border appearance-none" style={inputStyle}>
              <option value="">Choisir</option>
              {DEPARTURE_TIMES.map(t => <option key={t} value={t}>{formatHour(t)}</option>)}
            </select>
          ) : (
            <input type="time" value={editForm.time} onChange={e => setEditForm(f => ({ ...f, time: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg text-sm border" style={inputStyle} />
          )}
        </div>
        {serviceParts(editForm.service).cleaning && (
        <div className="col-span-2">
          <label className="block text-[11px] font-medium mb-1" style={{ color: '#A8A09A' }}>Prochaine arrivée d&apos;un voyageur</label>
          {mission.autoSynced ? (
            <p className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: '#FFFFFF', color: '#7A7068', border: '1px solid #E8E4DC' }}>
              Calculée à partir des réservations synchronisées, mise à jour chaque heure.
            </p>
          ) : (
            <ArriveeSuivante dateMenage={editForm.date}
              value={{ date: editForm.nextArrival, time: editForm.nextArrivalTime }}
              onChange={v => setEditForm(f => ({ ...f, nextArrival: v.date, nextArrivalTime: v.time }))}
              champClass="w-full px-3 py-2 rounded-lg text-sm border appearance-none" champStyle={inputStyle} />
          )}
        </div>
        )}
        {/* Livraison : forfait fixe, la durée n'est pas prise en compte → champ masqué. */}
        {estAuTemps(editForm.service) && (
        <div>
          <label className="block text-[11px] font-medium mb-1" style={{ color: '#A8A09A' }}>{editForm.service === 'repair' || editForm.service === 'errand' ? 'Durée estimée (min)' : 'Temps de nettoyage (min)'}</label>
          <input type="number" min="5" step="5" value={editForm.durationMinutes} onChange={e => setEditForm(f => ({ ...f, durationMinutes: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg text-sm border" style={inputStyle} />
        </div>
        )}
        {editForm.service !== 'repair' && editForm.service !== 'errand' && (
        <div>
          <label className="block text-[11px] font-medium mb-1" style={{ color: '#A8A09A' }}>Type</label>
          <select value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value as MissionType }))}
            className="w-full px-3 py-2 rounded-lg text-sm border appearance-none" style={inputStyle}>
            <option value="regular">Ménage</option>
            <option value="checkout">Check-out</option>
            <option value="checkin">Check-in</option>
            <option value="deep_clean">Grand ménage</option>
          </select>
        </div>
        )}
        <div>
          <label className="block text-[11px] font-medium mb-1" style={{ color: '#A8A09A' }}>Prestation</label>
          <select value={editForm.service} onChange={e => setEditForm(f => ({ ...f, service: e.target.value as MissionService }))}
            className="w-full px-3 py-2 rounded-lg text-sm border appearance-none" style={inputStyle}>
            <option value="cleaning">Nettoyage</option>
            <option value="delivery">Livraison</option>
            <option value="repair">Intervention</option>
            <option value="errand">Course / achat</option>
          </select>
        </div>
        {/* Livraison : jamais facturée au client → pas de prix client. */}
        {editForm.service !== 'delivery' && (
        <div>
          <label className="block text-[11px] font-medium mb-1" style={{ color: '#A8A09A' }}>{editForm.service === 'errand' ? 'Frais de service (€)' : 'Prix client (€)'}</label>
          <input type="number" min="0" value={editForm.price} onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg text-sm border" style={inputStyle} />
        </div>
        )}
        <div>
          <label className="block text-[11px] font-medium mb-1" style={{ color: '#A8A09A' }}>Gain cleaner (auto)</label>
          <div className="w-full px-3 py-2 rounded-lg text-sm border font-semibold" style={{ ...inputStyle, color: '#C9A84C' }}>
            {money(editGainPreview)}
          </div>
        </div>
      </div>
      {editForm.service === 'errand' && (
        <div className="space-y-2">
          <div>
            <label className="block text-[11px] font-medium mb-1" style={{ color: '#A8A09A' }}>Course à faire</label>
            <textarea value={editForm.errandDetails} onChange={e => setEditForm(f => ({ ...f, errandDetails: e.target.value }))}
              rows={3} className="w-full px-3 py-2 rounded-lg text-sm border resize-none" style={inputStyle} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-medium mb-1" style={{ color: '#A8A09A' }}>Budget max accepté (€)</label>
              <input type="number" min="0" value={editForm.errandBudget} onChange={e => setEditForm(f => ({ ...f, errandBudget: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm border" style={inputStyle} />
            </div>
            <div>
              <label className="block text-[11px] font-medium mb-1" style={{ color: '#A8A09A' }}>Prime intervenant (€)</label>
              <input type="number" min="0" value={editForm.errandBonus} onChange={e => setEditForm(f => ({ ...f, errandBonus: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm border" style={inputStyle} />
            </div>
          </div>
        </div>
      )}
      {editForm.service === 'repair' && (
        <div className="space-y-2">
          <div>
            <label className="block text-[11px] font-medium mb-1" style={{ color: '#A8A09A' }}>Type d&apos;intervention</label>
            <select value={editForm.repairSpecialite} onChange={e => setEditForm(f => ({ ...f, repairSpecialite: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg text-sm border appearance-none" style={inputStyle}>
              <option value="">Non précisé</option>
              {specialitesDuMetier('artisan').map(sp => <option key={sp.key} value={sp.key}>{sp.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium mb-1" style={{ color: '#A8A09A' }}>Travail à faire</label>
            <textarea value={editForm.repairDetails} onChange={e => setEditForm(f => ({ ...f, repairDetails: e.target.value }))}
              rows={3} className="w-full px-3 py-2 rounded-lg text-sm border resize-none" style={inputStyle} />
          </div>
        </div>
      )}
      {serviceParts(editForm.service).delivery && (
        <div>
          <label className="block text-[11px] font-medium mb-1" style={{ color: '#A8A09A' }}>Consignes de livraison</label>
          <textarea value={editForm.deliveryInstructions} onChange={e => setEditForm(f => ({ ...f, deliveryInstructions: e.target.value }))}
            rows={2} className="w-full px-3 py-2 rounded-lg text-sm border resize-none" style={inputStyle} />
        </div>
      )}
      <p className="text-[11px]" style={{ color: '#A8A09A' }}>
        {editForm.service === 'delivery'
          ? <>Gain = forfait livraison {money(editCleaner?.delivery_rate ?? 0)} par livraison (montant fixe, sans durée). Livraison non facturée au client.</>
          : <>Gain = taux cleaner {money(editCleaner?.hourly_rate ?? mission.cleanerHourlyRateSnapshot ?? 0)}/h × {editForm.durationMinutes || 0} min ÷ 60. Le prix client est indépendant.</>}
      </p>
      <div className="flex gap-2">
        <button onClick={saveEdit} disabled={busy}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
          {busy ? '...' : 'Enregistrer'}
        </button>
        <button onClick={onCancel} disabled={busy}
          className="px-4 py-2.5 rounded-xl text-sm border" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>Annuler</button>
      </div>
    </div>
  );
}
