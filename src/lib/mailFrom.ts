// ── Adresse d'expédition selon la nature du message ───────────────────────────
//
// Tout partait de la même boîte. Un devis et une confirmation de rendez-vous
// n'appellent pourtant pas la même réponse : l'un va vers la facturation,
// l'autre vers l'accueil. Séparer les expéditeurs sépare aussi les réponses.
//
// La boîte réellement authentifiée en SMTP est contact@moncleanerpro.fr ;
// devis@ et info@ en sont des ALIAS, ce qui autorise Hostinger à expédier sous
// ces adresses. Ajouter un nouvel expéditeur suppose donc de créer l'alias
// correspondant chez l'hébergeur, sinon le serveur refusera l'envoi.

export type MailPurpose = 'devis' | 'rendezvous' | 'default';

// Valeurs par défaut : l'application fonctionne sans variable d'environnement
// supplémentaire. Les variables ne servent qu'à changer d'adresse sans toucher
// au code.
const DEFAULTS: Record<MailPurpose, string> = {
  devis: 'devis@moncleanerpro.fr',        // devis et factures
  rendezvous: 'info@moncleanerpro.fr',    // confirmations de rendez-vous
  default: 'info@moncleanerpro.fr',
};

/**
 * Expéditeur à utiliser pour ce type de message.
 * Ordre de préférence : variable dédiée, puis valeur par défaut ci-dessus, puis
 * la boîte authentifiée — pour qu'un envoi parte toujours, même mal adressé.
 */
export function senderFor(purpose: MailPurpose): string {
  const dedicated = purpose === 'devis' ? process.env.SMTP_FROM_DEVIS
    : purpose === 'rendezvous' ? process.env.SMTP_FROM_RDV
    : process.env.SMTP_FROM;
  return dedicated || DEFAULTS[purpose] || process.env.SMTP_USER || DEFAULTS.default;
}

/**
 * Adresse de réponse — la même que l'expéditeur : un client qui répond à une
 * confirmation de rendez-vous doit arriver dans la boîte qui la traite.
 */
export const replyToFor = senderFor;
