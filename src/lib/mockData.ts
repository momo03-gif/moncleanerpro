import { User, Mission, FinancialEntry, HotelAnnounce, Apartment, Payment } from './types';

// ── Mutable users state
let _users: User[] = [
  { id: '1', name: 'Admin MonCleaner', email: 'admin@moncleanerpro.com', password: 'admin123', role: 'admin', isActive: true },
  { id: '2', name: 'Sophie Martin', email: 'sophie@cleaner.com', password: 'cleaner123', role: 'cleaner', phone: '06 12 34 56 78', rating: 4.9, completedMissions: 142, status: 'available', isActive: true, hourlyRateHotel: 12, rateAirbnb: 18 },
  { id: '3', name: 'Lucas Bernard', email: 'lucas@cleaner.com', password: 'cleaner123', role: 'cleaner', phone: '06 98 76 54 32', rating: 4.7, completedMissions: 89, status: 'busy', isActive: true, hourlyRateHotel: 10, rateAirbnb: 15 },
  { id: '4', name: 'Hôtel Lumière', email: 'contact@lumiere.com', password: 'hotel123', role: 'hotel', isActive: true, phone: '01 23 45 67 89' },
  { id: '5', name: 'Résidence Étoile', email: 'contact@etoile.com', password: 'hotel123', role: 'hotel', isActive: true, phone: '01 98 76 54 32' },
];

export function getUsers(): User[] { return _users; }
export function setUserActive(id: string, active: boolean): void { _users = _users.map(u => u.id === id ? { ...u, isActive: active } : u); }
export function addUser(user: User): void { _users = [..._users, user]; }
export function updateUserRates(id: string, hourlyRateHotel: number, rateAirbnb: number): void { _users = _users.map(u => u.id === id ? { ...u, hourlyRateHotel, rateAirbnb } : u); }
export function getActiveCleaners(): User[] { return _users.filter(u => u.role === 'cleaner' && u.isActive !== false); }
export const USERS = _users;

// ── Mutable missions state
let _missions: Mission[] = [
  { id: 'm1', property: 'Appartement Opéra', address: '12 Rue de la Paix, Paris 75001', date: '2026-06-02', time: '10:00', duration: 3, status: 'accepted', cleanerId: '2', cleanerName: 'Sophie Martin', price: 120, cleanerGain: 36, type: 'checkout', source: 'hotel', requestedBy: 'Hôtel Lumière' },
  { id: 'm2', property: 'Suite Marais', address: '8 Place des Vosges, Paris 75003', date: '2026-06-02', time: '14:00', duration: 2, status: 'accepted', cleanerId: '2', cleanerName: 'Sophie Martin', price: 80, cleanerGain: 24, type: 'checkin', source: 'hotel', requestedBy: 'Hôtel Lumière' },
  { id: 'm3', property: 'Studio Montmartre', address: '3 Rue Lepic, Paris 75018', date: '2026-06-03', time: '09:00', duration: 2, status: 'pending', price: 18, type: 'regular', source: 'airbnb', requestedBy: 'Résidence Étoile' },
  { id: 'm4', property: 'Penthouse République', address: '45 Place de la République, Paris 75010', date: '2026-06-04', time: '11:00', duration: 4, status: 'pending', price: 150, type: 'deep_clean', source: 'hotel', requestedBy: 'Hôtel Lumière' },
  { id: 'm5', property: 'Loft Nation', address: '22 Rue Oberkampf, Paris 75011', date: '2026-05-28', time: '10:00', duration: 3, status: 'completed', cleanerId: '2', cleanerName: 'Sophie Martin', price: 120, cleanerGain: 36, type: 'checkout', source: 'hotel', requestedBy: 'Résidence Étoile' },
  { id: 'm6', property: 'Appartement Bastille', address: '5 Rue de la Roquette, Paris 75011', date: '2026-05-30', time: '15:00', duration: 2, status: 'completed', cleanerId: '3', cleanerName: 'Lucas Bernard', price: 80, cleanerGain: 20, type: 'checkin', source: 'hotel', requestedBy: 'Hôtel Lumière' },
  { id: 'm7', property: 'Studio Nation', address: '18 Avenue Daumesnil, Paris 75012', date: '2026-06-05', time: '09:30', duration: 2, status: 'pending', price: 80, type: 'regular', source: 'hotel', requestedBy: 'Hôtel Lumière' },
  { id: 'm8', property: 'Appartement Opéra', address: '12 Rue de la Paix, Paris 75001', date: '2026-06-01', time: '09:00', duration: 2, status: 'completed', cleanerId: '2', cleanerName: 'Sophie Martin', price: 18, cleanerGain: 18, type: 'checkin', source: 'airbnb', requestedBy: 'Hôtel Lumière' },
  { id: 'm9', property: 'Suite Marais', address: '8 Place des Vosges, Paris 75003', date: '2026-06-03', time: '10:00', duration: 3, status: 'completed', cleanerId: '3', cleanerName: 'Lucas Bernard', price: 15, cleanerGain: 15, type: 'checkout', source: 'airbnb', requestedBy: 'Hôtel Lumière' },
];

