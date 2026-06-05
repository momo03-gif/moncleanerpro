export type Role = 'admin' | 'cleaner' | 'hotel' | 'airbnb';

export type PendingStatus = 'pending' | 'approved' | 'refused';

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  phone?: string;
  address?: string;
  rating?: number;
  completedMissions?: number;
  status?: 'available' | 'busy' | 'offline';
  isActive?: boolean;
  hourlyRateHotel?: number;
  rateAirbnb?: number;
  pendingStatus?: PendingStatus;
}

export type MissionStatus = 'pending' | 'accepted' | 'validated' | 'in_progress' | 'completed' | 'cancelled';
export type MissionType = 'checkout' | 'checkin' | 'deep_clean' | 'regular';
export type MissionSource = 'hotel' | 'airbnb';

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
  cleanerGain?: number;
  type: MissionType;
  source?: MissionSource;
  requestedBy?: string;
  notes?: string;
  partnerId?: string;
  partnerName?: string;
  airbnbId?: string;
}

export type AnnounceStatus = 'pending' | 'validated' | 'refused' | 'in_progress' | 'completed';
export type AnnounceType = 'menage' | 'checkin' | 'checkout' | 'grand_menage';

export interface HotelAnnounce {
  id: string;
  hotelId: string;
  hotelName: string;
  type: AnnounceType;
  date: string;
  dateEnd?: string;
  timeStart: string;
  timeEnd: string;
  guestCount: number;
  instructions?: string;
  status: AnnounceStatus;
  cleanerId?: string;
  cleanerName?: string;
}

export interface Apartment {
  id: string;
  name: string;
  address: string;
  portalCode?: string;
  keyboxCode?: string;
  entryDirectives: string;
  cleanerId?: string;
  cleanerName?: string;
  clientPrice?: number;
  cleanerGain?: number;
  partnerId?: string;
  partnerName?: string;
  bedrooms?: number;
  beds?: number;
  sofaBeds?: number;
  notes?: string;
}

export interface Payment {
  id: string;
  cleanerId: string;
  cleanerName: string;
  amount: number;
  missionIds: string[];
  date: string;
  month: string;
}

export interface CleanerRow {
  id: string;
  user_id?: string;
  name: string;
  email: string;
  phone?: string | null;
  hourly_rate_hotel?: number;
  rate_airbnb?: number;
  status: string;
}

export interface FinancialEntry {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
}
