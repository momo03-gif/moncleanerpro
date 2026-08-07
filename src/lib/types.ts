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

export type MissionStatus = 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
export type MissionType = 'checkout' | 'checkin' | 'deep_clean' | 'regular';
export type MissionSource = 'hotel' | 'airbnb';

// Prestation portée par la mission. Le nettoyage est le défaut historique ;
// la livraison s'ajoute sans système séparé. Orthogonal à MissionType.
// 'appointment' = rendez-vous (entretien client, etc.) : ni ménage ni livraison,
// donc ni facturé ni payé (serviceParts renvoie les deux à false).
export type MissionService = 'cleaning' | 'delivery' | 'cleaning_delivery' | 'appointment';

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
  // Maison louée à la chambre : QUOI faire précisément ce jour-là.
  // `coveredUnits` liste les chambres concernées (« Fleurie + Saint-Amour + communs »),
  // `wholeProperty` indique que la maison entière est à faire — soit l'annonce
  // entière était louée, soit toutes les chambres se libèrent le même jour.
  coveredUnits?: string;
  wholeProperty?: boolean;
  // Zone de l'appartement lié (dérivée du join, lecture seule).
  zoneId?: string;
  zoneColor?: string;
  zoneName?: string;
  // Vidéo d'accès du logement (dérivée du site lié, lecture seule). Aide le cleaner
  // à s'y rendre / trouver la clé. Chargée à la demande (aucun téléchargement auto).
  accessVideoUrl?: string;
  // Type du site lié (dérivé du join) — pilote le badge d'origine affiché.
  siteType?: StructureType;
  siteLabel?: string;
  type: MissionType;
  // Prestation : nettoyage (défaut), livraison, les deux, ou rendez-vous.
  service?: MissionService;
  // Consignes de livraison (quoi livrer / où déposer) — affichées au cleaner.
  deliveryInstructions?: string;
  // Intervention ponctuelle multi-cleaners : les lignes d'un même group_id sont
  // une seule intervention (un cleaner par ligne). Voir createOneShotMissionDB.
  groupId?: string;
  // Planning récurrent ayant généré cette mission (dédoublonnage). Voir recurring.ts.
  recurringId?: string;
  // Assigné non-cleaner (ex. administrateur) — pour les rendez-vous. Quand l'assigné
  // est un cleaner, on utilise cleanerId/cleanerName (mission visible dans son planning).
  assigneeUserId?: string;
  assigneeName?: string;
  assigneeRole?: string;
  source?: MissionSource;
  // Créateur de la mission (users.id). Pour une mission hôtel/EHPAD = user_id du
  // compte hôtelier → permet de classer le client (hôtel vs EHPAD).
  createdBy?: string;
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

// ── Rapport d'état du logement (rempli par le cleaner en fin de mission) ─────────
// Visible par l'admin et le partenaire (hôte). Sert à signaler ce qui doit être
// réapprovisionné, un dégât/maintenance, ou un objet oublié par le client.
export interface MissionReport {
  missionId: string;
  consumables: string[];      // items à réapprovisionner (liste fermée)
  consumablesNote?: string;   // précision libre (ex. « plus de pastilles lave-vaisselle »)
  issues?: string;            // problème / dégât / maintenance constaté
  lostFound?: string;         // objet oublié par le client
  note?: string;              // remarque générale
  submittedBy?: string;
  updatedAt?: string;
}

// ── Réparation rattachée à un site (appartement) ────────────────────────────────
// Créée depuis un dégât constaté (cleaner en fin de mission, ou admin). Elle vit
// sur l'APPARTEMENT, pas sur la mission : elle reste ouverte tant que le
// propriétaire (ou l'admin) ne l'a pas marquée réparée.
export type RepairStatus = 'open' | 'done';

export interface Repair {
  id: string;
  airbnbId: string;
  partnerId?: string;
  missionId?: string;        // mission d'origine (trace), sa clôture ne ferme pas la réparation
  description: string;
  status: RepairStatus;
  createdBy?: string;
  createdRole?: 'cleaner' | 'admin' | 'airbnb';
  resolvedBy?: string;
  resolvedNote?: string;
  resolvedAt?: string;
  createdAt?: string;
  // Jusqu'à 2 photos de l'incident (URLs Storage).
  photos?: string[];
  // Dénormalisé depuis le site joint (affichage).
  propertyName?: string;
  propertyAddress?: string;
}

