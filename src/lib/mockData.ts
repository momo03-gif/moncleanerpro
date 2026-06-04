// Utility only — all data is now served from Supabase via src/lib/db.ts
// This file kept solely for the currentMonth() helper used by several pages.

export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// Legacy exports retained to avoid breaking any residual imports
export const USERS: any[] = [];
export const MISSIONS: any[] = [];
export const APARTMENTS: any[] = [];
export const HOTEL_ANNOUNCES: any[] = [];
export const FINANCIAL: any[] = [];

export function getMissions() { return []; }
export function getUsers() { return []; }
export function getPayments() { return []; }
export function getMissionsForCleaner() { return []; }
export function getProposedMissions() { return []; }
export function getActiveCleaners() { return []; }
export function getAnnouncesForHotel() { return []; }
export function addMission() {}
export function addPayment() {}
export function addUser() {}
export function setUserActive() {}
export function updateUserRates() {}
export function updateUserPassword() {}
export function approveHotel() {}
export function refuseHotel() {}
export function registerHotel() {}
export function getPendingHotels() { return []; }
export function findUser() { return null; }
