'use client';

import { useState, useEffect } from 'react';
import { appelPrestataire } from '@/lib/prestataireApi';
import { money } from '@/lib/format';
import ReleveMois from '@/components/ReleveMois';

// Espace prestataire — ce que MonCleanerPro lui doit, mois par mois.
export default function PrestataireRelevePage() {
  const [taux, setTaux] = useState<number | null>(null);

  useEffect(() => {
    let actif = true;
    (async () => {
      const r = await appelPrestataire<{ prestataire: { hourlyRate: number } }>('me');
      if (actif && r.ok) setTaux(r.prestataire.hourlyRate);
    })();
    return () => { actif = false; };
  }, []);

  return (
    <div className="p-5">
      <div className="mb-5 pt-2">
        <h1 className="text-xl font-bold" style={{ color: '#1A1A1A' }}>Relevé</h1>
        <p className="text-sm mt-1" style={{ color: '#A8A09A' }}>
          Missions terminées et montant dû{taux != null ? ` · taux actuel ${money(taux)}/h` : ''}.
        </p>
      </div>
      <ReleveMois />
    </div>
  );
}
