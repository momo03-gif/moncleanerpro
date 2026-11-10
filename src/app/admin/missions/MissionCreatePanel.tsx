'use client';

// Onglet « Créer » de l'écran admin Missions. On choisit d'abord QUOI créer,
// sur une rangée de cartes ; le formulaire qui suit ne redemande pas la
// prestation. « Préparer une journée » vient en premier : c'est l'usage
// quotidien (les ménages du lendemain, préparés la veille au soir). Chaque
// formulaire vit dans son fichier (./creation/) et reste MONTÉ (masqué) :
// passer d'une carte à l'autre ne perd pas une saisie en cours.

import { useState } from 'react';
import type { Mission, MissionService } from '@/lib/types';
import Icon, { type IconName } from '@/components/Icon';
import type { ProprietesCreation } from './creation/commun';
import CreationJournee from './creation/CreationJournee';
import CreationMission from './creation/CreationMission';
import CreationRecurrente from './creation/CreationRecurrente';
import CreationPonctuelle from './creation/CreationPonctuelle';
import CreationRendezVous from './creation/CreationRendezVous';

type Choix = 'journee' | 'menage' | 'livraison' | 'intervention' | 'course' | 'recurrente' | 'plusieurs' | 'rdv';

const CARTES: { id: Choix; titre: string; detail: string; icone: IconName }[] = [
  { id: 'journee', titre: 'Préparer une journée', detail: 'Les ménages d’un jour, en une fois', icone: 'today' },
  { id: 'menage', titre: 'Ménage', detail: 'Un logement, une date', icone: 'missions' },
  { id: 'livraison', titre: 'Livraison', detail: 'Linge ou matériel à déposer', icone: 'delivery' },
  { id: 'intervention', titre: 'Intervention', detail: 'Réparation par un artisan', icone: 'wrench' },
  { id: 'course', titre: 'Course ou achat', detail: 'Acheter, faire doubler une clé…', icone: 'wallet' },
  { id: 'recurrente', titre: 'Ménage récurrent', detail: 'Chaque semaine, mêmes jours', icone: 'calendar' },
  { id: 'plusieurs', titre: 'Gros ménage à plusieurs', detail: 'Une intervention, plusieurs cleaners', icone: 'cleaners' },
  { id: 'rdv', titre: 'Rendez-vous', detail: 'Visite, état des lieux, réunion', icone: 'clock' },
];

const SERVICE: Partial<Record<Choix, MissionService>> = {
  menage: 'cleaning', livraison: 'delivery', intervention: 'repair', course: 'errand',
};

export default function MissionCreatePanel(props: ProprietesCreation & { missions: Mission[] }) {
  const [choix, setChoix] = useState<Choix>('journee');

  return (
    <div>
      <p className="text-sm font-semibold mb-3" style={{ color: '#1A1A1A' }}>Que voulez-vous créer ?</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
        {CARTES.map(c => {
          const actif = choix === c.id;
          return (
            <button key={c.id} type="button" onClick={() => setChoix(c.id)}
              className="text-left rounded-2xl border p-3 transition-all"
              style={{
                borderColor: actif ? '#C9A84C' : '#E8E4DC',
                backgroundColor: actif ? '#1A1A1A' : '#FFFFFF',
                boxShadow: actif ? '0 4px 14px rgba(0,0,0,0.10)' : 'none',
              }}>
              <span style={{ color: actif ? '#C9A84C' : '#9A7B22' }}><Icon name={c.icone} size={18} /></span>
              <p className="text-sm font-semibold mt-1.5" style={{ color: actif ? '#FFFFFF' : '#1A1A1A' }}>{c.titre}</p>
              <p className="text-[11px] mt-0.5 leading-snug" style={{ color: actif ? '#B5ADA3' : '#A8A09A' }}>{c.detail}</p>
            </button>
          );
        })}
      </div>

      <div hidden={choix !== 'journee'}>
        <CreationJournee cleaners={props.cleaners} airbnbs={props.airbnbs} missions={props.missions}
          onReload={props.onReload} onGoToMissions={props.onGoToMissions} />
      </div>
      {(['menage', 'livraison', 'intervention', 'course'] as Choix[]).map(c => (
        <div key={c} hidden={choix !== c}><CreationMission {...props} service={SERVICE[c]} /></div>
      ))}
      <div hidden={choix !== 'recurrente'}><CreationRecurrente {...props} /></div>
      <div hidden={choix !== 'plusieurs'}><CreationPonctuelle {...props} /></div>
      <div hidden={choix !== 'rdv'}><CreationRendezVous {...props} /></div>
    </div>
  );
}
