'use client';

// « Préparer une journée » : les ménages d'un jour, montés d'un coup. On
// choisit le jour, on voit ce qui est déjà prévu (synchro, saisies), on ajoute
// les logements qui manquent ; chaque ligne se pré-remplit depuis la fiche
// (durée, prix, cleaner attitré) et se corrige sur place. Un seul bouton crée
// tout — les livraisons suivent le réglage de chaque logement.
// Constat du 10/11/2026 : 81 % des missions saisies à la main l'étaient la
// veille au soir, en lots, pour le lendemain.

import { useMemo, useState } from 'react';
import { createMissionsDayDB, type LigneJournee } from '@/lib/db';
import type { Apartment, Mission } from '@/lib/types';
import { useFeedback } from '@/contexts/FeedbackContext';
import { canCleanerDoService } from '@/lib/service';
import { aujourdhuiParis, dansJoursParis } from '@/lib/dateParis';
import { DEPARTURE_TIMES, formatHour, money } from '@/lib/format';
import { inputStyle } from '@/lib/ui';
import Icon from '@/components/Icon';
import type { ProprietesCreation } from './commun';

type Props = Pick<ProprietesCreation, 'cleaners' | 'airbnbs' | 'onReload' | 'onGoToMissions'> & { missions: Mission[] };

interface Ligne { airbnbId: string; timeFrom: string; cleanerId: string; durationMinutes: string; price: string }

const HEURE_DEFAUT = '11:00';
const champ = 'w-full px-3 py-2 rounded-xl text-sm border';

