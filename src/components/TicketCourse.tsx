'use client';

import { useState } from 'react';
import { saveErrandTicketDB } from '@/lib/db';
import { COURSE_PAYEURS, depasseBudget, montantTicket, type CoursePayeur } from '@/lib/course';
import { money } from '@/lib/format';
import type { Mission } from '@/lib/types';

// Course / achat, côté intervenant : le ticket (montant + qui a payé), à
// enregistrer avant de terminer. En ligne uniquement — c'est de l'argent, il ne
// se rejoue pas à l'aveugle plus tard (comme le no show et le parking).
export default function TicketCourse({ mission, onSaved }: { mission: Mission; onSaved: () => void }) {
  const [montant, setMontant] = useState(mission.errandSpent != null ? String(mission.errandSpent) : '');
  const [payeur, setPayeur] = useState<CoursePayeur | null>(mission.errandPaidBy ?? null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const enregistre = mission.errandSpent != null && !!mission.errandPaidBy;
  const saisi = montantTicket(montant);

  async function enregistrer() {
    setErreur('');
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setErreur('L’enregistrement du ticket nécessite une connexion internet.');
      return;
    }
    if (saisi == null || !payeur) { setErreur('Indiquez le montant du ticket et qui a payé.'); return; }
    setEnvoi(true);
    const res = await saveErrandTicketDB(mission.id, { spent: saisi, paidBy: payeur });
    setEnvoi(false);
    if (res.error) { setErreur(res.error); return; }
    onSaved();
  }

  return (
    <div className="rounded-xl p-3 space-y-2.5" style={{ backgroundColor: '#B07A4A0D', border: '1px solid #B07A4A30' }}>
      <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>Ticket de caisse</p>
      <p className="text-[11px] leading-snug" style={{ color: '#7A7068' }}>
        Prenez la photo du ticket (panneau Photos ci-dessus), indiquez le montant et qui a payé, puis enregistrez.
        {mission.errandBudget != null && <> Budget accepté par le client : <b>{money(mission.errandBudget)}</b>.</>}
      </p>
      <input inputMode="decimal" value={montant} onChange={e => setMontant(e.target.value)}
        placeholder="Montant du ticket (€)"
        className="w-full px-3 py-2 rounded-lg text-sm border"
        style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF', color: '#1A1A1A', outline: 'none' }} />
      {depasseBudget(saisi, mission.errandBudget) && (
        <p className="text-[11px] font-semibold" style={{ color: '#B85A50' }}>
          Au-dessus du budget accepté : prévenez l’administration avant de valider.
        </p>
      )}
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Qui a payé">
        {COURSE_PAYEURS.map(p => {
          const choisi = payeur === p.key;
          return (
            <button key={p.key} type="button" role="radio" aria-checked={choisi} onClick={() => setPayeur(p.key)}
              className="px-2 py-2 rounded-lg text-xs font-medium border"
              style={choisi
                ? { borderColor: '#B07A4A', backgroundColor: '#B07A4A14', color: '#8A5A2E' }
                : { borderColor: '#E8E4DC', backgroundColor: '#FFFFFF', color: '#7A7068' }}>
              {p.label}
            </button>
          );
        })}
      </div>
      {erreur && <p className="text-[11px]" style={{ color: '#B85A50' }}>{erreur}</p>}
      <button onClick={enregistrer} disabled={envoi}
        className="w-full py-2.5 rounded-xl text-xs font-semibold disabled:opacity-50"
        style={{ backgroundColor: '#8A5A2E', color: '#FFFFFF' }}>
        {envoi ? '...' : enregistre ? 'Mettre à jour le ticket' : 'Enregistrer le ticket'}
      </button>
      {enregistre && (
        <p className="text-[11px] text-center" style={{ color: '#3F6B4F' }}>
          Ticket enregistré : {money(mission.errandSpent ?? 0)}
          {mission.errandPaidBy === 'cleaner' ? ' — il vous sera remboursé à part de votre paie.' : '.'}
        </p>
      )}
    </div>
  );
}
