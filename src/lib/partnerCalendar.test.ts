import { describe, it, expect } from 'vitest';
import { buildCalendar, dayRange, daySummary, departuresWithoutCleaning } from './partnerCalendar';
import type { Apartment, Mission, Reservation } from './types';

const apt = (id: string, name: string): Apartment =>
  ({ id, name, address: '1 rue du Test', entryDirectives: '' } as Apartment);

const stay = (airbnbId: string, checkIn: string, checkOut: string, extra: Partial<Reservation> = {}): Reservation =>
  ({ id: `${airbnbId}-${checkIn}`, airbnbId, platform: 'airbnb', externalUid: 'x', status: 'confirmed', checkIn, checkOut, ...extra } as Reservation);

const cleaning = (airbnbId: string, date: string, status = 'pending'): Mission =>
  ({ id: `m-${airbnbId}-${date}`, airbnbId, date, status, property: '', address: '', time: '11:00', duration: 60, price: 0, type: 'checkout' } as Mission);

describe('dayRange', () => {
  it('produit des jours consécutifs', () => {
    expect(dayRange('2026-08-14', 3)).toEqual(['2026-08-14', '2026-08-15', '2026-08-16']);
  });

  it('passe correctement un changement de mois', () => {
    expect(dayRange('2026-08-30', 3)).toEqual(['2026-08-30', '2026-08-31', '2026-09-01']);
  });
});

describe('buildCalendar — grille logements × jours', () => {
  const apartments = [apt('a1', 'T2 Croix-Rousse'), apt('a2', 'Studio Bellecour')];

  it('occupe les nuits du séjour, pas le jour du départ', () => {
    const rows = buildCalendar(apartments, [stay('a1', '2026-08-14', '2026-08-16')], [], '2026-08-14', 4);
    const a1 = rows[0].cells;
    expect(a1.map(c => c.occupied)).toEqual([true, true, false, false]);
    expect(a1[0].arrival).toBe(true);
    expect(a1[2].departure).toBe(true);
  });

  it('marque un turnover quand un départ et une arrivée tombent le même jour', () => {
    const rows = buildCalendar(
      apartments,
      [stay('a1', '2026-08-12', '2026-08-15'), stay('a1', '2026-08-15', '2026-08-18', { checkInTime: '15:00' })],
      [], '2026-08-14', 3,
    );
    const turnoverDay = rows[0].cells.find(c => c.day === '2026-08-15')!;
    expect(turnoverDay.turnover).toBe(true);
    expect(turnoverDay.arrivalTime).toBe('15:00');
  });

  it('rattache le ménage au bon logement et au bon jour', () => {
    const rows = buildCalendar(apartments, [], [cleaning('a2', '2026-08-15', 'completed')], '2026-08-14', 3);
    expect(rows[0].cells.every(c => !c.missionId)).toBe(true);
    expect(rows[1].cells[1].missionStatus).toBe('completed');
  });

  it('ignore les réservations annulées', () => {
    const rows = buildCalendar(apartments, [stay('a1', '2026-08-14', '2026-08-16', { status: 'cancelled' })], [], '2026-08-14', 3);
    expect(rows[0].cells.every(c => !c.occupied)).toBe(true);
  });

  it('ignore les ménages annulés', () => {
    const rows = buildCalendar(apartments, [], [cleaning('a1', '2026-08-14', 'cancelled')], '2026-08-14', 2);
    expect(rows[0].cells[0].missionId).toBeUndefined();
  });

  it('rend une ligne par logement, même sans réservation', () => {
    const rows = buildCalendar(apartments, [], [], '2026-08-14', 5);
    expect(rows).toHaveLength(2);
    expect(rows[0].cells).toHaveLength(5);
  });
});

describe('daySummary — compteurs du jour', () => {
  it('additionne arrivées, départs, turnovers et ménages', () => {
    const rows = buildCalendar(
      [apt('a1', 'A'), apt('a2', 'B')],
      [
        stay('a1', '2026-08-12', '2026-08-15'),
        stay('a1', '2026-08-15', '2026-08-18'),
        stay('a2', '2026-08-15', '2026-08-20'),
      ],
      [cleaning('a1', '2026-08-15', 'completed')],
      '2026-08-15', 1,
    );
    expect(daySummary(rows, '2026-08-15')).toEqual({
      arrivals: 2, departures: 1, turnovers: 1, cleanings: 1, cleaningsDone: 1,
    });
  });
});

describe('departuresWithoutCleaning — le trou qui coûte cher', () => {
  it('repère un départ sans ménage prévu', () => {
    const rows = buildCalendar(
      [apt('a1', 'T2 Croix-Rousse')],
      [stay('a1', '2026-08-12', '2026-08-15')],
      [], '2026-08-14', 3,
    );
    expect(departuresWithoutCleaning(rows)).toEqual([{ apartmentName: 'T2 Croix-Rousse', day: '2026-08-15' }]);
  });

  it('ne signale rien quand le ménage est prévu', () => {
    const rows = buildCalendar(
      [apt('a1', 'T2')],
      [stay('a1', '2026-08-12', '2026-08-15')],
      [cleaning('a1', '2026-08-15')], '2026-08-14', 3,
    );
    expect(departuresWithoutCleaning(rows)).toEqual([]);
  });
});
