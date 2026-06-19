// ════════════════════════════════════════════════════════════════════════════
//  Géolocalisation du pointage — utilitaires.
//  Pointage discret : UNE position au démarrage, UNE à la fin. Pas de suivi
//  continu (batterie + vie privée). Position approximative (haute précision
//  désactivée) — suffisante pour vérifier la proximité début ↔ fin.
// ════════════════════════════════════════════════════════════════════════════

// Tolérance de proximité entre la position de début et de fin (mètres).
export const TRACKING_TOLERANCE_METERS = 200;

// Message affiché au cleaner si la position de fin est trop éloignée du début.
export const PROXIMITY_ERROR =
  'Vous devez terminer la mission à proximité du lieu où elle a été commencée.';

export interface GeoPoint { lat: number; lng: number; }

// Distance en mètres entre deux points (formule de haversine).
export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const R = 6371000; // rayon terrestre moyen (m)
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Position approximative, économe en batterie. Renvoie null si la géolocalisation
// est indisponible ou refusée (on ne bloque jamais le cleaner dans ce cas).
export function getApproxPosition(timeoutMs = 8000): Promise<GeoPoint | null> {
  return new Promise(resolve => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 60000 },
    );
  });
}
