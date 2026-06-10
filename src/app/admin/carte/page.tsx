'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { getAirbnbs, getMissionsDB, setAirbnbCoordsDB, regenerateZonesDB } from '@/lib/db';
import { geocodeAddress } from '@/lib/zones';
import type { Apartment, Mission } from '@/lib/types';

// Leaflet a besoin de window → chargé uniquement côté client.
const ZonesMap = dynamic(() => import('@/components/ZonesMap'), {
  ssr: false,
  loading: () => <div className="rounded-2xl border flex items-center justify-center" style={{ height: '70vh', borderColor: '#E8E4DC', color: '#A8A09A' }}>Chargement de la carte…</div>,
});

export default function CartePage() {
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');

  const load = useCallback(async () => {
    const [a, m] = await Promise.all([getAirbnbs(), getMissionsDB()]);
    setApartments(a);
    setMissions(m);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Nombre de missions à venir par appartement (non terminées / non annulées).
  const missionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of missions) {
      if (!m.airbnbId) continue;
      if (m.status === 'completed' || m.status === 'cancelled') continue;
      counts[m.airbnbId] = (counts[m.airbnbId] ?? 0) + 1;
    }
    return counts;
  }, [missions]);

  // Légende : regroupe par zone (couleur + nom) avec compteur.
  const legend = useMemo(() => {
    const map = new Map<string, { color: string; name: string; count: number }>();
    for (const a of apartments) {
      if (!a.zoneId) continue;
      const e = map.get(a.zoneId) ?? { color: a.zoneColor ?? '#9CA3AF', name: a.zoneName ?? 'Zone', count: 0 };
      e.count++;
      map.set(a.zoneId, e);
    }
    return Array.from(map.values());
  }, [apartments]);

  const withCoords = apartments.filter(a => a.latitude != null && a.longitude != null).length;
  const missingCoords = apartments.length - withCoords;

  async function handleGenerate() {
    setBusy(true);
    // 1) Géocode les appartements sans coordonnées (Nominatim : 1 req/s).
    const toGeocode = apartments.filter(a => a.latitude == null || a.longitude == null);
    let done = 0;
    for (const a of toGeocode) {
      setProgress(`Géocodage ${++done}/${toGeocode.length} — ${a.name}`);
      const r = await geocodeAddress(a.address);
      if (r) await setAirbnbCoordsDB(a.id, r.lat, r.lon);
      await new Promise(res => setTimeout(res, 1100)); // respect de la politique Nominatim
    }
    // 2) (Re)calcule les zones par clustering 2 km.
    setProgress('Calcul des zones…');
    const res = await regenerateZonesDB();
    setProgress(`${res.zones} zone(s) sur ${res.assigned} appartement(s).`);
    await load();
    setBusy(false);
    setTimeout(() => setProgress(''), 4000);
  }

  if (loading) return <div className="p-4 md:p-6 text-sm" style={{ color: '#A8A09A' }}>Chargement...</div>;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Carte des zones</h1>
          <p className="text-sm mt-1" style={{ color: '#A8A09A' }}>
            {withCoords}/{apartments.length} appartement{apartments.length > 1 ? 's' : ''} géolocalisé{withCoords > 1 ? 's' : ''}
            {missingCoords > 0 && ` · ${missingCoords} à géocoder`}
          </p>
        </div>
        <button onClick={handleGenerate} disabled={busy}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all"
          style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
          {busy ? 'Traitement…' : 'Générer les zones'}
        </button>
      </div>

      {progress && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: '#C9A84C12', color: '#7A6030' }}>
          {progress}
        </div>
      )}

      {/* Légende */}
      {legend.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {legend.map(z => (
            <span key={z.name} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF', color: '#7A7068' }}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: z.color }} />
              {z.name}
              <span className="opacity-60">{z.count}</span>
            </span>
          ))}
        </div>
      )}

      {withCoords === 0 ? (
        <div className="rounded-2xl p-10 text-center border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
          <p className="text-sm" style={{ color: '#A8A09A' }}>Aucun appartement géolocalisé.</p>
          <p className="text-xs mt-1" style={{ color: '#A8A09A' }}>Cliquez sur « Générer les zones » pour géocoder les adresses et créer les zones.</p>
        </div>
      ) : (
        <ZonesMap apartments={apartments} missionCounts={missionCounts} />
      )}
    </div>
  );
}
