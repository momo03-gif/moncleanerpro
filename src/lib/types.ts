export type Role = 'admin' | 'cleaner' | 'hotel';

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  phone?: string;
  rating?: number;
  completedMissions?: number;
  status?: 'available' | 'busy' | 'offline';
}

export type MissionStatus = 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
export type MissionType = 'checkout' | 'checkin' | 'deep_clean' | 'regular';

export interface Mission {
  id: string;
  property: string;
  address: string;
  date: string;
  time: string;
  duration: number;
  status: MissionStatus;
  cleanerId?: string;
  cleanerName?: string;
  price: number;
  type: MissionType;
  requestedBy?: string;
  notes?: string;
}

// Annonce déposée par un hôtel
export type AnnounceStatus = 'pending' | 'validated' | 'refused' | 'in_progress' | 'completed';
export type AnnounceType = 'menage' | 'checkin' | 'checkout' | 'grand_menage';

export interface HotelAnnounce {
  id: string;
  hotelId: string;
  hotelName: string;
  type: AnnounceType;
  date: string;
  timeStart: string;
  timeEnd: string;
  guestCount: number;
  instructions?: string;
  status: AnnounceStatus;
  cleanerId?: string;
  cleanerName?: string;
}

// Appartement Airbnb géré par l'admin
export interface Apartment {
  id: string;
  name: string;
  address: string;
  accessCode: string;
  entryDirectives: string;
  cleanerId?: string;
  cleanerName?: string;
}

export interface FinancialEntry {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
}