// Consommables proposés en cases à cocher (liste fermée, ordre stable).
export const CONSUMABLE_ITEMS = [
  'Papier toilette', 'Essuie-tout', 'Savon / gel douche', 'Liquide vaisselle',
  'Pastilles lave-vaisselle', 'Sacs poubelle', 'Éponges', 'Café / thé', 'Ampoule',
] as const;

// État d'une demande de temps supplémentaire faite par le cleaner.
export type ExtraTimeStatus = 'pending' | 'approved' | 'refused';

export type AnnounceStatus = 'pending' | 'validated' | 'refused' | 'in_progress' | 'completed' | 'cancelled';
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

// Type de site nettoyé. Appartement = défaut historique (logement Airbnb/hôtel).
// Les autres (bureau, salle de sport…) sont des sites facturables SANS synchro de
// réservations ni partenaire obligatoire, créés comme un appartement.
export type StructureType = 'apartment' | 'office' | 'gym' | 'other';

export interface Apartment {
  id: string;
  name: string;
  address: string;
  // Type de structure (défaut : appartement). Voir StructureType.
  structureType?: StructureType;
  structureLabel?: string;   // libellé libre quand structureType = 'other'
  // Override du coût produits par ménage (centimes). Absent → coût global ProfitConfig.
  productCostCents?: number;
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
  // Vidéo d'accès (facultative) : comment s'y rendre / trouver la clé / entrer.
  // Fichier dans Storage ; ici on ne garde que l'URL publique + le chemin.
  accessVideoUrl?: string;
  accessVideoPath?: string;
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

// ── Paiement de stationnement (module Livraison) ─────────────────────────────────
// Payé par un livreur pendant une mission de livraison. Saisie manuelle aujourd'hui
// (provider 'manual') ; prêt à brancher une API (ex. PayByPhone) plus tard.
export type ParkingStatus = 'pending' | 'paid' | 'failed' | 'cancelled';
export type ParkingProviderId = 'manual' | 'paybyphone';

export interface ParkingPayment {
  id: string;
  missionId?: string;
  cleanerId?: string;
  cleanerName?: string;
  address: string;
  latitude?: number;
  longitude?: number;
  amount?: number;
  currency: string;
  durationMinutes?: number;
  status: ParkingStatus;
  provider: ParkingProviderId | string;
  providerRef?: string;
  paidAt: string;
  createdAt: string;
  // Enrichi via le join mission (lecture seule, vue admin).
  property?: string;
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
  // Type de contrat : 'auto' (auto-entrepreneur, défaut) ou 'cdi' (charges patronales en sus).
  employment_type?: 'auto' | 'cdi';
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

// ── Intervention récurrente (ménage programmé à jours fixes) ─────────────────────
// Décrit un ménage hebdomadaire répété ; les missions réelles sont matérialisées
// automatiquement (cron) sur un horizon glissant. weekdays : 0=dimanche … 6=samedi.
export interface RecurringMission {
  id: string;
  airbnbId?: string;
  propertyName?: string;
  address?: string;
  cleanerId?: string;
  cleanerName?: string;
  service: string;
  weekdays: number[];
  timeFrom?: string;
  durationMinutes: number;
  price: number;
  startDate: string;
  endDate?: string;
  active: boolean;
  lastGeneratedDate?: string;
  createdAt?: string;
}

// Paramètres globaux de rentabilité (ligne unique profit_config). Tous éditables.
export interface ProfitConfig {
  productCostCents: number;   // coût produits moyen par ménage (centimes)
  marginTarget: number;       // marge cible (0.30 = 30 %)
  fuelBaseAddress?: string;
  fuelBaseLat?: number;
  fuelBaseLng?: number;
  fuelConsumption: number;    // L / 100 km
  fuelPrice: number;          // € / L
  fuelRouteFactor: number;    // distance route ≈ vol d'oiseau × facteur
  cdiChargeRate: number;      // charges patronales sur un CDI (0.45 = +45 %)
  vatRate: number;            // TVA pour le calcul TTC (0.20 = 20 %)
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
