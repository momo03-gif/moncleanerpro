'use client';

// Planning multi-logements : une ligne par logement, une colonne par jour,
// chaque séjour en barre de l'arrivée (milieu de journée) au départ (milieu de
// journée) — deux séjours qui s'enchaînent se touchent sans se chevaucher.
// Sous chaque départ, l'état du ménage : on repère d'un coup d'œil un trou.

import { useMemo } from 'react';
import type { Reservation } from '@/lib/types';
import { ajouterJours } from '@/lib/dateParis';
import { daysBetween } from './commun';

const COL = 64;          // largeur d'une journée (px)
const LIGNE = 44;        // hauteur d'une ligne (px)
const NOMS = 190;        // colonne des logements (px)

const COULEUR: Record<string, { fond: string; texte: string; bord: string }> = {
  confirmed: { fond: '#1A1A1A', texte: '#FFFFFF', bord: '#1A1A1A' },
  tentative: { fond: '#FFF7E8', texte: '#9A6A16', bord: '#C48A2A' },
  blocked:   { fond: '#EEECE8', texte: '#6B7280', bord: '#D6D1C8' },
};

export default function VuePlanning({ reservations, aujourdhui, jours, onChoisirJour }: {
  reservations: Reservation[];
  aujourdhui: string;
  jours: number;
  onChoisirJour: (jour: string) => void;
}) {
  const colonnes = Array.from({ length: jours }, (_, i) => ajouterJours(aujourdhui, i));
  const fin = colonnes[colonnes.length - 1];

  // Les logements qui ont au moins un séjour visible dans la fenêtre.
  const lignes = useMemo(() => {
    const parLogement = new Map<string, { nom: string; sejours: Reservation[] }>();
    for (const r of reservations) {
      if (r.status === 'cancelled') continue;
      if (r.checkOut < aujourdhui || r.checkIn > fin) continue;
      const l = parLogement.get(r.airbnbId) ?? { nom: r.apartmentName ?? '—', sejours: [] };
      l.sejours.push(r);
      parLogement.set(r.airbnbId, l);
    }
    return [...parLogement.entries()]
      .map(([id, l]) => ({ id, ...l }))
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  }, [reservations, aujourdhui, fin]);

  if (lignes.length === 0) {
    return <p className="text-sm text-center py-10" style={{ color: '#A8A09A' }}>Aucun séjour sur cette période.</p>;
  }

  const largeur = NOMS + jours * COL;

  return (
    <div className="rounded-2xl border overflow-x-auto" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
      <div style={{ width: largeur }}>
        {/* En-tête des jours */}
        <div className="flex sticky top-0 z-10 border-b" style={{ borderColor: '#E8E4DC', backgroundColor: '#FAFAF8' }}>
          <div className="shrink-0 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider sticky left-0 z-20"
            style={{ width: NOMS, color: '#A8A09A', backgroundColor: '#FAFAF8' }}>
            {lignes.length} logement{lignes.length > 1 ? 's' : ''}
          </div>
          {colonnes.map(j => {
            const d = new Date(j + 'T00:00:00');
            const auj = j === aujourdhui;
            const weekEnd = d.getDay() === 0 || d.getDay() === 6;
            return (
              <button key={j} onClick={() => onChoisirJour(j)} title="Voir les mouvements de ce jour"
                className="shrink-0 py-1.5 text-center border-l hover:bg-white transition-colors"
                style={{ width: COL, borderColor: '#F2EFE9', backgroundColor: weekEnd ? '#F5F3EF' : undefined }}>
                <p className="text-[10px] uppercase" style={{ color: auj ? '#C9A84C' : '#A8A09A' }}>
                  {d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '')}
                </p>
                <p className="text-sm font-bold" style={{ color: auj ? '#C9A84C' : '#1A1A1A' }}>{d.getDate()}</p>
              </button>
            );
          })}
        </div>

        {lignes.map(l => (
          <div key={l.id} className="flex border-b last:border-0 relative" style={{ borderColor: '#F2EFE9', height: LIGNE }}>
            <div className="shrink-0 px-3 flex items-center sticky left-0 z-10 border-r"
              style={{ width: NOMS, backgroundColor: '#FFFFFF', borderColor: '#F2EFE9' }}>
              <span className="text-xs font-medium truncate" style={{ color: '#1A1A1A' }} title={l.nom}>{l.nom}</span>
            </div>
            <div className="relative" style={{ width: jours * COL }}>
              {/* Quadrillage des jours */}
              <div className="absolute inset-0 flex pointer-events-none">
                {colonnes.map(j => {
                  const we = [0, 6].includes(new Date(j + 'T00:00:00').getDay());
                  return <div key={j} className="border-l h-full" style={{ width: COL, borderColor: '#F5F3EF', backgroundColor: we ? '#FBFAF7' : undefined }} />;
                })}
              </div>
              {l.sejours.map(r => {
                const debut = Math.max(daysBetween(aujourdhui, r.checkIn) + 0.5, 0);
                const finS = Math.min(daysBetween(aujourdhui, r.checkOut) + 0.5, jours);
                if (finS <= debut) return null;
                const c = COULEUR[r.status] ?? COULEUR.confirmed;
                const coupeGauche = r.checkIn < aujourdhui;
                const w = (finS - debut) * COL - 3;
                return (
                  <div key={r.id}
                    title={`${l.nom} · ${r.checkIn} → ${r.checkOut}${r.guestsCount ? ` · ${r.guestsCount} voyageur(s)` : ''}`}
                    className="absolute top-1/2 -translate-y-1/2 h-7 flex items-center px-2 text-[11px] font-semibold overflow-hidden whitespace-nowrap"
                    style={{
                      left: debut * COL + 1.5, width: w,
                      backgroundColor: c.fond, color: c.texte, border: `1px solid ${c.bord}`,
                      borderRadius: coupeGauche ? '0 8px 8px 0' : 8,
                    }}>
                    {w > 40 && (r.guestsCount ? `${r.guestsCount} voy.` : r.status === 'blocked' ? 'bloqué' : '')}
                  </div>
                );
              })}
              {/* État du ménage, sous chaque départ visible */}
              {l.sejours.filter(r => r.checkOut >= aujourdhui && r.checkOut <= fin).map(r => {
                const x = (daysBetween(aujourdhui, r.checkOut) + 0.5) * COL;
                const ok = !!r.missionId;
                const manque = !ok && r.status === 'confirmed';
                if (!ok && !manque) return null;
                return (
                  <span key={`m-${r.id}`} className="absolute w-2.5 h-2.5 rounded-full border-2 border-white"
                    title={ok ? 'Ménage créé' : 'Ménage manquant'}
                    style={{ left: x - 5, bottom: 3, backgroundColor: ok ? '#5A8A6A' : '#B85A50' }} />
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 border-t text-[11px]" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>
        <span className="inline-flex items-center gap-1.5"><span className="w-4 h-2.5 rounded" style={{ backgroundColor: '#1A1A1A' }} /> Séjour confirmé</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-4 h-2.5 rounded border" style={{ backgroundColor: '#FFF7E8', borderColor: '#C48A2A' }} /> À confirmer</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-4 h-2.5 rounded border" style={{ backgroundColor: '#EEECE8', borderColor: '#D6D1C8' }} /> Date bloquée</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#5A8A6A' }} /> Ménage créé</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#B85A50' }} /> Ménage manquant</span>
        <span className="ml-auto" style={{ color: '#A8A09A' }}>Cliquez sur un jour pour voir ses départs et arrivées.</span>
      </div>
    </div>
  );
}
