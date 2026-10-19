'use client';

import { useState, useEffect } from 'react';
import { appelPrestataire, moisCourant, libelleMois, decalerMois, type Releve } from '@/lib/prestataireApi';
import { formatDuration, formatHour, money } from '@/lib/format';
import Icon from '@/components/Icon';

// Relevé mensuel d'un prestataire : missions TERMINÉES du mois et montant dû
// (son taux × durée, figé quand on lui a confié chaque mission). Partagé par
// l'espace prestataire et la fiche admin (`prestataireId`).
export default function ReleveMois({ prestataireId }: { prestataireId?: string }) {
  const [periode, setPeriode] = useState(moisCourant());
  const [releve, setReleve] = useState<Releve | null>(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    let actif = true;
    (async () => {
      setReleve(null); setErreur('');
      const r = await appelPrestataire<{ releve: Releve }>('releve', { periode, ...(prestataireId ? { id: prestataireId } : {}) });
      if (!actif) return;
      if (r.ok) setReleve(r.releve); else setErreur(r.error);
    })();
    return () => { actif = false; };
  }, [periode, prestataireId]);

  const dernier = periode >= moisCourant();

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setPeriode(p => decalerMois(p, -1))} aria-label="Mois précédent"
          className="w-9 h-9 rounded-xl border flex items-center justify-center" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>
          <span style={{ display: 'inline-flex', transform: 'rotate(180deg)' }}><Icon name="chevronRight" size={16} /></span>
        </button>
        <p className="text-sm font-semibold capitalize" style={{ color: '#1A1A1A' }}>{libelleMois(periode)}</p>
        <button onClick={() => setPeriode(p => decalerMois(p, 1))} disabled={dernier} aria-label="Mois suivant"
          className="w-9 h-9 rounded-xl border flex items-center justify-center disabled:opacity-30" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>
          <Icon name="chevronRight" size={16} />
        </button>
      </div>

      {erreur && <p className="text-sm px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEF2F2', color: '#B85A50' }}>{erreur}</p>}
      {!releve && !erreur && <p className="text-sm text-center py-8" style={{ color: '#A8A09A' }}>Chargement…</p>}

      {releve && (
        <>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              ['Missions', String(releve.missions)],
              ['Temps', formatDuration(releve.minutes)],
              ['Montant', money(releve.montant)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl p-3 text-center" style={{ backgroundColor: '#F8F6F2' }}>
                <p className="text-lg font-bold" style={{ color: k === 'Montant' ? '#C9A84C' : '#1A1A1A' }}>{v}</p>
                <p className="text-xs" style={{ color: '#7A7068' }}>{k}</p>
              </div>
            ))}
          </div>

          {releve.lignes.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: '#A8A09A' }}>Aucune mission terminée ce mois-ci.</p>
          ) : (
            <div className="rounded-2xl border divide-y" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
              {releve.lignes.map(l => (
                <div key={l.id} className="flex items-center justify-between gap-3 px-4 py-3" style={{ borderColor: '#F2EFE9' }}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: '#1A1A1A' }}>{l.lieu}</p>
                    <p className="text-xs" style={{ color: '#A8A09A' }}>
                      {new Date(l.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                      {l.time ? ` · ${formatHour(l.time)}` : ''} · {formatDuration(l.minutes)}{l.agent ? ` · ${l.agent}` : ''}
                    </p>
                  </div>
                  <p className="text-sm font-semibold shrink-0" style={{ color: '#1A1A1A' }}>{money(l.montant)}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
