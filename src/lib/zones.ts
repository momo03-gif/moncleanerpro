// ── Zones couleur par proximité géographique ────────────────────────────────
// Regroupe les appartements proches pour aider l'admin à confier les missions
// d'un même secteur au même cleaner.

// Rayon de regroupement. SEUL endroit à modifier pour ajuster la proximité.
export const ZONE_RADIUS_KM = 1;

// 1 zone = 1 couleur. Palette ordonnée (hex pour l'affichage, key stable, nom lisible).
// 16 couleurs distinctes → chaque zone a sa propre couleur (pas de « 2 »).
export const ZONE_PALETTE = [
  { key: 'red',    hex: '#E5484D', name: 'Zone rouge' },
  { key: 'blue',   hex: '#3E63DD', name: 'Zone bleue' },
  { key: 'green',  hex: '#46A758', name: 'Zone verte' },
  { key: 'orange', hex: '#E5731A', name: 'Zone orange' },
  { key: 'purple', hex: '#8E4EC6', name: 'Zone violette' },
  { key: 'teal',   hex: '#12A594', name: 'Zone turquoise' },
  { key: 'pink',   hex: '#E54690', name: 'Zone rose' },
  { key: 'brown',  hex: '#AD7F58', name: 'Zone marron' },
  { key: 'yellow', hex: '#F5D90A', name: 'Zone jaune' },
  { key: 'gray',   hex: '#8B8D98', name: 'Zone grise' },
  { key: 'black',  hex: '#1A1A1A', name: 'Zone noire' },
  { key: 'white',  hex: '#FFFFFF', name: 'Zone blanche' },
  { key: 'cyan',   hex: '#00B4D8', name: 'Zone cyan' },
  { key: 'lime',   hex: '#84CC16', name: 'Zone citron' },
  { key: 'indigo', hex: '#4F46E5', name: 'Zone indigo' },
  { key: 'amber',  hex: '#D97706', name: 'Zone ambre' },
] as const;

export interface ZoneAssign { zoneId: string; zoneColor: string; zoneName: string; }
export interface ClusterInput { id: string; latitude?: number | null; longitude?: number | null; }

// Distance entre deux points GPS (formule de Haversine), en km.
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // rayon terrestre moyen (km)
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Clustering glouton déterministe : on trie par id (stabilité), on prend une
// graine non assignée, on agrège tous les apparts à < ZONE_RADIUS_KM, on passe
// à la couleur suivante. Les apparts sans coordonnées ne reçoivent pas de zone.
export function clusterApartments(apts: ClusterInput[]): Map<string, ZoneAssign> {
  const withCoords = apts
    .filter(a => a.latitude != null && a.longitude != null)
    .sort((a, b) => a.id.localeCompare(b.id));

  const result = new Map<string, ZoneAssign>();
  const assigned = new Set<string>();
  let zoneIndex = 0;

  for (const seed of withCoords) {
    if (assigned.has(seed.id)) continue;

    const palette = ZONE_PALETTE[zoneIndex % ZONE_PALETTE.length];
    const wrap = Math.floor(zoneIndex / ZONE_PALETTE.length); // > 0 si plus de zones que de couleurs
    const zoneId = `zone_${palette.key}_${zoneIndex}`;
    const zoneName = wrap > 0 ? `${palette.name} ${wrap + 1}` : palette.name;
    const zone: ZoneAssign = { zoneId, zoneColor: palette.hex, zoneName };

    result.set(seed.id, zone);
    assigned.add(seed.id);

    for (const other of withCoords) {
      if (assigned.has(other.id)) continue;
      const d = haversineKm(seed.latitude!, seed.longitude!, other.latitude!, other.longitude!);
      if (d <= ZONE_RADIUS_KM) {
        result.set(other.id, zone);
        assigned.add(other.id);
      }
    }
    zoneIndex++;
  }
  return result;
}

// Géocode une adresse via notre route serveur (qui appelle Nominatim/OSM).
// SEUL point à changer pour basculer vers un autre fournisseur plus tard.
export async function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
  if (!address || !address.trim()) return null;
  try {
    const res = await fetch(`/api/geocode?q=${encodeURIComponent(address)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data && typeof data.lat === 'number' && typeof data.lon === 'number') {
      return { lat: data.lat, lon: data.lon };
    }
    return null;
  } catch {
    return null;
  }
}