export function getMissions(): Mission[] { return _missions; }
export const MISSIONS = _missions;

export function addMission(mission: Mission): void { _missions = [..._missions, mission]; }

// ── Mutable payments state
let _payments: Payment[] = [
  { id: 'pay1', cleanerId: '2', cleanerName: 'Sophie Martin', amount: 36, missionIds: ['m5'], date: '2026-05-31', month: '2026-05' },
  { id: 'pay2', cleanerId: '3', cleanerName: 'Lucas Bernard', amount: 20, missionIds: ['m6'], date: '2026-05-31', month: '2026-05' },
];

export function getPayments(): Payment[] { return _payments; }
export function addPayment(payment: Payment): void { _payments = [..._payments, payment]; }

export const HOTEL_ANNOUNCES: HotelAnnounce[] = [
  { id: 'a1', hotelId: '4', hotelName: 'Hôtel Lumière', type: 'checkout', date: '2026-06-03', timeStart: '10:00', timeEnd: '12:00', guestCount: 2, instructions: 'Changement complet du linge. Départ 12h max.', status: 'pending' },
  { id: 'a2', hotelId: '4', hotelName: 'Hôtel Lumière', type: 'menage', date: '2026-06-04', timeStart: '09:00', timeEnd: '11:00', guestCount: 1, status: 'validated', cleanerId: '2', cleanerName: 'Sophie Martin' },
  { id: 'a3', hotelId: '5', hotelName: 'Résidence Étoile', type: 'grand_menage', date: '2026-06-05', timeStart: '08:00', timeEnd: '12:00', guestCount: 4, instructions: 'Nettoyage fond après séjour longue durée.', status: 'pending' },
  { id: 'a4', hotelId: '4', hotelName: 'Hôtel Lumière', type: 'checkin', date: '2026-05-30', timeStart: '14:00', timeEnd: '15:30', guestCount: 2, status: 'completed', cleanerId: '3', cleanerName: 'Lucas Bernard' },
  { id: 'a5', hotelId: '5', hotelName: 'Résidence Étoile', type: 'checkout', date: '2026-05-28', timeStart: '11:00', timeEnd: '13:00', guestCount: 3, status: 'refused' },
];

export const APARTMENTS: Apartment[] = [
  { id: 'ap1', name: 'Appartement Opéra', address: '12 Rue de la Paix, Paris 75001', portalCode: '4512B', keyboxCode: 'B#4512', entryDirectives: "Clé boîte n°3 dans le couloir. Laisser les clés à l'intérieur après le ménage.", cleanerId: '2', cleanerName: 'Sophie Martin' },
  { id: 'ap2', name: 'Suite Marais', address: '8 Place des Vosges, Paris 75003', portalCode: 'A7834', entryDirectives: 'Badge magnétique à récupérer au gardien. Étage 3, porte gauche.' },
  { id: 'ap3', name: 'Studio Montmartre', address: '3 Rue Lepic, Paris 75018', keyboxCode: '2291', entryDirectives: "Boîte à clés sur la façade. Laisser les clés à l'intérieur à la fin." },
  { id: 'ap4', name: 'Penthouse République', address: '45 Place de la République, Paris 75010', portalCode: 'R0099', entryDirectives: 'Interphone "Dupuis". Ascenseur dernier étage, porte B.', cleanerId: '3', cleanerName: 'Lucas Bernard' },
];

export const FINANCIAL: FinancialEntry[] = [];

export function findUser(email: string, password: string): User | null {
  const u = _users.find(u => u.email === email && u.password === password);
  if (!u) return null;
  if (u.role === 'cleaner' && u.isActive === false) return null;
  return u;
}

export function getMissionsForCleaner(cleanerId: string): Mission[] { return _missions.filter(m => m.cleanerId === cleanerId); }
export function getProposedMissions(): Mission[] { return _missions.filter(m => m.status === 'pending' && !m.cleanerId); }
export function getAnnouncesForHotel(hotelName: string): HotelAnnounce[] { return HOTEL_ANNOUNCES.filter(a => a.hotelName === hotelName); }

export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
