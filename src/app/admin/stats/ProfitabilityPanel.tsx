'use client';

import { useState, useEffect, useCallback } from 'react';
import { getMissionsDB, getCleaners, getAirbnbs } from '@/lib/db';
import { listParkingPaymentsClient } from '@/lib/parkingApi';
import { getProfitConfigDB, saveProfitConfigDB, computeApartmentProfitability, type ApartmentProfit } from '@/lib/profitability';
import { geocodeAddress } from '@/lib/zones';
import type { Mission, Apartment, ProfitConfig } from '@/lib/types';
import { formatDuration } from '@/lib/format';
import { currentMonth } from '@/lib/mockData';
import Loading from '@/components/Loading';

const eur = (n: number) => `${(Math.round(n * 100) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`;
const pct = (n: number) => `${Math.round(n * 100)} %`;

export default function ProfitabilityPanel() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [cleaners, setCleaners] = useState<any[]>([]);
  const [parkingByMission, setParkingByMission] = useState<Map<string, number>>(new Map());
  const [config, setConfig] = useState<ProfitConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'month' | 'all'>('month');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Paramètres (formulaire)
  const [form, setForm] = useState<ProfitConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  const load = useCallback(async () => {
    const [m, a, c, cfg, parking] = await Promise.all([
      getMissionsDB(), getAirbnbs(), getCleaners(), getProfitConfigDB(), listParkingPaymentsClient(),
    ]);
    setMissions(m); setApartments(a); setCleaners(c); setConfig(cfg); setForm(cfg);
    const map = new Map<string, number>();
    (Array.isArray(parking) ? parking : []).forEach(p => {
      if (p.missionId && p.amount != null) map.set(p.missionId, (map.get(p.missionId) ?? 0) + p.amount);
    });
    setParkingByMission(map);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading || !config || !form) return <Loading className="text-sm" />;

  const month = currentMonth();
  const completed = missions.filter(m => m.status === 'completed' && (period === 'all' || m.date.startsWith(month)));
  const rows = computeApartmentProfitability({ missions: completed, apartments, parkingByMission, config, cleaners });

  const notProfitable = rows.filter(r => !r.profitable).length;
  const totalMargin = Math.round(rows.reduce((s, r) => s + r.margin, 0) * 100) / 100;
  const avgMarginPct = rows.length > 0 ? rows.reduce((s, r) => s + r.marginPct, 0) / rows.length : 0;

  async function saveSettings() {
    if (!form) return;
    setSaving(true); setSavedMsg('');
    // Géocode l'adresse de base si saisie/modifiée.
    let cfg = { ...form };
    if (form.fuelBaseAddress && form.fuelBaseAddress !== config!.fuelBaseAddress) {
      const g = await geocodeAddress(form.fuelBaseAddress);
      cfg = { ...cfg, fuelBaseLat: g?.lat, fuelBaseLng: g?.lon };
    }
    const res = await saveProfitConfigDB(cfg);
    setSaving(false);
    if (res.error) { setSavedMsg('Erreur : ' + res.error); return; }
    setSavedMsg('Enregistré');
    await load();
  }

  const labelStyle = { color: '#7A7068' };
  const inputStyle = { borderColor: '#E8E4DC', backgroundColor: '#FAFAF8', color: '#1A1A1A', outline: 'none' } as const;

  return (
    <div>
      {/* En-tête : période + paramètres */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex gap-1 p-1 rounded-2xl" style={{ backgroundColor: '#F5F3EF' }}>
          {([['month', 'Ce mois'], ['all', 'Tout']] as const).map(([v, l]) => (
            <button key={v} onClick={() => setPeriod(v)} className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{ backgroundColor: period === v ? '#FFFFFF' : 'transparent', color: period === v ? '#1A1A1A' : '#A8A09A', boxShadow: period === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
              {l}
            </button>
          ))}
        </div>
        <button onClick={() => setSettingsOpen(o => !o)} className="px-4 py-2 rounded-xl text-sm font-medium border"
          style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>
          {settingsOpen ? 'Fermer les paramètres' : 'Paramètres de rentabilité'}
        </button>
      </div>

      {/* Panneau paramètres */}
      {settingsOpen && (
        <div className="rounded-2xl p-4 sm:p-5 border mb-6" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          <h3 className="font-semibold mb-1" style={{ color: '#1A1A1A' }}>Paramètres de rentabilité</h3>
          <p className="text-xs mb-4" style={{ color: '#A8A09A' }}>Ils définissent ce qui est « rentable » et le prix conseillé. Modifiables à tout moment.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={labelStyle}>Produits / ménage (centimes)</label>
              <input type="number" min={0} value={form.productCostCents}
                onChange={e => setForm(f => ({ ...f!, productCostCents: Number(e.target.value) || 0 }))}
                className="w-full px-3 py-2.5 rounded-xl text-sm border" style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={labelStyle}>Marge cible (%)</label>
              <input type="number" min={0} max={95} value={Math.round(form.marginTarget * 100)}
                onChange={e => setForm(f => ({ ...f!, marginTarget: (Number(e.target.value) || 0) / 100 }))}
                className="w-full px-3 py-2.5 rounded-xl text-sm border" style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={labelStyle}>Charges CDI (%)</label>
              <input type="number" min={0} max={100} value={Math.round(form.cdiChargeRate * 100)}
                onChange={e => setForm(f => ({ ...f!, cdiChargeRate: (Number(e.target.value) || 0) / 100 }))}
                className="w-full px-3 py-2.5 rounded-xl text-sm border" style={inputStyle} />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={labelStyle}>Adresse de base / dépôt (pour estimer l'essence)</label>
              <input value={form.fuelBaseAddress ?? ''} placeholder="Ex : 12 rue de la Paix, Lyon"
                onChange={e => setForm(f => ({ ...f!, fuelBaseAddress: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl text-sm border" style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={labelStyle}>Consommation (L/100 km)</label>
              <input type="number" min={0} step="0.1" value={form.fuelConsumption}
                onChange={e => setForm(f => ({ ...f!, fuelConsumption: Number(e.target.value) || 0 }))}
                className="w-full px-3 py-2.5 rounded-xl text-sm border" style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={labelStyle}>Prix carburant (€/L)</label>
              <input type="number" min={0} step="0.01" value={form.fuelPrice}
                onChange={e => setForm(f => ({ ...f!, fuelPrice: Number(e.target.value) || 0 }))}
                className="w-full px-3 py-2.5 rounded-xl text-sm border" style={inputStyle} />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <button onClick={saveSettings} disabled={saving}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
              style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
              {saving ? 'Enregistrement...' : 'Enregistrer les paramètres'}
            </button>
            {savedMsg && <span className="text-xs" style={{ color: savedMsg.startsWith('Erreur') ? '#B85A50' : '#5A8A6A' }}>{savedMsg}</span>}
          </div>
        </div>
      )}

      {/* Récap */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-2xl p-4 border" style={{ backgroundColor: notProfitable > 0 ? '#FFFFFF' : '#FFFFFF', borderColor: notProfitable > 0 ? '#EAC4BE' : '#E8E4DC' }}>
          <p className="text-2xl font-bold" style={{ color: notProfitable > 0 ? '#B85A50' : '#5A8A6A' }}>{notProfitable}</p>
          <p className="text-xs mt-1" style={{ color: '#A8A09A' }}>Non rentable{notProfitable > 1 ? 's' : ''}</p>
        </div>
        <div className="rounded-2xl p-4 border" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          <p className="text-2xl font-bold" style={{ color: avgMarginPct >= config.marginTarget ? '#5A8A6A' : '#B85A50' }}>{pct(avgMarginPct)}</p>
          <p className="text-xs mt-1" style={{ color: '#A8A09A' }}>Marge moyenne</p>
        </div>
        <div className="rounded-2xl p-4 border" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          <p className="text-2xl font-bold" style={{ color: totalMargin >= 0 ? '#1A1A1A' : '#B85A50' }}>{eur(totalMargin)}</p>
          <p className="text-xs mt-1" style={{ color: '#A8A09A' }}>Marge totale</p>
        </div>
      </div>

      <h2 className="font-semibold mb-1" style={{ color: '#1A1A1A' }}>Rentabilité par appartement</h2>
      <p className="text-xs mb-4" style={{ color: '#A8A09A' }}>Du moins au plus rentable. Objectif : marge ≥ {pct(config.marginTarget)}.</p>

      {rows.length === 0 ? (
        <div className="rounded-2xl p-8 text-center border text-sm" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF', color: '#A8A09A' }}>
          Aucun ménage terminé sur cette période.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(r => {
            const open = expanded === (r.apartmentId ?? r.name);
            const overrun = r.realMinutes > 0 && r.plannedMinutes > 0 && r.realMinutes > r.plannedMinutes * 1.1;
            return (
              <div key={r.apartmentId ?? r.name} className="rounded-2xl border overflow-hidden" style={{ backgroundColor: '#FFFFFF', borderColor: r.profitable ? '#E8E4DC' : '#EAC4BE' }}>
                <button onClick={() => setExpanded(open ? null : (r.apartmentId ?? r.name))}
                  className="w-full px-4 sm:px-5 py-4 flex items-center gap-3 text-left">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold truncate" style={{ color: '#1A1A1A' }}>{r.name}</p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                        style={{ backgroundColor: r.profitable ? '#5A8A6A15' : '#B85A5015', color: r.profitable ? '#5A8A6A' : '#B85A50' }}>
                        {r.profitable ? 'Rentable' : 'Pas rentable'}
                      </span>
                      {overrun && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#C48A2A15', color: '#C48A2A' }}>
                          Temps dépassé
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: '#A8A09A' }}>
                      {r.jobs} ménage{r.jobs > 1 ? 's' : ''} · CA {eur(r.revenue)} · coût {eur(r.totalCost)}
                      {!r.profitable && r.revenue > 0 ? ` · prix conseillé ${eur(r.recommendedPrice)}/ménage` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold" style={{ color: r.marginPct >= config.marginTarget ? '#5A8A6A' : '#B85A50' }}>{pct(r.marginPct)}</p>
                    <p className="text-xs" style={{ color: r.margin >= 0 ? '#7A7068' : '#B85A50' }}>{eur(r.margin)}</p>
                  </div>
                </button>
                {open && (
                  <div className="px-4 sm:px-5 pb-4 pt-1 text-xs space-y-1" style={{ color: '#7A7068' }}>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                      <Row label="Prix client (CA)" value={eur(r.revenue)} strong color="#5A8A6A" />
                      <Row label="Paie cleaner" value={`− ${eur(r.cleanerCost)}`} />
                      <Row label="Coût livraison" value={`− ${eur(r.deliveryCost)}`} />
                      <Row label="Produits" value={`− ${eur(r.productCost)}`} />
                      <Row label="Parking" value={`− ${eur(r.parkingCost)}`} />
                      <Row label="Essence (estimée)" value={`− ${eur(r.fuelCost)}`} />
                      <Row label="Marge" value={eur(r.margin)} strong color={r.margin >= 0 ? '#5A8A6A' : '#B85A50'} />
                    </div>
                    {r.realMinutes > 0 && (
                      <p className="pt-1" style={{ color: overrun ? '#C48A2A' : '#A8A09A' }}>
                        Temps : réel {formatDuration(Math.round(r.realMinutes / Math.max(r.jobs, 1)))} vs facturé {formatDuration(Math.round(r.plannedMinutes / Math.max(r.jobs, 1)))} par ménage
                        {overrun ? ' → le prix sous-estime le temps réel.' : ''}
                      </p>
                    )}
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

function Row({ label, value, strong, color }: { label: string; value: string; strong?: boolean; color?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ color: '#A8A09A' }}>{label}</span>
      <span style={{ color: color ?? '#1A1A1A', fontWeight: strong ? 700 : 500 }}>{value}</span>
    </div>
  );
}
