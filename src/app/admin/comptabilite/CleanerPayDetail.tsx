'use client';

import { useState, useEffect, useCallback } from 'react';
import { loadCleanerDetailDB, type PayDetail } from '@/lib/payrollApi';
import Loading from '@/components/Loading';

// ── Fiche cleaner ouverte au clic depuis la paie (admin uniquement). ─────────────
// Récapitule les missions terminées sur une plage de dates : nombre, temps accordé
// vs temps réel travaillé, et gain. Information admin seule (le cleaner ne voit rien).

function money(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

// Minutes → « 12h30 » (ou « 0h »).
function hm(min: number) {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h}h` : `${h}h${String(r).padStart(2, '0')}`;
}

// Écart temps réel − accordé, signé (« +18min », « -25min », « à l'heure »).
function ecart(real: number, planned: number) {
  const d = Math.round(real - planned);
  if (d === 0) return { txt: 'à l’heure', color: '#A8A09A' };
  const s = d > 0 ? '+' : '−';
  return { txt: `${s}${hm(Math.abs(d))}`, color: d > 0 ? '#B85A50' : '#5A8A6A' };
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

// Défaut : du 1er du mois courant à aujourd'hui.
function defaultRange() {
  const now = new Date();
  const first = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const today = now.toISOString().slice(0, 10);
  return { from: first, to: today };
}

export default function CleanerPayDetail({ cleanerId, name, onClose }: {
  cleanerId: string; name: string; onClose: () => void;
}) {
  const def = defaultRange();
  const [from, setFrom] = useState(def.from);
  const [to, setTo] = useState(def.to);
  const [data, setData] = useState<PayDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const d = await loadCleanerDetailDB(cleanerId, from, to);
    setData(d);
    setLoading(false);
  }, [cleanerId, from, to]);

  useEffect(() => { load(); }, [load]);

  const t = data?.totals;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4"
      style={{ backgroundColor: 'rgba(26,26,26,0.45)' }} onClick={onClose}>
      <div className="w-full max-w-3xl my-8 rounded-2xl border shadow-xl"
        style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }} onClick={e => e.stopPropagation()}>

        {/* En-tête */}
        <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: '#F2EFE9' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold" style={{ backgroundColor: '#C9A84C18', color: '#C9A84C' }}>{name.charAt(0)}</div>
            <div>
              <p className="font-semibold text-lg" style={{ color: '#1A1A1A' }}>{name}</p>
              <p className="text-xs" style={{ color: '#A8A09A' }}>Récapitulatif des missions</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center text-lg" style={{ color: '#7A7068', backgroundColor: '#FAFAF8' }}>×</button>
        </div>

        {/* Sélecteur de dates */}
        <div className="px-6 py-4 border-b flex flex-wrap items-end gap-3" style={{ borderColor: '#F2EFE9', backgroundColor: '#FAFAF8' }}>
          <div>
            <label className="block text-xs mb-1" style={{ color: '#A8A09A' }}>Du</label>
            <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)}
              className="px-3 py-2 rounded-xl border text-sm" style={{ borderColor: '#E8E4DC', color: '#1A1A1A' }} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: '#A8A09A' }}>Au</label>
            <input type="date" value={to} min={from} onChange={e => setTo(e.target.value)}
              className="px-3 py-2 rounded-xl border text-sm" style={{ borderColor: '#E8E4DC', color: '#1A1A1A' }} />
          </div>
        </div>

        {loading || !t ? (
          <div className="py-16"><Loading className="text-sm" /></div>
        ) : (
          <>
            {/* Totaux */}
            <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Tile label="Missions" value={String(t.count)} color="#1A1A1A" />
              <Tile label="Temps accordé" value={hm(t.plannedMinutes)} color="#1A1A1A" />
              <Tile label="Temps réel" value={hm(t.realMinutes)} color={t.realMinutes > t.plannedMinutes ? '#B85A50' : '#5A8A6A'} />
              <Tile label="Gain total" value={money(t.gain)} color="#C9A84C" />
            </div>

            {/* Tableau des missions */}
            <div className="px-6 pb-6">
              {data!.missions.length === 0 ? (
                <div className="rounded-xl border py-10 text-center text-sm" style={{ borderColor: '#E8E4DC', color: '#A8A09A' }}>
                  Aucune mission terminée sur cette période.
                </div>
              ) : (
                <div className="rounded-xl border overflow-x-auto" style={{ borderColor: '#E8E4DC' }}>
                  <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#FAFAF8' }}>
                        <Th>Date</Th>
                        <Th>Logement</Th>
                        <Th right>Accordé</Th>
                        <Th right>Réel</Th>
                        <Th right>Écart</Th>
                        <Th right>Gain</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {data!.missions.map((m, i) => {
                        const isCleaning = m.plannedMinutes > 0 || m.service === 'cleaning' || m.service === 'both';
                        const e = ecart(m.realMinutes, m.plannedMinutes);
                        return (
                          <tr key={m.id} style={{ borderTop: i === 0 ? 'none' : '1px solid #F2EFE9' }}>
                            <td className="px-3 py-2.5 whitespace-nowrap" style={{ color: '#7A7068' }}>{fmtDate(m.date)}</td>
                            <td className="px-3 py-2.5" style={{ color: '#1A1A1A' }}>
                              {m.property}
                              {!isCleaning && <span className="ml-1 text-xs" style={{ color: '#A8A09A' }}>(livraison)</span>}
                              {isCleaning && !m.pointed && <span className="ml-1 text-xs" style={{ color: '#C48A2A' }}>· non pointée</span>}
                            </td>
                            <td className="px-3 py-2.5 text-right whitespace-nowrap" style={{ color: '#7A7068' }}>{isCleaning ? hm(m.plannedMinutes) : '—'}</td>
                            <td className="px-3 py-2.5 text-right whitespace-nowrap" style={{ color: '#1A1A1A' }}>{isCleaning ? hm(m.realMinutes) : '—'}</td>
                            <td className="px-3 py-2.5 text-right whitespace-nowrap font-medium" style={{ color: isCleaning ? e.color : '#A8A09A' }}>{isCleaning ? e.txt : '—'}</td>
                            <td className="px-3 py-2.5 text-right whitespace-nowrap font-semibold" style={{ color: '#1A1A1A' }}>{money(m.gain)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr style={{ backgroundColor: '#FAFAF8', borderTop: '2px solid #F2EFE9' }}>
                        <td className="px-3 py-3 font-semibold" style={{ color: '#1A1A1A' }} colSpan={2}>Total · {t.count} mission{t.count > 1 ? 's' : ''}</td>
                        <td className="px-3 py-3 text-right font-semibold whitespace-nowrap" style={{ color: '#1A1A1A' }}>{hm(t.plannedMinutes)}</td>
                        <td className="px-3 py-3 text-right font-semibold whitespace-nowrap" style={{ color: '#1A1A1A' }}>{hm(t.realMinutes)}</td>
                        <td className="px-3 py-3 text-right font-semibold whitespace-nowrap" style={{ color: ecart(t.realMinutes, t.plannedMinutes).color }}>{ecart(t.realMinutes, t.plannedMinutes).txt}</td>
                        <td className="px-3 py-3 text-right font-bold whitespace-nowrap" style={{ color: '#C9A84C' }}>{money(t.gain)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Tile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border px-3 py-2.5" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
      <p className="text-xs" style={{ color: '#A8A09A' }}>{label}</p>
      <p className="text-base font-bold" style={{ color }}>{value}</p>
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-3 py-2.5 text-xs font-semibold uppercase tracking-wider ${right ? 'text-right' : 'text-left'}`} style={{ color: '#7A7068' }}>{children}</th>
  );
}
