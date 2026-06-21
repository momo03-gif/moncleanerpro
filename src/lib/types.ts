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
  pendingStatus?: PendingStatus;
}

export type MissionStatus = 'pending' | 'accepted' | 'validated' | 'in_progress' | 'completed' | 'cancelled';
export type MissionType = 'checkout' | 'checkin' | 'deep_clean' | 'regular';
export type MissionSource = 'hotel' | 'airbnb';

// Prestation portée par la mission. Le nettoyage est le défaut historique ;
// la livraison s'ajoute sans système séparé. Orthogonal à MissionType.
export type MissionService = 'cleaning' | 'delivery' | 'cleaning_delivery';

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
  // Paiement cleaner (taux horaire × durée). Indépendant du prix client.
  missionDurationMinutes?: number;
  cleanerHourlyRateSnapshot?: number;
  apartmentDefaultDurationSnapshot?: number;
  // Zone de l'appartement lié (dérivée du join, lecture seule).
  zoneId?: string;
  zoneColor?: string;
  zoneName?: string;
  type: MissionType;
  // Prestation : nettoyage (défaut), livraison, ou les deux.
  service?: MissionService;
  // Consignes de livraison (quoi livrer / où déposer) — affichées au cleaner.
  deliveryInstructions?: string;
  // Lien entre missions d'une même commande (ménage + livraison à 2 personnes).
  groupId?: string;
  source?: MissionSource;
  requestedBy?: string;
  notes?: string;
  instructionsRaw?: string;
  partnerId?: string;
  partnerName?: string;
  airbnbId?: string;
  nextArrival?: string;
  nextArrivalTime?: string;
  // Horodatage de création — sert de proxy pour l'ordre d'attribution des missions.
  createdAt?: string;
  // Ordre manuel fixé par l'admin (par cleaner, à date égale). Prime sur le tri auto.
  manualOrder?: number;
  // Demande de temps supplémentaire (cleaner → admin). Indépendant de la durée payée
  // tant que l'admin n'a pas approuvé.
  extraTimeMinutes?: number;
  extraTimeReason?: string;
  extraTimeStatus?: ExtraTimeStatus;
  extraTimeRequestedAt?: string;
  // Pointage automatique (admin uniquement). Le cleaner ne voit jamais ces champs.
  startedAt?: string;
  endedAt?: string;
  actualDurationMinutes?: number;
  startLat?: number;
  startLng?: number;
  endLat?: number;
  endLng?: number;
}

// ── Photos avant/après des missions (références ; images dans Storage) ──────────
export type MissionPhotoKind = 'before' | 'after';

export interface MissionPhoto {
  id: string;
  missionId: string;
  kind: MissionPhotoKind;
  url: string;
  storagePath: string;
  uploadedBy?: string;
  createdAt: string;
}

// État d'une demande de temps supplémentaire faite par le cleaner.
export type ExtraTimeStatus = 'pending' | 'approved' | 'refused';

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
  estimatedCleaningMinutes?: number;
  cleanerGain?: number;
  // Zone géographique (proximité). Coordonnées géocodées depuis l'adresse.
  latitude?: number;
  longitude?: number;
  zoneId?: string;
  zoneColor?: string;
  zoneName?: string;
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
  hourly_rate?: number;
  // Anciens tarifs — conservés en base, plus utilisés par la logique de paie.
  hourly_rate_hotel?: number;
  rate_airbnb?: number;
  status: string;
  // Capacités : peut faire du nettoyage / de la livraison. Défaut : nettoyage seul.
  can_clean?: boolean;
  can_deliver?: boolean;
  // Montant fixe gagné par livraison (indépendant de la durée).
  delivery_rate?: number;
}

export interface CompanyInfo {
  name?: string;
  address?: string;
  siret?: string;
  vat?: string;
  email?: string;
  phone?: string;
  iban?: string;
  bic?: string;
}

export interface InvoiceLine {
  date: string;
  label: string;
  type: string;
  amount: number;
  // Champs enrichis (facultatifs — absents sur les anciennes factures archivées)
  apartment?: string;
  cleaner?: string;
  duration?: number;
  unitPrice?: number;
}

export interface InvoiceRecord {
  id: string;
  number: string;
  partnerLabel: string;
  partnerType: string;
  periodFrom: string;
  periodTo: string;
  total: number;
  lines: InvoiceLine[];
  status: string;
  createdAt: string;
}

export type NotificationType =
  | 'mission_created' | 'mission_new' | 'mission_modified'
  | 'mission_cancelled' | 'mission_completed'
  | 'reminder_today' | 'reminder_tomorrow';

export interface AppNotification {
  id: string;
  userId: string;
  role: string;
  title: string;
  message: string;
  type: NotificationType | string;
  missionId?: string;
  read: boolean;
  createdAt: string;
}

export interface FinancialEntry {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
}

// ── SYNCHRONISATION DES RÉSERVATIONS (conciergeries / partenaires Airbnb) ────────
// Périmètre : appartements Airbnb uniquement. Les hôtels ne sont pas concernés.

// Plateformes de réservation supportées. Toutes exposent un export iCal par
// logement ; les API natives pourront être branchées par plateforme plus tard.
export type ReservationPlatform =
  | 'airbnb' | 'booking' | 'guesty' | 'hostaway' | 'lodgify'
  | 'smoobu' | 'beds24' | 'amenitiz' | 'ical' | 'other';

// État d'une réservation importée (domaine distinct des statuts de mission).
export type ReservationStatus = 'confirmed' | 'cancelled' | 'tentative' | 'blocked';

// Un flux = un calendrier iCal rattaché à un appartement (un appart peut en avoir
// plusieurs : Airbnb + Booking sur la même annonce).
export interface ReservationFeed {
  id: string;
  airbnbId: string;
  apartmentName?: string;     // dérivé du join (lecture seule)
  partnerId?: string;
  platform: ReservationPlatform;
  icalUrl: string;
  label?: string;
  active: boolean;
  lastSyncAt?: string;
  lastSyncStatus?: 'ok' | 'error';
  lastError?: string;
  createdAt?: string;
}

export interface Reservation {
  id: string;
  feedId?: string;
  airbnbId: string;
  apartmentName?: string;     // dérivé du join (lecture seule)
  partnerId?: string;
  platform: ReservationPlatform;
  externalUid: string;
  guestName?: string;
  status: ReservationStatus;
  checkIn: string;            // YYYY-MM-DD (arrivée)
  checkOut: string;           // YYYY-MM-DD (départ = jour du ménage)
  checkInTime?: string;       // HH:mm si disponible
  checkOutTime?: string;      // HH:mm si disponible
  missionId?: string;         // mission ménage créée pour ce départ
  missionCreatedAt?: string;
  createdAt?: string;
}

// État d'occupation d'un appartement (vue admin), dérivé des réservations.
export type ApartmentOccupancyState =
  | 'occupied'        // un voyageur est actuellement présent
  | 'leaving_soon'    // départ dans les prochains jours
  | 'needs_cleaning'  // départ détecté, ménage à prévoir (pas encore de mission)
  | 'mission_created' // départ détecté et mission déjà créée
  | 'free';           // ni occupé ni départ imminent
