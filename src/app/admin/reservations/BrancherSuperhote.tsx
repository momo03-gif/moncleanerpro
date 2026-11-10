'use client';

// Brancher plusieurs logements SuperHote d'un coup. Une conciergerie a
// quatorze biens chez nous et soixante-quinze dans son logiciel : les
// connecter un par un, c'est quatorze fois le même écran. On liste, on coche,
// on rattache, on branche.

import { useState } from 'react';
import type { Apartment } from '@/lib/types';
import type { PartnerAccount } from '@/lib/db';
import { useFeedback } from '@/contexts/FeedbackContext';
import { inputStyle } from '@/lib/ui';
import { postJson } from './commun';

interface LogementSh { id: string; name: string; prochaine: string | null; inactif: boolean; dejaConnecte: boolean }

export default function BrancherSuperhote({ partenaire, apartments, onFermer, onBranche }: {
  partenaire: PartnerAccount;
  apartments: Apartment[];
  onFermer: () => void;
  onBranche: () => void;
}) {
  const { toast } = useFeedback();
  const [cle, setCle] = useState('');
  const [liste, setListe] = useState<LogementSh[] | null>(null);
  // Par logement SuperHote coché : le logement de CHEZ NOUS auquel le
  // rattacher. Vide = en créer un nouveau. Le rattachement est le cas normal —
  // ces biens sont nettoyés depuis des mois, ils existent déjà.
  const [choix, setChoix] = useState<Record<string, { nom: string; airbnbId: string }>>({});
  const [busy, setBusy] = useState(false);
  const siens = apartments.filter(a => a.partnerId === partenaire.userId);
  const nbChoix = Object.keys(choix).length;

  async function lister() {
    if (!partenaire.userId || !cle.trim()) return;
    setBusy(true);
    try {
      const d = await postJson<{ ok?: boolean; logements?: LogementSh[]; error?: string }>(
        '/api/reservations/superhote-bulk', { action: 'lister', partnerId: partenaire.userId, apiKey: cle.trim() });
      if (d.ok) { setListe(d.logements ?? []); setChoix({}); }
      else toast(d.error ?? 'Lecture impossible.', 'error');
    } catch { toast('Lecture impossible.', 'error'); }
    setBusy(false);
  }

  async function connecter() {
    if (!partenaire.userId || nbChoix === 0) return;
    setBusy(true);
    try {
      const d = await postJson<{ ok?: boolean; connectes?: string[]; rates?: string[]; error?: string }>(
        '/api/reservations/superhote-bulk', {
          action: 'connecter', partnerId: partenaire.userId, apiKey: cle.trim(),
          choix: Object.entries(choix).map(([rentalId, v]) => ({ rentalId, nom: v.nom, airbnbId: v.airbnbId })),
        });
      if (!d.ok) { toast(d.error ?? 'Connexion impossible.', 'error'); setBusy(false); return; }
      const n = (d.connectes ?? []).length;
      const rates = d.rates ?? [];
      toast(`${n} logement${n > 1 ? 's' : ''} connecté${n > 1 ? 's' : ''}.`
        + (rates.length ? ` Non connectés : ${rates.join(' · ')}` : ''), rates.length ? 'error' : 'success');
      onBranche();
    } catch { toast('Connexion impossible.', 'error'); }
    setBusy(false);
  }

  return (
    <div className="rounded-2xl border p-4 mb-6" style={{ backgroundColor: '#FFFFFF', borderColor: '#C9A84C40' }}>
      <p className="text-sm font-semibold mb-1" style={{ color: '#1A1A1A' }}>SuperHote — {partenaire.name}</p>
      <p className="text-xs mb-3" style={{ color: '#A8A09A' }}>
        Collez le jeton API de la conciergerie (SuperHote → Plateformes → API). Sa prochaine période
        occupée est affichée à côté de chaque logement, et ceux qui ne tournent plus sont signalés
        inactifs et repoussés en bas. Rattachez chacun à un logement que vous avez déjà : en créer un
        second dédoublerait le planning.
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input value={cle} onChange={e => setCle(e.target.value)} placeholder="Jeton API (12345|…)"
          className="flex-1 min-w-[220px] px-3 py-2 rounded-xl text-sm border" style={inputStyle} />
        <button disabled={busy || !cle.trim()} onClick={lister}
          className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
          style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
          {busy && !liste ? 'Lecture…' : 'Lister ses logements'}
        </button>
        <button onClick={onFermer}
          className="px-4 py-2 rounded-xl text-sm border" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>Fermer</button>
      </div>

      {liste && (
        <>
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#E8E4DC', maxHeight: 420, overflowY: 'auto' }}>
            {liste.map(l => {
              const coche = choix[l.id] !== undefined;
              return (
                <div key={l.id} className="flex flex-wrap items-center gap-2 px-3 py-2 border-b last:border-0"
                  style={{ borderColor: '#F2EFE9', opacity: l.dejaConnecte ? 0.5 : 1 }}>
                  <input type="checkbox" disabled={l.dejaConnecte} checked={coche}
                    onChange={e => setChoix(c => {
                      const n = { ...c };
                      if (e.target.checked) n[l.id] = { nom: l.name, airbnbId: '' }; else delete n[l.id];
                      return n;
                    })} />
                  <span className="text-xs font-medium min-w-[160px] flex-1" style={{ color: '#1A1A1A' }}>{l.name}</span>
                  <span className="text-[11px] w-48 shrink-0" style={{ color: '#A8A09A' }}>
                    {l.dejaConnecte ? 'déjà connecté'
                      : l.inactif ? 'inactif — aucun séjour sur 4 mois'
                      : l.prochaine ?? 'libre'}
                  </span>
                  {coche && (
                    <>
                      <select value={choix[l.id].airbnbId}
                        onChange={e => setChoix(c => ({ ...c, [l.id]: { ...c[l.id], airbnbId: e.target.value } }))}
                        className="flex-1 min-w-[200px] px-2 py-1 rounded-lg text-xs border" style={inputStyle}>
                        <option value="">— Créer un nouveau logement —</option>
                        {siens.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>
                      {!choix[l.id].airbnbId && (
                        <input value={choix[l.id].nom}
                          onChange={e => setChoix(c => ({ ...c, [l.id]: { ...c[l.id], nom: e.target.value } }))}
                          placeholder="Nom du nouveau logement"
                          className="min-w-[160px] px-2 py-1 rounded-lg text-xs border" style={inputStyle} />
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-3 mt-3">
            <button disabled={busy || nbChoix === 0} onClick={connecter}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
              style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
              {busy ? 'Connexion…' : `Connecter ${nbChoix} logement${nbChoix > 1 ? 's' : ''}`}
            </button>
            <span className="text-[11px]" style={{ color: '#A8A09A' }}>
              Sans logement choisi dans la liste, un nouveau logement est créé.
            </span>
          </div>
        </>
      )}
    </div>
  );
}
