'use client';

// Onglet « Créer » de l'écran admin Missions. Cinq modes de création, chacun
// dans son fichier (./creation/) avec son propre état ; ce panneau ne fait que
// les onglets. Les modes restent MONTÉS (masqués) : passer de l'un à l'autre ne
// perd pas une saisie en cours. Seuls deux signaux remontent au parent :
// onReload (rafraîchir) et onGoToMissions (onglet Missions après une création).

import { useState } from 'react';
import type { ProprietesCreation } from './creation/commun';
import CreationMission from './creation/CreationMission';
import CreationGroupee from './creation/CreationGroupee';
import CreationRecurrente from './creation/CreationRecurrente';
import CreationPonctuelle from './creation/CreationPonctuelle';
import CreationRendezVous from './creation/CreationRendezVous';

type Mode = 'single' | 'batch' | 'appointment' | 'oneshot' | 'recurring';

export default function MissionCreatePanel(props: ProprietesCreation) {
  const [createMode, setCreateMode] = useState<Mode>('single');

  return (
    <div>
      {/* Mode de création — responsive : passe à la ligne sur petit écran. */}
      <div className="flex flex-wrap gap-1 mb-5 p-1 rounded-2xl" style={{ backgroundColor: '#F5F3EF' }}>
        {([['single', 'Une mission'], ['batch', 'Plusieurs appartements'], ['recurring', 'Récurrente'], ['oneshot', 'Intervention ponctuelle'], ['appointment', 'Rendez-vous']] as const).map(([m, label]) => (
          <button key={m} type="button" onClick={() => setCreateMode(m)}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{ backgroundColor: createMode === m ? '#FFFFFF' : 'transparent', color: createMode === m ? '#1A1A1A' : '#A8A09A', boxShadow: createMode === m ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
            {label}
          </button>
        ))}
      </div>

      <div hidden={createMode !== 'single'}><CreationMission {...props} /></div>
      <div hidden={createMode !== 'batch'}><CreationGroupee {...props} /></div>
      <div hidden={createMode !== 'appointment'}><CreationRendezVous {...props} /></div>
      <div hidden={createMode !== 'oneshot'}><CreationPonctuelle {...props} /></div>
      <div hidden={createMode !== 'recurring'}><CreationRecurrente {...props} /></div>
    </div>
  );
}
