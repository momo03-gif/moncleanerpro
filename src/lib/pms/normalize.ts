// ── Lecture tolérante d'une réservation de PMS (logique PURE) ─────────────────
//
// Tous les éditeurs ne publient pas le nom exact de leurs champs. Plutôt que de
// figer une orthographe devinée, on accepte les variantes courantes du même
// concept (`arrival`, `arrivalDate`, `checkIn`, `date_from`…).
//
// RÈGLE DE SÛRETÉ : sans date d'arrivée ET de départ reconnues, on REFUSE la
// réservation. Une date inventée créerait un ménage le mauvais jour — bien pire
// qu'une synchro qui échoue visiblement et bascule la conciergerie sur l'iCal.

import type { ICalEvent } from '../ical';

type Row = Record<string, unknown>;

/** Première valeur non vide parmi plusieurs noms de champ possibles. */
function pick(row: Row, names: string[]): unknown {
  for (const n of names) {
    const v = row[n];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return undefined;
}

/** Date au format YYYY-MM-DD, quelle que soit la forme reçue (ISO complet inclus). */
export function pickDate(row: Row, names: string[]): string | undefined {
  const raw = pick(row, names);
  if (typeof raw !== 'string') return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw.trim());
  return m ? `${m[1]}-${m[2]}-${m[3]}` : undefined;
}

/** Heure HH:MM — accepte « 15 », « 15:00 », « 15:00:00 », 15 (nombre). */
export function pickTime(row: Row, names: string[]): string | undefined {
  const raw = pick(row, names);
  if (typeof raw === 'number') {
    return raw >= 0 && raw <= 23 ? `${String(raw).padStart(2, '0')}:00` : undefined;
  }
  if (typeof raw !== 'string') return undefined;
  const m = /^(\d{1,2})(?::(\d{2}))?/.exec(raw.trim());
  if (!m) return undefined;
  const h = parseInt(m[1], 10);
  return h >= 0 && h <= 23 ? `${String(h).padStart(2, '0')}:${m[2] ?? '00'}` : undefined;
}

/** Somme des occupants, quelle que soit la façon dont l'éditeur les découpe. */
export function pickGuests(row: Row): number | undefined {
  const single = pick(row, ['numberOfGuests', 'guests', 'people', 'persons', 'occupancy']);
  if (typeof single === 'number' && single > 0) return single;
  const adults = pick(row, ['numAdult', 'adults', 'numAdults']);
  const children = pick(row, ['numChild', 'children', 'numChildren', 'kids']);
  const total = (typeof adults === 'number' ? adults : 0) + (typeof children === 'number' ? children : 0);
  return total > 0 ? total : undefined;
}

/** Nom du voyageur, en un seul morceau. */
export function pickGuestName(row: Row): string | undefined {
  const full = pick(row, ['guestName', 'guest_name', 'name', 'title']);
  if (typeof full === 'string' && full.trim()) return full.trim();
  const first = pick(row, ['firstName', 'first_name', 'guestFirstName']);
  const last = pick(row, ['lastName', 'last_name', 'guestLastName']);
  const joined = [first, last].filter(v => typeof v === 'string' && v.trim()).join(' ').trim();
  return joined || undefined;
}

/** Vrai quand le statut reçu désigne une annulation. */
export function isCancelled(status: unknown, cancelledValues = ['cancelled', 'canceled', 'cancellation', 'declined']): boolean {
  return typeof status === 'string' && cancelledValues.includes(status.trim().toLowerCase());
}

/** Vrai quand la ligne est un blocage de calendrier, pas un séjour. */
export function isBlocked(status: unknown, blockedValues = ['black', 'blocked', 'unavailable', 'owner_block']): boolean {
  return typeof status === 'string' && blockedValues.includes(status.trim().toLowerCase());
}

export interface FieldNames {
  id: string[];
  arrival: string[];
  departure: string[];
  arrivalTime: string[];
  departureTime: string[];
  status: string[];
}

/**
 * Convertit une réservation d'un PMS dans la forme que le moteur de synchro
 * consomme déjà. Renvoie null si les dates ne sont pas reconnues — l'appelant
 * doit alors considérer que le contrat de l'API a changé.
 */
export function toEvent(row: Row, prefix: string, fields: FieldNames): ICalEvent | null {
  const start = pickDate(row, fields.arrival);
  const end = pickDate(row, fields.departure);
  if (!start || !end) return null;

  const rawId = pick(row, fields.id);
  const status = pick(row, fields.status);
  const guests = pickGuests(row);
  const who = pickGuestName(row);

  return {
    uid: `${prefix}-${String(rawId ?? `${start}-${end}`)}`,
    status: isCancelled(status) ? 'CANCELLED' : 'CONFIRMED',
    summary: isBlocked(status)
      ? 'Blocked'
      : [who, guests ? `${guests} pers.` : null].filter(Boolean).join(' · ') || 'Réservation',
    start,
    end,
    startTime: pickTime(row, fields.arrivalTime),
    endTime: pickTime(row, fields.departureTime),
  };
}

/**
 * Applique `toEvent` à une liste, et REFUSE le lot entier si rien n'a pu être
 * lu : mieux vaut une erreur visible qu'une synchro silencieusement vide, qui
 * ferait croire à la conciergerie qu'elle n'a aucune réservation.
 */
export function toEvents(rows: Row[], prefix: string, fields: FieldNames, source: string): ICalEvent[] {
  const events = rows.map(r => toEvent(r, prefix, fields)).filter((e): e is ICalEvent => e !== null);
  if (rows.length > 0 && events.length === 0) {
    throw new Error(`Réponse ${source} non comprise : aucune date de séjour lisible.`);
  }
  return events;
}
