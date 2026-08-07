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

// Nombre de jours d'une DURATION IS-8601 (RFC 5545), ex. P2D, P1W, P1DT12H.
// On ne garde que la composante en jours/semaines (suffisant pour un séjour).
function parseDurationDays(v: string): number | null {
  const m = v.match(/^[+-]?P(?:(\d+)W)?(?:(\d+)D)?/);
  if (!m || (!m[1] && !m[2])) return null;
  return (m[1] ? parseInt(m[1], 10) * 7 : 0) + (m[2] ? parseInt(m[2], 10) : 0);
}

// Ajoute des jours à une date 'YYYY-MM-DD' (calcul en UTC pour éviter les décalages).
function addDaysISO(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function parseICal(raw: string): ICalEvent[] {
  const lines = unfold(raw);
  const events: ICalEvent[] = [];
  let cur: (Partial<ICalEvent> & { _durDays?: number }) | null = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (line === 'END:VEVENT') {
      // Robustesse multi-plateformes : un évènement sans DTEND ne doit pas être
      // perdu. On reconstruit la fin depuis DURATION si présente, sinon on suppose
      // une nuit — mieux que d'ignorer la réservation.
      //
      // ⚠️ Séjour « de zéro nuit ». Certains exports produisent DTEND <= DTSTART sur
      // un évènement tout-en-un-jour. Hostaway le fait pour ses marqueurs
      // « reserved » (réservations croisées entre annonces d'un même logement) :
      // une nuit occupée le 07 ressort en DTSTART=DTEND=07. Pris au pied de la
      // lettre, le départ tombait le 07 et le ménage était programmé un jour TROP
      // TÔT. Une nuit occupée implique un départ le lendemain : on normalise à
      // start + 1. Ne concerne QUE les évènements sans heure — un évènement horaire
      // qui commence et finit le même jour est parfaitement légitime.
      if (cur && cur.uid && cur.start) {
        if (!cur.end) {
          cur.end = addDaysISO(cur.start, cur._durDays && cur._durDays > 0 ? cur._durDays : 1);
        } else if (!cur.startTime && !cur.endTime && cur.end <= cur.start) {
          cur.end = addDaysISO(cur.start, 1);
        }
        delete cur._durDays;
        events.push(cur as ICalEvent);
      }
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
      case 'DURATION': {
        const days = parseDurationDays(value.trim());
        if (days != null) cur._durDays = days;
        break;
      }
    }
  }
  return events;
}
