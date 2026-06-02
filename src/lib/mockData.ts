import { User, Mission, FinancialEntry, HotelAnnounce, Apartment } from './types';

export const USERS: User[] = [
  { id: '1', name: 'Admin MonCleaner', email: 'admin@moncleanerpro.com', password: 'admin123', role: 'admin' },
  { id: '2', name: 'Sophie Martin', email: 'sophie@cleaner.com', password: 'cleaner123', role: 'cleaner', phone: '06 12 34 56 78', rating: 4.9, completedMissions: 142, status: 'available' },
  { id: '3', name: 'Lucas Bernard', email: 'lucas@cleaner.com', password: 'cleaner123', role: 'cleaner', phone: '06 98 76 54 32', rating: 4.7, completedMissions: 89, status: 'busy' },
  { id: '4', name: 'Hôtel Lumière', email: 'contact@lumiere.com', password: 'hotel123', role: 'hotel', phone: '01 23 45 67 89' },
  { id: '5', name: 'Résidence Étoile', email: 'contact@etoile.com', password: 'hotel123', role: 'hotel', phone: '01 98 76 54 32' },
];

export const MISSIONS: Mission[] = [
  { id: 'm1', property: 'Appartement Opéra', address: '12 Rue de la Paix, Paris 75001', date: '2026-06-02', time: '10:00', duration: 3, status: 'accepted', cleanerId: '2', cleanerName: 'Sophie Martin', price: 90, type: 'checkout', requestedBy: 'Hôtel Lumière' },
  { id: 'm2', property: 'Suite Marais', address: '8 Place des Vosges, Paris 75003', date: '2026-06-02', time: '14:00', duration: 2, status: 'accepted', cleanerId: '2', cleanerName: 'Sophie Martin', price: 60, type: 'checkin', requestedBy: 'Hôtel Lumière' },
  { id: 'm3', property: 'Studio Montmartre', address: '3 Rue Lepic, Paris 75018', date: '2026-06-03', time: '09:00', duration: 2, status: 'pending', price: 55, type: 'regular', requestedBy: 'Résidence Étoile' },
  { id: 'm4', property: 'Penthouse République', address: '45 Place de la République, Paris 75010', date: '2026-06-04', time: '11:00', duration: 4, status: 'pending', price: 120, type: 'deep_clean', requestedBy: 'Hôtel Lumière' },
  { id: 'm5', property: 'Loft Nation', address: '22 Rue Oberkampf, Paris 75011', date: '2026-05-28', time: '10:00', duration: 3, status: 'completed', cleanerId: '2', cleanerName: 'Sophie Martin', price: 90, type: 'checkout', requestedBy: 'Résidence Étoile' },
  { id: 'm6', property: 'Appartement Bastille', address: '5 Rue de la Roquette, Paris 75011', date: '2026-05-30', time: '15:00', duration: 2, status: 'completed', cleanerId: '3', cleanerName: 'Lucas Bernard', price: 60, type: 'checkin', requestedBy: 'Hôtel Lumière' },
  { id: 'm7', property: 'Studio Nation', address: '18 Avenue Daumesnil, Paris 75012', date: '2026-06-05', time: '09:30', duration: 2, status: 'pending', price: 55, type: 'regular', requestedBy: 'Hôtel Lumière' },
];

export const HOTEL_ANNOUNCES: HotelAnnounce[] = [
  { id: 'a1', hotelId: '4', hotelName: 'Hôtel Lumière', type: 'checkout', date: '2026-06-03', timeStart: '10:00', timeEnd: '12:00', guestCount: 2, instructions: 'Changement complet du linge. Départ 12h max.', status: 'pending' },
  { id: 'a2', hotelId: '4', hotelName: 'Hôtel Lumière', type: 'menage', date: '2026-06-04', timeStart: '09:00', timeEnd: '11:00', guestCount: 1, status: 'validated', cleanerId: '2', cleanerName: 'Sophie Martin' },
  { id: 'a3', hotelId: '5', hotelName: 'Résidence Étoile', type: 'grand_menage', date: '2026-06-05', timeStart: '08:00', timeEnd: '12:00', guestCount: 4, instructions: 'Nettoyage fond après séjour longue durée.', status: 'pending' },
  { id: 'a4', hotelId: '4', hotelName: 'Hôtel Lumière', type: 'checkin', date: '2026-05-30', timeStart: '14:00', timeEnd: '15:30', guestCount: 2, status: 'completed', cleanerId: '3', cleanerName: 'Lucas Bernard' },
  { id: 'a5', hotelId: '5', hotelName: 'Résidence Étoile', type: 'checkout', date: '2026-05-28', timeStart: '11:00', timeEnd: '13:00', guestCount: 3, status: 'refused' },
];

export const APARTMENTS: Apartment[] = [
  { id: 'ap1', name: 'Appartement Opéra', address: '12 Rue de la Paix, Paris 75001', accessCode: 'B#4512', entryDirectives: 'Digicode portail : 4512B. Clé boîte n°3 dans le couloir.', cleanerId: '2', cleanerName: 'Sophie Martin' },
  { id: 'ap2', name: 'Suite Marais', address: '8 Place des Vosges, Paris 75003', accessCode: 'A#7834', entryDirectives: 'Badge magnétique à récupérer au gardien. Étage 3, porte gauche.' },
  { id: 'ap3', name: 'Studio Montmartre', address: '3 Rue Lepic, Paris 75018', accessCode: '2291', entryDirectives: 'Code boîte à clés sur la façade : 2291. Laisser les clés à l\'intérieur à la fin.' },
  { id: 'ap4', name: 'Penthouse République', address: '45 Place de la République, Paris 75010', accessCode: 'R#0099', entryDirectives: 'Interphone "Dupuis". Ascenseur dernier étage, porte B.', cleanerId: '3', cleanerName: 'Lucas Bernard' },
];

export const FINANCIAL: FinancialEntry[] = [
  { id: 'f1', date: '2026-06-02', description: 'Mission Appartement Opéra', amount: 90, type: 'income', category: 'Mission' },
  { id: 'f2', date: '2026-06-02', description: 'Mission Suite Marais', amount: 60, type: 'income', category: 'Mission' },
  { id: 'f3', date: '2026-05-28', description: 'Mission Loft Nation', amount: 90, type: 'income', category: 'Mission' },
  { id: 'f4', date: '2026-05-30', description: 'Mission Appartement Bastille', amount: 60, type: 'income', category: 'Mission' },
  { id: 'f5', date: '2026-05-30', description: 'Paiement Sophie Martin', amount: 54, type: 'expense', category: 'Salaire' },
  { id: 'f6', date: '2026-05-30', description: 'Paiement Lucas Bernard', amount: 48, type: 'expense', category: 'Salaire' },
  { id: 'f7', date: '2026-05-01', description: 'Abonnement logiciels', amount: 29, type: 'expense', category: 'Abonnement' },
  { id: 'f8', date: '2026-05-15', description: 'Matériel de nettoyage', amount: 85, type: 'expense', category: 'Fournitures' },
];

export function findUser(email: string, password: string): User | null {
  return USERS.find(u => u.email === email && u.password === password) ?? null;
}

export function getMissionsForCleaner(cleanerId: string): Mission[] {
  return MISSIONS.filter(m => m.cleanerId === cleanerId);
}

export function getProposedMissions(): Mission[] {
  return MISSIONS.filter(m => m.status === 'pending' && !m.cleanerId);
}

export function getAnnouncesForHotel(hotelName: string): HotelAnnounce[] {
  return HOTEL_ANNOUNCES.filter(a => a.hotelName === hotelName);
}
