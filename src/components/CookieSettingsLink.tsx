'use client';

// Lien de pied de page « Gérer les cookies » : rouvre le bandeau de
// consentement pour changer d'avis à tout moment (CNIL). Invisible tant que
// la balise Google Ads n'est pas configurée — il n'y aurait rien à gérer.

import { ADS_ID, openConsent } from '@/lib/adsTracking';

export default function CookieSettingsLink({ className }: { className?: string }) {
  if (!ADS_ID) return null;
  return (
    <button type="button" onClick={openConsent} className={className}>
      Gérer les cookies
    </button>
  );
}
