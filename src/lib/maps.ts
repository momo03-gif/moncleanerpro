// Lien universel vers une carte pour une adresse. Ouvre l'application Maps du
// téléphone (Google Maps / Plans) ou le web selon l'appareil. Format officiel
// Google Maps URL, compatible Android, iOS et navigateur.
export function mapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}
