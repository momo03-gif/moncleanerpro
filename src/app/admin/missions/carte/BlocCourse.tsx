'use client';

// Course / achat sur la carte admin : quoi, budget, ticket, qui a payé, et la
// note de frais à rembourser à l'intervenant (cf. lib/course.ts).

import { useState } from 'react';
import { saveErrandTicketDB, setErrandReimbursedDB } from '@/lib/db';
import { COURSE_PAYEURS, libellePayeur, depasseBudget, aRembourser, montantTicket, type CoursePayeur } from '@/lib/course';
import type { Mission } from '@/lib/types';
import { useFeedback } from '@/contexts/FeedbackContext';
import { money } from '@/lib/format';
import { inputStyle } from '@/lib/ui';

export default function BlocCourse({ mission, onRefresh }: { mission: Mission; onRefresh: (missionId: string) => void }) {
  const { toast } = useFeedback();
  const [busy, setBusy] = useState(false);
  // Course : correction du ticket par l'admin (montant, qui a payé).
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticket, setTicket] = useState<{ spent: string; paidBy: CoursePayeur }>({ spent: '', paidBy: 'cleaner' });

  function ouvrirTicket() {
    setTicket({ spent: mission.errandSpent != null ? String(mission.errandSpent) : '', paidBy: mission.errandPaidBy ?? 'cleaner' });
    setTicketOpen(true);
  }

  async function enregistrerTicket() {
    const spent = montantTicket(ticket.spent);
    if (spent == null) { toast('Indiquez le montant du ticket.', 'error'); return; }
    setBusy(true);
    const res = await saveErrandTicketDB(mission.id, { spent, paidBy: ticket.paidBy });
    setBusy(false);
    if (res.error) { toast(res.error, 'error'); return; }
    setTicketOpen(false);
    toast('Ticket enregistré.', 'success');
    onRefresh(mission.id);
  }

  async function basculerRemboursement() {
    const rembourse = !mission.errandReimbursedAt;
    setBusy(true);
    const res = await setErrandReimbursedDB(mission.id, rembourse);
    setBusy(false);
    if (res.error) { toast(res.error, 'error'); return; }
    toast(rembourse ? 'Note de frais marquée remboursée.' : 'Remboursement annulé.', 'success');
    onRefresh(mission.id);
  }

  return (
    <div className="rounded-xl border px-3 py-2.5 space-y-2" style={{ borderColor: '#B07A4A30', backgroundColor: '#B07A4A0A' }}>
      <p className="text-xs font-semibold" style={{ color: '#8A5A2E' }}>Course / achat</p>
      {mission.errandDetails && <p className="text-sm whitespace-pre-wrap" style={{ color: '#4A4540' }}>{mission.errandDetails}</p>}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs" style={{ color: '#7A7068' }}>
        <span>Budget accepté : <b style={{ color: '#1A1A1A' }}>{mission.errandBudget != null ? money(mission.errandBudget) : '—'}</b></span>
        <span>Frais de service : <b style={{ color: '#1A1A1A' }}>{money(mission.price ?? 0)}</b></span>
        <span>Ticket : <b style={{ color: depasseBudget(mission.errandSpent, mission.errandBudget) ? '#B85A50' : '#1A1A1A' }}>
          {mission.errandSpent != null ? money(mission.errandSpent) : 'pas encore'}</b></span>
        <span>Payé : <b style={{ color: '#1A1A1A' }}>{mission.errandPaidBy ? libellePayeur(mission.errandPaidBy) : '—'}</b></span>
      </div>
      {depasseBudget(mission.errandSpent, mission.errandBudget) && (
        <p className="text-[11px] font-semibold" style={{ color: '#B85A50' }}>Le ticket dépasse le budget accepté par le client.</p>
      )}
      {mission.errandPaidBy === 'cleaner' && (mission.errandSpent ?? 0) > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
            style={aRembourser(mission)
              ? { backgroundColor: '#C48A2A15', color: '#C48A2A' }
              : { backgroundColor: '#5A8A6A15', color: '#3F6B4F' }}>
            {aRembourser(mission)
              ? `À rembourser à ${mission.cleanerName ?? 'l’intervenant'} : ${money(mission.errandSpent ?? 0)}`
              : `Remboursé le ${new Date(mission.errandReimbursedAt!).toLocaleDateString('fr-FR')}`}
          </span>
          <button onClick={basculerRemboursement} disabled={busy}
            className="text-[11px] px-2.5 py-1 rounded-lg border disabled:opacity-50" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>
            {aRembourser(mission) ? 'Marquer remboursé' : 'Annuler le remboursement'}
          </button>
        </div>
      )}
      {ticketOpen ? (
        <div className="space-y-2 pt-1">
          <input inputMode="decimal" value={ticket.spent} onChange={e => setTicket(t => ({ ...t, spent: e.target.value }))}
            placeholder="Montant du ticket (€)" className="w-full px-3 py-2 rounded-lg text-sm border" style={inputStyle} />
          <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ backgroundColor: '#F5F3EF' }}>
            {COURSE_PAYEURS.map(pp => (
              <button key={pp.key} type="button" onClick={() => setTicket(t => ({ ...t, paidBy: pp.key }))}
                className="px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ backgroundColor: ticket.paidBy === pp.key ? '#FFFFFF' : 'transparent', color: ticket.paidBy === pp.key ? '#1A1A1A' : '#A8A09A' }}>
                {pp.admin}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={enregistrerTicket} disabled={busy}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>Enregistrer</button>
            <button onClick={() => setTicketOpen(false)} className="px-3 py-1.5 rounded-lg text-xs border" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>Annuler</button>
          </div>
        </div>
      ) : (
        <button onClick={ouvrirTicket} disabled={busy} className="text-[11px] font-medium" style={{ color: '#C9A84C' }}>
          {mission.errandSpent != null ? 'Corriger le ticket' : 'Saisir le ticket'}
        </button>
      )}
    </div>
  );
}
