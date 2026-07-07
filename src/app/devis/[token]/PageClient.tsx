'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getDevisByTokenDB, setDevisStatusByTokenDB, type Devis } from '@/lib/devis';
import Loading from "@/components/Loading";

function money(n: number) { return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'; }

// Page PUBLIQUE (lien unique) — le client consulte son devis et l'accepte/refuse.
export default function PublicDevisPage() {
  const params = useParams();
  const token = String(params?.token ?? '');
  const [devis, setDevis] = useState<Devis | null>(null);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState<'accepte' | 'refuse' | null>(null);

  useEffect(() => {
    getDevisByTokenDB(token).then(d => { setDevis(d); setDone(d?.status === 'accepte' ? 'accepte' : d?.status === 'refuse' ? 'refuse' : null); setLoading(false); });
  }, [token]);

  async function decide(accept: boolean) {
    await setDevisStatusByTokenDB(token, accept ? 'accepte' : 'refuse');
    setDone(accept ? 'accepte' : 'refuse');
  }

  if (loading) return <Loading className="min-h-screen flex items-center justify-center text-sm" />;
  if (!devis) return <div className="min-h-screen flex items-center justify-center text-sm" style={{ color: '#A8A09A' }}>Devis introuvable.</div>;

  return (
    <div className="min-h-screen py-10 px-5" style={{ backgroundColor: '#FAFAF8' }}>
      <div className="max-w-lg mx-auto rounded-2xl border overflow-hidden" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
        <div className="px-6 py-5 border-b" style={{ borderColor: '#F2EFE9' }}>
          <img src="/logo-full.png" alt="MonCleanerPro" style={{ height: 52, width: 'auto', marginBottom: 14 }} />
          <p className="text-xs uppercase tracking-wider" style={{ color: '#C9A84C' }}>Devis {devis.number}</p>
          <h1 className="text-xl font-bold mt-1" style={{ color: '#1A1A1A' }}>{devis.clientName || 'Votre devis'}</h1>
          {devis.validUntil && <p className="text-xs mt-1" style={{ color: '#A8A09A' }}>Valable jusqu’au {new Date(devis.validUntil).toLocaleDateString('fr-FR')}</p>}
        </div>
        <div className="px-6 py-4 space-y-2">
          {devis.lines.map((l, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-sm" style={{ color: '#7A7068' }}>{l.nom} {l.quantite > 1 ? `× ${l.quantite}` : ''}</span>
              <span className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{money(l.total)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between pt-3 border-t mt-2" style={{ borderColor: '#F2EFE9' }}>
            <span className="text-sm font-bold" style={{ color: '#1A1A1A' }}>Total</span>
            <span className="text-lg font-bold" style={{ color: '#C9A84C' }}>{money(devis.total)}</span>
          </div>
        </div>
        <div className="px-6 pb-6">
          {done === 'accepte' ? (
            <div className="rounded-xl px-4 py-3 text-sm font-medium text-center" style={{ backgroundColor: '#EAF3EC', color: '#4E7D5E' }}>Devis accepté — merci ! Nous revenons vers vous.</div>
          ) : done === 'refuse' ? (
            <div className="rounded-xl px-4 py-3 text-sm font-medium text-center" style={{ backgroundColor: '#FBECEA', color: '#B85A50' }}>Devis refusé.</div>
          ) : (
            <div className="flex gap-3">
              <button onClick={() => decide(false)} className="flex-1 py-3 rounded-xl text-sm font-semibold border" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>Refuser</button>
              <button onClick={() => decide(true)} className="flex-1 py-3 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#5A8A6A', color: '#FFFFFF' }}>Accepter</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
