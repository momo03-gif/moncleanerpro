'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Mission } from '@/lib/types';
import { money } from '@/lib/format';
import { libelleMois } from '@/lib/prestataireApi';
import { avancesParCleaner, depensesSocieteParMois, depasseBudget, type AvancesCleaner } from '@/lib/course';
import Loading from '@/components/Loading';
import { useFeedback } from '@/contexts/FeedbackContext';

// ════════════════════════════════════════════════════════════════════════════
//  Courses & avances — l'argent des courses / achats (machine à café, double
//  de clé…), en deux circuits qu'on ne mélange jamais :
//   • AVANCES : l'intervenant a payé avec son argent → on lui doit un
//     remboursement (note de frais), à part de sa paie ;
//   • CARTE DE LA SOCIÉTÉ : rien à rembourser, à pointer avec le relevé.
//  Dans les deux cas, le client rembourse les achats au réel sur sa facture.
// ════════════════════════════════════════════════════════════════════════════

const chargerDb = () => import('@/lib/db');
const dateCourte = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });

export default function CoursesPage() {
  const { toast, confirm } = useFeedback();
  const [courses, setCourses] = useState<Mission[] | null>(null);
  const [onglet, setOnglet] = useState<'avances' | 'societe'>('avances');
  const [voirRemboursees, setVoirRemboursees] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  const charger = useCallback(async () => {
    const { getErrandMissionsDB } = await chargerDb();
    setCourses(await getErrandMissionsDB());
  }, []);
  useEffect(() => {
    let vivant = true;
    (async () => {
      const { getErrandMissionsDB } = await chargerDb();
      const lues = await getErrandMissionsDB();
      if (vivant) setCourses(lues);
    })();
    return () => { vivant = false; };
  }, []);

  const avances = useMemo(() => avancesParCleaner(courses ?? []), [courses]);
  const societe = useMemo(() => depensesSocieteParMois(courses ?? []), [courses]);
  const totalDu = avances.reduce((s, g) => s + g.aRembourser, 0);
  const totalSociete = societe.reduce((s, g) => s + g.total, 0);
  const sansTicket = (courses ?? []).filter(m => m.status === 'completed' && !((m.errandSpent ?? 0) > 0));

  async function rembourser(ids: string[], rembourse: boolean) {
    setEnvoi(true);
    const { setErrandReimbursedDB } = await chargerDb();
    const erreurs = (await Promise.all(ids.map(id => setErrandReimbursedDB(id, rembourse)))).filter(r => r.error);
    setEnvoi(false);
    if (erreurs.length) toast(erreurs[0].error!, 'error');
    else toast(rembourse ? 'Marqué remboursé.' : 'Remboursement annulé.', 'success');
    await charger();
  }

  async function toutRembourser(g: AvancesCleaner<Mission>) {
    const ids = g.courses.filter(m => !m.errandReimbursedAt).map(m => m.id);
    if (!ids.length) return;
    const ok = await confirm({
      title: `Rembourser ${money(g.aRembourser)} à ${g.cleanerName} ?`,
      message: `${ids.length} course${ids.length > 1 ? 's' : ''} passe${ids.length > 1 ? 'nt' : ''} en « remboursé ». Faites le virement à part de sa paie.`,
      confirmLabel: 'Marquer remboursé',
    });
    if (ok) await rembourser(ids, true);
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Courses &amp; avances</h1>
        <p className="text-sm mt-1" style={{ color: '#A8A09A' }}>
          L’argent des courses / achats. Le client rembourse les achats au réel sur sa facture ; ici, ce que nous devons aux intervenants et ce que la carte a payé.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="rounded-2xl border p-4" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          <p className="text-xs" style={{ color: '#A8A09A' }}>À rembourser aux intervenants</p>
          <p className="text-xl font-bold mt-0.5" style={{ color: totalDu > 0 ? '#C48A2A' : '#1A1A1A' }}>{money(totalDu)}</p>
        </div>
        <div className="rounded-2xl border p-4" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          <p className="text-xs" style={{ color: '#A8A09A' }}>Payé avec la carte de la société</p>
          <p className="text-xl font-bold mt-0.5" style={{ color: '#1A1A1A' }}>{money(totalSociete)}</p>
        </div>
      </div>

      <div className="flex gap-1 mb-5 p-1 rounded-2xl w-fit" style={{ backgroundColor: '#F5F3EF' }}>
        {([['avances', 'Avances des intervenants'], ['societe', 'Carte de la société']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setOnglet(k)} className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{ backgroundColor: onglet === k ? '#FFFFFF' : 'transparent', color: onglet === k ? '#1A1A1A' : '#A8A09A' }}>
            {l}
          </button>
        ))}
      </div>

      {sansTicket.length > 0 && (
        <p className="text-xs mb-4 px-3 py-2 rounded-lg" style={{ backgroundColor: '#C48A2A12', color: '#9A6A1E' }}>
          {sansTicket.length} course{sansTicket.length > 1 ? 's' : ''} terminée{sansTicket.length > 1 ? 's' : ''} sans ticket enregistré : saisissez-le depuis la mission.
        </p>
      )}

      {courses === null ? <Loading variant="skeleton" rows={3} /> : onglet === 'avances' ? (
        <>
          <label className="flex items-center gap-2 text-xs mb-3 cursor-pointer select-none" style={{ color: '#7A7068' }}>
            <input type="checkbox" checked={voirRemboursees} onChange={e => setVoirRemboursees(e.target.checked)} className="accent-[#C9A84C]" />
            Afficher aussi les avances déjà remboursées
          </label>
          {avances.filter(g => voirRemboursees || g.aRembourser > 0).length === 0 ? (
            <Vide texte="Aucune avance à rembourser." />
          ) : (
            <div className="space-y-3">
              {avances.filter(g => voirRemboursees || g.aRembourser > 0).map(g => (
                <div key={g.cleanerId} className="rounded-2xl border overflow-hidden" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
                  <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 border-b" style={{ borderColor: '#F2EFE9' }}>
                    <div>
                      <p className="font-semibold" style={{ color: '#1A1A1A' }}>{g.cleanerName}</p>
                      <p className="text-xs" style={{ color: '#A8A09A' }}>
                        À rembourser : <b style={{ color: g.aRembourser > 0 ? '#C48A2A' : '#7A7068' }}>{money(g.aRembourser)}</b>
                        {g.rembourse > 0 && <> · déjà remboursé : {money(g.rembourse)}</>}
                      </p>
                    </div>
                    {g.aRembourser > 0 && (
                      <button onClick={() => toutRembourser(g)} disabled={envoi}
                        className="px-3 py-2 rounded-xl text-xs font-semibold disabled:opacity-50" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
                        Tout marquer remboursé
                      </button>
                    )}
                  </div>
                  {g.courses.filter(m => voirRemboursees || !m.errandReimbursedAt).map(m => (
                    <LigneCourse key={m.id} m={m}>
                      {m.errandReimbursedAt ? (
                        <button onClick={() => rembourser([m.id], false)} disabled={envoi}
                          className="text-[11px] px-2 py-1 rounded-lg border disabled:opacity-50" style={{ borderColor: '#E8E4DC', color: '#3F6B4F' }}>
                          Remboursé le {new Date(m.errandReimbursedAt).toLocaleDateString('fr-FR')} · annuler
                        </button>
                      ) : (
                        <button onClick={() => rembourser([m.id], true)} disabled={envoi}
                          className="text-[11px] px-2 py-1 rounded-lg border disabled:opacity-50" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>
                          Marquer remboursé
                        </button>
                      )}
                    </LigneCourse>
                  ))}
                </div>
              ))}
            </div>
          )}
        </>
      ) : societe.length === 0 ? (
        <Vide texte="Aucune dépense avec la carte de la société." />
      ) : (
        <div className="space-y-3">
          {societe.map(g => (
            <div key={g.mois} className="rounded-2xl border overflow-hidden" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
              <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: '#F2EFE9' }}>
                <p className="font-semibold capitalize" style={{ color: '#1A1A1A' }}>{libelleMois(g.mois)}</p>
                <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{money(g.total)}</p>
              </div>
              {g.courses.map(m => <LigneCourse key={m.id} m={m} avecIntervenant />)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LigneCourse({ m, avecIntervenant, children }: { m: Mission; avecIntervenant?: boolean; children?: React.ReactNode }) {
  const depasse = depasseBudget(m.errandSpent, m.errandBudget);
  return (
    <div className="px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-b last:border-b-0" style={{ borderColor: '#F7F5F1' }}>
      <span className="text-xs tabular-nums shrink-0" style={{ color: '#A8A09A', width: 40 }}>{dateCourte(m.date)}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm truncate" style={{ color: '#1A1A1A' }}>{m.property || 'Course'}</p>
        <p className="text-xs truncate" style={{ color: '#A8A09A' }}>
          {avecIntervenant && m.cleanerName ? `${m.cleanerName} · ` : ''}{m.errandDetails ?? ''}
        </p>
      </div>
      <span className="text-sm font-semibold tabular-nums" style={{ color: depasse ? '#B85A50' : '#1A1A1A' }}
        title={depasse ? `Au-dessus du budget accepté (${money(m.errandBudget ?? 0)})` : undefined}>
        {money(m.errandSpent ?? 0)}
      </span>
      {children}
    </div>
  );
}

function Vide({ texte }: { texte: string }) {
  return (
    <div className="rounded-2xl border p-8 text-center" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
      <p className="text-sm" style={{ color: '#7A7068' }}>{texte}</p>
    </div>
  );
}