function nomJour(date: string) {
  if (date === aujourdhuiParis()) return 'Aujourd’hui';
  if (date === dansJoursParis(1)) return 'Demain';
  return new Date(date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function CreationJournee({ cleaners, airbnbs, missions, onReload, onGoToMissions }: Props) {
  const { toast } = useFeedback();
  const [date, setDate] = useState(dansJoursParis(1));
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [recherche, setRecherche] = useState('');
  const [coches, setCoches] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const menageurs = useMemo(() => cleaners.filter(c => canCleanerDoService(c, 'cleaning') && c.status !== 'inactive'), [cleaners]);
  const aptDe = useMemo(() => new Map(airbnbs.map(a => [a.id, a])), [airbnbs]);

  // Ce qui est déjà prévu ce jour-là : on ne le recrée pas.
  const dejaPrevus = useMemo(() => missions.filter(m =>
    m.date === date && m.airbnbId && m.status !== 'cancelled'
    && (m.service ?? 'cleaning') !== 'delivery' && (m.service ?? 'cleaning') !== 'appointment'
    && m.service !== 'repair' && m.service !== 'errand'), [missions, date]);

  // Logements proposés : pas les chambres d'une maison (le ménage porte sur la
  // maison), ni ceux déjà prévus ou déjà dans la liste.
  const proposes = useMemo(() => {
    const prevusIds = new Set(dejaPrevus.map(m => m.airbnbId));
    const choisisIds = new Set(lignes.map(l => l.airbnbId));
    const q = recherche.trim().toLowerCase();
    return airbnbs
      .filter(a => !a.parentAirbnbId && !prevusIds.has(a.id) && !choisisIds.has(a.id))
      .filter(a => !q || a.name.toLowerCase().includes(q) || (a.partnerName ?? '').toLowerCase().includes(q)
        || a.address.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }, [airbnbs, recherche, dejaPrevus, lignes]);

  function ligneDe(a: Apartment): Ligne {
    const attitre = a.cleanerId ? menageurs.find(c => c.id === a.cleanerId || c.user_id === a.cleanerId) : null;
    return {
      airbnbId: a.id, timeFrom: HEURE_DEFAUT, cleanerId: attitre?.id ?? '',
      durationMinutes: String(a.estimatedCleaningMinutes ?? 60),
      price: a.clientPrice != null ? String(a.clientPrice) : '',
    };
  }
  // Les logements proposés, rangés par conciergerie.
  const groupes = useMemo(() => {
    const parConciergerie = new Map<string, Apartment[]>();
    for (const a of proposes) {
      const k = a.partnerName?.trim() || 'Sans conciergerie';
      (parConciergerie.get(k) ?? parConciergerie.set(k, []).get(k)!).push(a);
    }
    return [...parConciergerie.entries()].sort(([a], [b]) =>
      (a === 'Sans conciergerie' ? 1 : 0) - (b === 'Sans conciergerie' ? 1 : 0) || a.localeCompare(b, 'fr'));
  }, [proposes]);

  const basculer = (ids: string[], oui: boolean) => setCoches(prev => {
    const n = new Set(prev);
    for (const id of ids) { if (oui) n.add(id); else n.delete(id); }
    return n;
  });
  // Les cochés encore proposés (un logement ajouté ou devenu « déjà prévu » sort de la liste).
  const cochesVisibles = proposes.filter(a => coches.has(a.id));
  function ajouterCoches() {
    setLignes(l => [...l, ...cochesVisibles.map(ligneDe)]);
    setCoches(new Set());
    setRecherche('');
  }
  const changer = (i: number, patch: Partial<Ligne>) => setLignes(l => l.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const retirer = (i: number) => setLignes(l => l.filter((_, j) => j !== i));
  const pourTous = (patch: Partial<Ligne>) => setLignes(l => l.map(x => ({ ...x, ...patch })));

  const avecLivraison = lignes.filter(l => aptDe.get(l.airbnbId)?.needsDelivery).length;
  const aAssigner = lignes.filter(l => !l.cleanerId).length;
  const total = lignes.reduce((s, l) => s + (Number(l.price) || 0), 0);

  async function valider() {
    if (lignes.length === 0) return;
    setBusy(true);
    const payload: LigneJournee[] = lignes.map(l => ({
      airbnbId: l.airbnbId, timeFrom: l.timeFrom || undefined, cleanerId: l.cleanerId || undefined,
      durationMinutes: Number(l.durationMinutes) || undefined,
      price: l.price === '' ? undefined : Math.max(0, Number(l.price) || 0),
    }));
    const r = await createMissionsDayDB(date, payload);
    setBusy(false);
    if (r.error) { toast(r.error, 'error'); return; }
    toast(`${r.crees} ménage${r.crees > 1 ? 's' : ''} créé${r.crees > 1 ? 's' : ''}`
      + (r.livraisons ? ` · ${r.livraisons} livraison${r.livraisons > 1 ? 's' : ''} ajoutée${r.livraisons > 1 ? 's' : ''}` : '')
      + (r.ignores ? ` · ${r.ignores} déjà prévu${r.ignores > 1 ? 's' : ''}, ignoré${r.ignores > 1 ? 's' : ''}` : '') + '.', 'success');
    setLignes([]);
    await onReload();
    onGoToMissions();
  }

  const jours = [aujourdhuiParis(), dansJoursParis(1), dansJoursParis(2)];

  return (
    <div className="space-y-4">
      {/* ── 1. Le jour ───────────────────────────────────────────────────── */}
      <div className="rounded-2xl border p-5" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
        <p className="text-sm font-semibold mb-3" style={{ color: '#1A1A1A' }}>
          <span className="inline-flex w-6 h-6 rounded-full items-center justify-center text-xs mr-2" style={{ backgroundColor: '#1A1A1A', color: '#C9A84C' }}>1</span>
          Quel jour ?
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {jours.map(j => (
            <button key={j} type="button" onClick={() => setDate(j)}
              className="px-4 py-2 rounded-xl text-sm font-semibold border capitalize"
              style={{ borderColor: date === j ? '#C9A84C' : '#E8E4DC', backgroundColor: date === j ? '#1A1A1A' : '#FFFFFF', color: date === j ? '#C9A84C' : '#1A1A1A' }}>
              {nomJour(j)}
            </button>
          ))}
          <input type="date" value={date} min={aujourdhuiParis()} onChange={e => e.target.value && setDate(e.target.value)}
            className="px-3 py-2 rounded-xl text-sm border" style={inputStyle} />
        </div>

        {/* Déjà prévus : la synchro et les saisies précédentes. */}
        <div className="mt-4 rounded-xl px-4 py-3" style={{ backgroundColor: '#FAFAF8' }}>
          <p className="text-xs font-semibold" style={{ color: '#7A7068' }}>
            <span className="capitalize">{nomJour(date)}</span>, {dejaPrevus.length === 0 ? 'aucun ménage n’est encore prévu.' : `${dejaPrevus.length} ménage${dejaPrevus.length > 1 ? 's' : ''} déjà prévu${dejaPrevus.length > 1 ? 's' : ''} :`}
          </p>
          {dejaPrevus.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {dejaPrevus.map(m => (
                <span key={m.id} className="text-[11px] px-2 py-1 rounded-lg border inline-flex items-center gap-1"
                  style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF', color: '#1A1A1A' }}
                  title={m.autoSynced ? 'Créé par la synchro des réservations' : 'Saisi à la main'}>
                  {m.autoSynced && <span style={{ color: '#A8A09A' }}><Icon name="sync" size={11} /></span>}
                  {aptDe.get(m.airbnbId!)?.name ?? m.property}
                  <span style={{ color: m.cleanerName ? '#5A8A6A' : '#C48A2A' }}>· {m.cleanerName ?? 'à assigner'}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 2. Les logements ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border p-5" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
        <p className="text-sm font-semibold mb-3" style={{ color: '#1A1A1A' }}>
          <span className="inline-flex w-6 h-6 rounded-full items-center justify-center text-xs mr-2" style={{ backgroundColor: '#1A1A1A', color: '#C9A84C' }}>2</span>
          Quels logements ? Cochez-en autant que vous voulez
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#A8A09A' }}><Icon name="search" size={15} /></span>
            <input value={recherche} onChange={e => setRecherche(e.target.value)}
              placeholder="Filtrer : logement, conciergerie ou adresse"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm border" style={inputStyle} />
          </div>
          {proposes.length > 0 && (
            <button type="button" onClick={() => basculer(proposes.map(x => x.id), cochesVisibles.length < proposes.length)}
              className="text-xs font-semibold px-3 py-2 rounded-xl border" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>
              {cochesVisibles.length < proposes.length ? `Tout cocher (${proposes.length})` : 'Tout décocher'}
            </button>
          )}
        </div>

        <div className="mt-2 rounded-xl border overflow-hidden" style={{ borderColor: '#E8E4DC', maxHeight: 340, overflowY: 'auto' }}>
          {proposes.length === 0 ? (
            <p className="text-xs px-3 py-3" style={{ color: '#A8A09A' }}>
              {recherche.trim() ? 'Aucun logement pour ce filtre.' : 'Tous les logements sont déjà prévus ou ajoutés pour ce jour.'}
            </p>
          ) : groupes.map(([conciergerie, liste]) => {
            const tous = liste.every(x => coches.has(x.id));
            return (
              <div key={conciergerie}>
                <label className="flex items-center gap-2 px-3 py-2 sticky top-0 z-10 cursor-pointer border-b"
                  style={{ backgroundColor: '#FAFAF8', borderColor: '#F2EFE9' }}>
                  <input type="checkbox" checked={tous} onChange={e => basculer(liste.map(x => x.id), e.target.checked)}
                    className="w-4 h-4 accent-[#C9A84C]" />
                  <span className="text-xs font-bold" style={{ color: '#1A1A1A' }}>{conciergerie}</span>
                  <span className="text-[11px]" style={{ color: '#A8A09A' }}>{liste.length}</span>
                </label>
                {liste.map(x => (
                  <label key={x.id} className="flex items-center gap-2 px-3 py-2 pl-8 border-b last:border-0 cursor-pointer hover:bg-[#FAFAF8]"
                    style={{ borderColor: '#F2EFE9' }}>
                    <input type="checkbox" checked={coches.has(x.id)} onChange={e => basculer([x.id], e.target.checked)}
                      className="w-4 h-4 accent-[#C9A84C]" />
                    <span className="text-sm flex-1 truncate" style={{ color: '#1A1A1A' }}>{x.name}</span>
                    {x.needsDelivery && <span style={{ color: '#C48A2A' }} title="Livraison à chaque ménage"><Icon name="delivery" size={13} /></span>}
                  </label>
                ))}
              </div>
            );
          })}
        </div>

        {cochesVisibles.length > 0 && (
          <button type="button" onClick={ajouterCoches}
            className="mt-2 w-full py-2.5 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2"
            style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
            <Icon name="plus" size={15} /> Ajouter {cochesVisibles.length} logement{cochesVisibles.length > 1 ? 's' : ''} à la journée
          </button>
        )}

        {lignes.length === 0 ? (
          <p className="text-xs mt-4" style={{ color: '#A8A09A' }}>
            Cochez les logements puis ajoutez-les : leur durée, leur prix et leur cleaner attitré se remplissent tout seuls.
          </p>
        ) : (
          <>
            {/* Réglages rapides pour toute la liste */}
            <div className="flex flex-wrap items-center gap-2 mt-4 mb-2 text-xs" style={{ color: '#7A7068' }}>
              <span className="font-semibold">Pour toutes les lignes :</span>
              <select defaultValue="" onChange={e => { if (e.target.value) pourTous({ timeFrom: e.target.value }); e.target.value = ''; }}
                className="px-2 py-1.5 rounded-lg border text-xs" style={inputStyle}>
                <option value="">Heure…</option>
                {DEPARTURE_TIMES.map(t => <option key={t} value={t}>{formatHour(t)}</option>)}
              </select>
              <select defaultValue="" onChange={e => { if (e.target.value) pourTous({ cleanerId: e.target.value === '-' ? '' : e.target.value }); e.target.value = ''; }}
                className="px-2 py-1.5 rounded-lg border text-xs" style={inputStyle}>
                <option value="">Cleaner…</option>
                <option value="-">À assigner plus tard</option>
                {menageurs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              {lignes.map((l, i) => {
                const a = aptDe.get(l.airbnbId);
                return (
                  <div key={l.airbnbId} className="rounded-xl border p-3" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-sm font-semibold flex-1 truncate" style={{ color: '#1A1A1A' }}>{a?.name ?? '—'}</p>
                      {a?.needsDelivery && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1" style={{ backgroundColor: '#C48A2A14', color: '#C48A2A' }}>
                          <Icon name="delivery" size={11} /> + livraison
                        </span>
                      )}
                      <button type="button" onClick={() => retirer(i)} aria-label="Retirer" style={{ color: '#A8A09A' }}><Icon name="close" size={15} /></button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <label className="text-[11px]" style={{ color: '#A8A09A' }}>Heure de départ
                        <select value={l.timeFrom} onChange={e => changer(i, { timeFrom: e.target.value })} className={champ} style={inputStyle}>
                          {DEPARTURE_TIMES.map(t => <option key={t} value={t}>{formatHour(t)}</option>)}
                        </select>
                      </label>
                      <label className="text-[11px]" style={{ color: '#A8A09A' }}>Cleaner
                        <select value={l.cleanerId} onChange={e => changer(i, { cleanerId: e.target.value })} className={champ}
                          style={{ ...inputStyle, color: l.cleanerId ? '#1A1A1A' : '#C48A2A' }}>
                          <option value="">À assigner plus tard</option>
                          {menageurs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </label>
                      <label className="text-[11px]" style={{ color: '#A8A09A' }}>Durée (min)
                        <input type="number" min="0" step="15" value={l.durationMinutes} onChange={e => changer(i, { durationMinutes: e.target.value })} className={champ} style={inputStyle} />
                      </label>
                      <label className="text-[11px]" style={{ color: '#A8A09A' }}>Prix client (€)
                        <input type="number" min="0" value={l.price} onChange={e => changer(i, { price: e.target.value })} placeholder="0" className={champ} style={inputStyle} />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── 3. Valider ───────────────────────────────────────────────────── */}
      {lignes.length > 0 && (
        <div className="rounded-2xl border p-4 flex flex-wrap items-center gap-3 sticky bottom-3"
          style={{ backgroundColor: '#1A1A1A', borderColor: '#1A1A1A', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
          <div className="flex-1 min-w-[200px]">
            <p className="text-sm font-semibold" style={{ color: '#FFFFFF' }}>
              <span className="capitalize">{nomJour(date)}</span> : {lignes.length} ménage{lignes.length > 1 ? 's' : ''}
              {avecLivraison > 0 && <> + {avecLivraison} livraison{avecLivraison > 1 ? 's' : ''}</>}
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#A8A09A' }}>
              {aAssigner > 0 ? `${aAssigner} à assigner plus tard` : 'Tous assignés'} · {money(total)} facturés
              {avecLivraison > 0 && ' · livraisons sans livreur, à assigner dans la liste'}
            </p>
          </div>
          <button type="button" onClick={valider} disabled={busy}
            className="px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
            style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
            {busy ? 'Création…' : `Créer ${lignes.length} ménage${lignes.length > 1 ? 's' : ''}`}
          </button>
        </div>
      )}
    </div>
  );
}
