// ── Numéros de téléphone (logique PURE, sans I/O) ─────────────────────────────
// WhatsApp exige un numéro au format international sans « + » ni séparateur
// (33612345678). Les gens saisissent « 06 12 34 56 78 », « +33 6 12 34 56 78 »
// ou « 0033612345678 » : on accepte tout et on normalise.

/**
 * Normalise un numéro français ou international vers le format attendu par
 * WhatsApp (chiffres seuls, indicatif pays inclus). Renvoie null si le numéro
 * est inexploitable — mieux vaut ne rien envoyer qu'envoyer à un inconnu.
 * `defaultCountry` sert aux numéros nationaux commençant par 0 (France : 33).
 */
export function normalizePhone(raw: string | null | undefined, defaultCountry = '33'): string | null {
  if (!raw) return null;

  const trimmed = raw.trim();
  // « 00 » en tête = préfixe international à l'ancienne → équivaut à « + ».
  const hasPlus = trimmed.startsWith('+') || trimmed.startsWith('00');
  const digits = trimmed.replace(/\D/g, '').replace(/^00/, '');
  if (digits.length < 8) return null;

  // Déjà international (saisi avec + ou 00, ou commençant par l'indicatif).
  if (hasPlus) return digits.length <= 15 ? digits : null;

  // Numéro national français : 0X XX XX XX XX → 33X XX XX XX XX.
  if (digits.startsWith('0') && digits.length === 10) return defaultCountry + digits.slice(1);

  // Numéro déjà préfixé de son indicatif, saisi sans « + ».
  if (digits.startsWith(defaultCountry) && digits.length === defaultCountry.length + 9) return digits;

  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

/** Affichage lisible d'un numéro normalisé : « +33 6 12 34 56 78 ». */
export function formatPhone(normalized: string | null | undefined): string {
  if (!normalized) return '';
  if (normalized.startsWith('33') && normalized.length === 11) {
    const n = normalized.slice(2);
    return `+33 ${n[0]} ${n.slice(1, 3)} ${n.slice(3, 5)} ${n.slice(5, 7)} ${n.slice(7, 9)}`;
  }
  return `+${normalized}`;
}
