// Modèle de pré-remplissage « Refaire cette demande » (espace hôtel), transmis de
// l'historique vers la page de création via sessionStorage. Les dates ne sont pas
// reprises (l'hôtel choisit toujours de nouvelles dates).

export const HOTEL_PREFILL_KEY = 'mcp_hotel_prefill';

export interface HotelPrefill {
  type: string;
  timeStart: string;
  timeEnd: string;
  guestCount: string;
  instructions: string;
}

export function readHotelPrefill(): HotelPrefill | null {
  try {
    const raw = sessionStorage.getItem(HOTEL_PREFILL_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(HOTEL_PREFILL_KEY); // usage unique
    return JSON.parse(raw) as HotelPrefill;
  } catch {
    return null;
  }
}

export function writeHotelPrefill(p: HotelPrefill): void {
  try { sessionStorage.setItem(HOTEL_PREFILL_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}
