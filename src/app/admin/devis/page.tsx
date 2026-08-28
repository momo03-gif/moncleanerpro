'use client';

import { useState, useEffect } from 'react';
import type { CompanyInfo } from '@/lib/types';
import DevisPanel from './DevisPanel';
import Loading from '@/components/Loading';

// ══════════════════════════════════════════════════════════════════════════════
//  Écran DEVIS — séparé de la facturation.
//  Un devis a son propre cycle : une demande arrive, on la chiffre, on l'envoie,
//  on la corrige, le client accepte — et seulement ensuite ça devient une facture.
//  Tant que les deux partageaient un écran, les demandes entrantes se perdaient
//  derrière des onglets de facturation.
// ══════════════════════════════════════════════════════════════════════════════

// Perf : couche données importée en différé → supabase hors du chemin critique.
const loadDb = () => import('@/lib/db');

export default function DevisPage() {
  const [company, setCompany] = useState<CompanyInfo>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { getCompanyInfoDB } = await loadDb();
      setCompany(await getCompanyInfoDB());
      setLoading(false);
    })();
  }, []);

  if (loading) return <Loading className="p-6 text-sm" />;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="print-hidden mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Devis</h1>
        <p className="text-sm mt-1" style={{ color: '#A8A09A' }}>
          Demandes reçues, devis envoyés et corrections — les demandes de devis arrivent ici, plus dans la cloche.
        </p>
      </div>
      <DevisPanel company={company} />
    </div>
  );
}
