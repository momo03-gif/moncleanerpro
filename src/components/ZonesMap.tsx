'use client';

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import type { Apartment } from '@/lib/types';

interface Props {
  apartments: Apartment[];
  missionCounts?: Record<string, number>;
}

function escapeHtml(s: string) {
  return (s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

// Carte des appartements avec un point coloré par zone (Leaflet + tuiles OSM).
// Composant isolé : pour changer de fournisseur de carte plus tard, seul ce
// fichier est à remplacer.
export default function ZonesMap({ apartments, missionCounts = {} }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const Lmod: any = await import('leaflet');
      const L = Lmod.default ?? Lmod;
      if (cancelled || !ref.current) return;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }

      const pts = apartments.filter(a => a.latitude != null && a.longitude != null);
      const center: [number, number] = pts.length
        ? [pts[0].latitude as number, pts[0].longitude as number]
        : [45.764, 4.8357]; // Lyon par défaut

      const map = L.map(ref.current).setView(center, 12);
      mapRef.current = map;
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap', maxZoom: 19,
      }).addTo(map);

      const bounds: [number, number][] = [];
      for (const a of pts) {
        const color = a.zoneColor ?? '#9CA3AF';
        const count = missionCounts[a.id] ?? 0;
        const marker = L.circleMarker([a.latitude as number, a.longitude as number], {
          radius: 9, color: '#6B7280', weight: 2, fillColor: color, fillOpacity: 1,
        }).addTo(map);
        marker.bindPopup(`
          <div style="min-width:170px;font-family:inherit">
            <strong style="font-size:13px">${escapeHtml(a.name)}</strong><br/>
            <span style="color:#7A7068;font-size:12px">${escapeHtml(a.address)}</span><br/>
            <span style="display:inline-flex;align-items:center;gap:6px;margin-top:6px;font-size:12px">
              <span style="width:10px;height:10px;border-radius:50%;background:${color};display:inline-block"></span>
              ${escapeHtml(a.zoneName ?? 'Sans zone')}
            </span><br/>
            <span style="font-size:12px;color:#7A7068">${count} mission${count > 1 ? 's' : ''} prévue${count > 1 ? 's' : ''}</span><br/>
            <a href="/admin/airbnb" style="color:#C9A84C;font-size:12px;font-weight:600;text-decoration:none">Voir détails →</a>
          </div>
        `);
        bounds.push([a.latitude as number, a.longitude as number]);
      }
      if (bounds.length > 1) map.fitBounds(bounds, { padding: [40, 40] });
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, [apartments, missionCounts]);

  return (
    <div ref={ref} style={{ height: '70vh', width: '100%', borderRadius: 16, overflow: 'hidden', border: '1px solid #E8E4DC' }} />
  );
}
