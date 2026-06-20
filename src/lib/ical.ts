// ════════════════════════════════════════════════════════════════════════════
//  Mini-parseur iCal (RFC 5545) — suffisant pour les exports de calendrier des
//  plateformes de réservation (Airbnb, Booking, Smoobu, Lodgify, Beds24…).
//  Volontairement sans dépendance : on n'extrait que ce dont la synchro a besoin.
//  N'extrait PAS de récurrence (RRULE) : les calendriers de résa n'en utilisent pas.
// ════════════════════════════════════════════════════════════════════════════

export interface ICalEvent {
  uid: string;
  summary?: string;
  status?: string;         // CONFIRMED / CANCELLED / TENTATIVE (rarement présent)
  start: string;           // YYYY-MM-DD (arrivée)
  end: string;             // YYYY-MM-DD (départ — voir note d'exclusivité plus bas)
  startTime?: string;      // HH:mm si l'évènement porte une heure
  endTime?: string;        // HH:mm si l'évènement porte une heure
  description?: string;
}

// Déplie les lignes : une ligne continuée commence par un espace ou une tabulation
// (RFC 5545 « line folding »). Gère les fins de ligne CRLF et LF.
function unfold(raw: string): string[] {
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const out: string[] = [];
  for (const line of lines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

// Sépare « PROPRIÉTÉ;PARAMS:VALEUR » → { name, params, value }.
function parseLine(line: string): { name: string; params: Record<string, string>; value: string } | null {
  const colon = line.indexOf(':');
  if (colon === -1) return null;
  const left = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const segments = left.split(';');
  const name = segments[0].toUpperCase();
  const params: Record<string, string> = {};
  for (let i = 1; i < segments.length; i++) {
    const eq = segments[i].indexOf('=');
    if (eq !== -1) params[segments[i].slice(0, eq).toUpperCase()] = segments[i].slice(eq + 1);
  }
  return { name, params, value };
}

// Convertit une valeur DATE / DATE-TIME iCal en { date: 'YYYY-MM-DD', time?: 'HH:mm' }.
// Formats gérés : 20260131 (date) et 20260131T140000Z / 20260131T140000 (date-heure).
function parseICalDate(value: string): { date: string; time?: string } | null {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?Z?)?/);
  if (!m) return null;
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  const time = m[4] != null ? `${m[4]}:${m[5]}` : undefined;
  return { date, time };
}

// Déséchappe les caractères iCal dans les valeurs texte (\n \, \; \\).
function unescapeText(v: string): string {
  return v.replace(/\\n/gi, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\').trim();
}

export function parseICal(raw: string): ICalEvent[] {
  const lines = unfold(raw);
  const events: ICalEvent[] = [];
  let cur: Partial<ICalEvent> | null = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (line === 'END:VEVENT') {
      if (cur && cur.uid && cur.start && cur.end) events.push(cur as ICalEvent);
      cur = null;
      continue;
    }
    if (!cur) continue;

    const parsed = parseLine(line);
    if (!parsed) continue;
    const { name, value } = parsed;

    switch (name) {
      case 'UID': cur.uid = value.trim(); break;
      case 'SUMMARY': cur.summary = unescapeText(value); break;
      case 'DESCRIPTION': cur.description = unescapeText(value); break;
      case 'STATUS': cur.status = value.trim().toUpperCase(); break;
      case 'DTSTART': {
        const d = parseICalDate(value);
        if (d) { cur.start = d.date; if (d.time) cur.startTime = d.time; }
        break;
      }
      case 'DTEND': {
        const d = parseICalDate(value);
        if (d) { cur.end = d.date; if (d.time) cur.endTime = d.time; }
        break;
      }
    }
  }
  return events;
}
