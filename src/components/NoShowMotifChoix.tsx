'use client';

import { NO_SHOW_MOTIFS, type NoShowMotif } from '@/lib/noShow';

// Motif d'un ménage non réalisé : le voyageur n'est jamais venu, ou il est
// encore dans le logement (prolongation). Partagé par l'app cleaner et l'admin.
export default function NoShowMotifChoix({ valeur, onChange }: {
  valeur: NoShowMotif; onChange: (m: NoShowMotif) => void;
}) {
  return (
    <div className="grid gap-1.5" role="radiogroup" aria-label="Motif">
      {NO_SHOW_MOTIFS.map(m => {
        const choisi = valeur === m.key;
        return (
          <button key={m.key} type="button" role="radio" aria-checked={choisi} onClick={() => onChange(m.key)}
            className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium border transition-colors"
            style={choisi
              ? { borderColor: '#8A6BB0', backgroundColor: '#8A6BB012', color: '#5E4585' }
              : { borderColor: '#E8E4DC', backgroundColor: '#FFFFFF', color: '#7A7068' }}>
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
