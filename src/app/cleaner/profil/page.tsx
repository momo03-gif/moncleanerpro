'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getMissionsForCleanerDB, getCleanerByUserId, updateCleanerStatusDB, updateCleanerAvailableDaysDB, updateCleanerLicensePlateDB } from '@/lib/db';
import type { Mission } from '@/lib/types';
import { currentMonth } from '@/lib/mockData';
import { serviceParts } from '@/lib/service';
import Icon from '@/components/Icon';
import MotivationPanel from './MotivationPanel';
import Loading from "@/components/Loading";

const AVAIL_STATUSES = [
  { value: 'available', label: 'Disponible',  color: '#5A8A6A' },
  { value: 'busy',      label: 'En mission',  color: '#C48A2A' },
  { value: 'offline',   label: 'Hors ligne',  color: '#A8A09A' },
] as const;

const DAYS = [
  { key: 'monday',    label: 'Lun' },
  { key: 'tuesday',   label: 'Mar' },
  { key: 'wednesday', label: 'Mer' },
  { key: 'thursday',  label: 'Jeu' },
  { key: 'friday',    label: 'Ven' },
  { key: 'saturday',  label: 'Sam' },
  { key: 'sunday',    label: 'Dim' },
];

const DEFAULT_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

export default function CleanerProfil() {
  const { user } = useAuth();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [cleanerRow, setCleanerRow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [statusSaving, setStatusSaving] = useState(false);
  const [daysSaving, setDaysSaving] = useState(false);
  const [daysSaved, setDaysSaved] = useState(false);
  const [availDays, setAvailDays] = useState<string[]>(DEFAULT_DAYS);
  const [plate, setPlate] = useState('');
  const [plateSaving, setPlateSaving] = useState(false);
  const [plateSaved, setPlateSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([getMissionsForCleanerDB(user.id), getCleanerByUserId(user.id)]).then(([m, c]) => {
      setMissions(m);
      setCleanerRow(c);
      if (c?.available_days?.length) setAvailDays(c.available_days);
      if (c?.license_plate) setPlate(c.license_plate);
      setLoading(false);
    });
  }, [user]);

  async function savePlate() {
    setPlateSaving(true);
    const ok = await updateCleanerLicensePlateDB(user!.id, plate);
    setPlateSaving(false);
    if (ok) setPlateSaved(true);
  }

  if (!user) return null;
  if (loading) return <Loading className="p-5 pt-8 text-sm" />;

  const month = currentMonth();
  const completed = missions.filter(m => m.status === 'completed');
  const hotelHoursMonth = completed.filter(m => m.source === 'hotel' && m.date.startsWith(month)).reduce((s, m) => s + m.duration, 0);
  const completedMonth = completed.filter(m => m.date.startsWith(month)).length;
  // Nombre de livraisons effectuées ce mois (aucun montant affiché côté cleaner).
  const deliveriesMonth = completed.filter(m => m.date.startsWith(month) && serviceParts(m.service).delivery).length;
  const showDeliveries = (cleanerRow?.can_deliver ?? false) || deliveriesMonth > 0;

  async function handleStatusChange(value: string) {
    if (statusSaving) return;
    setStatusSaving(true);
    setCleanerRow((prev: any) => ({ ...prev, status: value })); // optimistic
    await updateCleanerStatusDB(user!.id, value as 'available' | 'busy' | 'offline');
    setStatusSaving(false);
  }

  function toggleDay(key: string) {
    setAvailDays(prev =>
      prev.includes(key) ? prev.filter(d => d !== key) : [...prev, key]
    );
    setDaysSaved(false);
  }

  async function saveDays() {
    setDaysSaving(true);
    const ok = await updateCleanerAvailableDaysDB(user!.id, availDays);
    setDaysSaving(false);
    if (ok) setDaysSaved(true);
  }

  return (
    <div className="p-5">
      <div className="mb-6 pt-2">
        <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Mon profil</h1>
      </div>

      {/* Avatar + info */}
      <div className="rounded-2xl p-6 border mb-4" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold"
            style={{ backgroundColor: '#C9A84C18', color: '#C9A84C' }}>
            {user.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ color: '#1A1A1A' }}>{user.name}</h2>
            <p className="text-sm" style={{ color: '#A8A09A' }}>{user.email}</p>
            {(user.phone || cleanerRow?.phone) && (
              <p className="text-sm" style={{ color: '#A8A09A' }}>{user.phone ?? cleanerRow?.phone}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Heures hôtel', value: `${hotelHoursMonth}h`, gold: true, sub: 'ce mois' },
            { label: 'Missions',     value: completedMonth,         gold: false, sub: 'ce mois' },
            ...(showDeliveries ? [{ label: 'Livraisons', value: deliveriesMonth, gold: false, sub: 'ce mois' }] : []),
          ].map(s => (
            <div key={s.label} className="rounded-xl p-4 text-center" style={{ backgroundColor: '#F8F6F2' }}>
              <p className="text-xl font-bold" style={{ color: s.gold ? '#C9A84C' : '#1A1A1A' }}>{s.value}</p>
              <p className="text-xs mt-0.5" style={{ color: '#1A1A1A' }}>{s.label}</p>
              <p className="text-xs" style={{ color: '#A8A09A' }}>{s.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Badges, niveau & classement (motivation) */}
      <MotivationPanel userId={user.id} userName={user.name} />

      {/* ── Disponibilité (boutons cliquables) */}
      <div className="rounded-2xl p-5 border mb-4" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold" style={{ color: '#1A1A1A' }}>Mon statut</h3>
          {statusSaving && <span className="text-xs" style={{ color: '#A8A09A' }}>Enregistrement...</span>}
        </div>
        <div className="flex gap-3">
          {AVAIL_STATUSES.map(({ value, label, color }) => {
            const active = cleanerRow?.status === value;
            return (
              <button
                key={value}
                onClick={() => handleStatusChange(value)}
                disabled={statusSaving}
                className="flex-1 rounded-xl p-3 text-center border-2 transition-all active:scale-95 disabled:opacity-70"
                style={{
                  borderColor: active ? color : '#E8E4DC',
                  backgroundColor: active ? `${color}12` : 'transparent',
                  cursor: 'pointer',
                }}
              >
                <span className="w-2.5 h-2.5 rounded-full mx-auto block mb-2"
                  style={{ backgroundColor: color }} />
                <p className="text-xs font-medium"
                  style={{ color: active ? color : '#A8A09A' }}>{label}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Planning disponibilités par jour */}
      <div className="rounded-2xl p-5 border mb-4" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
        <h3 className="font-semibold mb-1" style={{ color: '#1A1A1A' }}>Mes disponibilités</h3>
        <p className="text-xs mb-4" style={{ color: '#A8A09A' }}>
          Jours où vous êtes disponible pour des missions
        </p>
        <div className="flex gap-2 mb-4">
          {DAYS.map(({ key, label }) => {
            const active = availDays.includes(key);
            return (
              <button
                key={key}
                onClick={() => toggleDay(key)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold border-2 transition-all active:scale-95"
                style={{
                  borderColor: active ? '#C9A84C' : '#E8E4DC',
                  backgroundColor: active ? '#C9A84C' : '#FFFFFF',
                  color: active ? '#1A1A1A' : '#A8A09A',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
        <button
          onClick={saveDays}
          disabled={daysSaving}
          className="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all"
          style={{ backgroundColor: daysSaved ? '#5A8A6A' : '#C9A84C', color: daysSaved ? '#FFFFFF' : '#1A1A1A' }}
        >
          {daysSaving ? 'Enregistrement...' : daysSaved ? '✓ Enregistré' : 'Enregistrer mes disponibilités'}
        </button>
      </div>

      {/* ── Mon véhicule (livreur) — plaque pour le paiement du stationnement */}
      {(cleanerRow?.can_deliver ?? false) && (
        <div className="rounded-2xl p-5 border mb-4" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          <h3 className="font-semibold mb-1" style={{ color: '#1A1A1A' }}>Mon véhicule</h3>
          <p className="text-xs mb-4" style={{ color: '#A8A09A' }}>
            Plaque d'immatriculation — nécessaire pour payer le stationnement pendant une livraison.
          </p>
          <input
            value={plate}
            onChange={e => { setPlate(e.target.value.toUpperCase()); setPlateSaved(false); }}
            placeholder="AB-123-CD"
            className="w-full px-4 py-3 rounded-xl text-sm border mb-3 font-mono tracking-wide"
            style={{ borderColor: '#E8E4DC', backgroundColor: '#FAFAF8', color: '#1A1A1A', outline: 'none' }}
          />
          <button
            onClick={savePlate}
            disabled={plateSaving}
            className="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all"
            style={{ backgroundColor: plateSaved ? '#5A8A6A' : '#C9A84C', color: plateSaved ? '#FFFFFF' : '#1A1A1A' }}
          >
            {plateSaving ? 'Enregistrement...' : plateSaved ? '✓ Enregistré' : 'Enregistrer mon véhicule'}
          </button>
        </div>
      )}

      {/* ── Historique récent */}
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: '#F2EFE9' }}>
          <h3 className="font-semibold" style={{ color: '#1A1A1A' }}>Historique récent</h3>
        </div>
        {missions.length === 0 ? (
          <div className="px-5 py-6 text-center text-sm" style={{ color: '#A8A09A' }}>Aucune mission</div>
        ) : (
          missions.slice(0, 5).map((m, i) => (
            <div key={m.id}
              className={`px-5 py-4 flex items-center gap-3 ${i < Math.min(missions.length, 5) - 1 ? 'border-b' : ''}`}
              style={{ borderColor: '#F2EFE9' }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: m.status === 'completed' ? '#5A8A6A15' : '#C9A84C12', color: m.status === 'completed' ? '#5A8A6A' : '#C9A84C' }}>
                <Icon name={m.status === 'completed' ? 'check' : 'missions'} size={15} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: '#1A1A1A' }}>{m.property}</p>
                <p className="text-xs" style={{ color: '#A8A09A' }}>{m.date} · {m.time}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
