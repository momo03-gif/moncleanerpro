// Fréquence souhaitée, demandée dans les formulaires de devis du site.
// Raison d'être : savoir dès la lecture de la demande si le client cherche un
// passage unique ou un contrat récurrent, celui que l'on veut traiter en premier.
export const FREQUENCES = [
  'Une seule fois',
  'Entre chaque voyageur (location courte durée)',
  'Plusieurs fois par semaine',
  'Chaque semaine',
  'Toutes les deux semaines',
  'Chaque mois',
  'Je ne sais pas encore',
] as const;

/** Une fréquence choisie qui annonce un client régulier. */
export function estRecurrent(f: string): boolean {
  return !!f && f !== 'Une seule fois' && f !== 'Je ne sais pas encore';
}

/** Vérification légère : une faute de frappe dans l'email fait perdre la demande. */
export function emailPlausible(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(e.trim());
}
