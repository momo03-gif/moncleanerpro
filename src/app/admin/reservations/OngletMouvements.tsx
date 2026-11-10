'use client';

// Onglet « Mouvements » : qui part, qui arrive, et quand — jour par jour.
// Une frise des prochains jours en haut (avec un point quand un ménage
// manque), puis, pour le jour choisi, une carte par logement : l'heure, le
// mouvement en toutes lettres, le nombre de voyageurs, le ménage.

import { useMemo, useState } from 'react';
import type { Reservation } from '@/lib/types';
import type { PartnerAccount } from '@/lib/db';
import { platformLabel } from '@/lib/pms/registry';
import type { chevauchements } from '@/lib/reservationDedupe';
import { mouvementsParJour, libelleVoyageurs, type Mouvement, type TypeMouvement } from '@/lib/mouvements';
import Icon from '@/components/Icon';
import { inputStyle } from '@/lib/ui';
import { ajouterJours } from '@/lib/dateParis';
import { DetailReservation } from './LigneReservation';
import VuePlanning from './VuePlanning';
import { fmtDate, daysBetween, carte } from './commun';

type Conflit = ReturnType<typeof chevauchements>[number];

const JOURS_FRISE = 14;

const TYPE: Record<TypeMouvement, { label: string; icone: 'arrowUp' | 'arrowDown' | 'sync'; color: string; bg: string }> = {
  enchainement: { label: 'Départ + arrivée', icone: 'sync', color: '#B85A50', bg: '#B85A5014' },
  depart:       { label: 'Départ', icone: 'arrowUp', color: '#C48A2A', bg: '#C48A2A14' },
  arrivee:      { label: 'Arrivée', icone: 'arrowDown', color: '#5B6EF5', bg: '#5B6EF514' },
};

function nomJour(jour: string, aujourdhui: string, court = false) {
  const ecart = daysBetween(aujourdhui, jour);
  if (ecart === 0) return 'Aujourd’hui';
  if (ecart === 1) return 'Demain';
  return new Date(jour + 'T00:00:00').toLocaleDateString('fr-FR', court
    ? { weekday: 'short', day: 'numeric' }
    : { weekday: 'long', day: 'numeric', month: 'long' });
}

function Compteur({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-2xl border px-4 py-3" style={carte}>
      <p className="text-2xl font-bold leading-none" style={{ color: value ? color : '#C9C2B8' }}>{value}</p>
      <p className="text-xs mt-1.5" style={{ color: '#7A7068' }}>{label}</p>
    </div>
  );
}

// Un séjour, dit en clair : « 3 voyageurs · 4 nuits · arrivé le 7 nov. ».
function Sejour({ r, sens }: { r: Reservation; sens: 'depart' | 'arrivee' }) {
  const nuits = daysBetween(r.checkIn, r.checkOut);
  const voyageurs = libelleVoyageurs(r.guestsCount);
  const heure = sens === 'depart' ? r.checkOutTime : r.checkInTime;
  return (
    <p className="text-xs" style={{ color: '#7A7068' }}>
      <span className="font-semibold" style={{ color: TYPE[sens].color }}>{sens === 'depart' ? 'Départ' : 'Arrivée'}</span>
      {heure && <> à <span className="font-semibold" style={{ color: '#1A1A1A' }}>{heure}</span></>}
      {' · '}
      {voyageurs
        ? <span className="inline-flex items-center gap-1"><Icon name="user" size={12} />{voyageurs}</span>
        : <span style={{ color: '#B5ADA3' }}>voyageurs non communiqués</span>}
      {nuits > 0 && <> · {nuits} nuit{nuits > 1 ? 's' : ''}</>}
      {' · '}{sens === 'depart' ? `arrivé le ${fmtDate(r.checkIn)}` : `repart le ${fmtDate(r.checkOut)}`}
      {r.status === 'tentative' && <span className="font-semibold" style={{ color: '#C48A2A' }}> · à confirmer</span>}
      {r.status === 'blocked' && <span className="font-semibold" style={{ color: '#6B7280' }}> · date bloquée (séjour ou fermeture ?)</span>}
    </p>
  );
}

function CarteMouvement({ m, conciergerie, enCreation, onCreerMenage }: {
  m: Mouvement; conciergerie?: string; enCreation: boolean; onCreerMenage: (id: string) => void;
}) {
  const [detail, setDetail] = useState(false);
  const t = TYPE[m.type];
  const heure = m.type === 'arrivee' ? m.arrivee?.checkInTime : m.depart?.checkOutTime;
  const plateforme = platformLabel((m.depart ?? m.arrivee)!.platform);
  const d = m.depart;

  return (
    <div className="rounded-2xl border overflow-hidden" style={carte}>
      <div className="flex items-stretch">
        {/* Heure, en gros : c'est ce qu'on lit en premier. */}
        <div className="w-20 shrink-0 flex flex-col items-center justify-center py-3 border-r" style={{ borderColor: '#F2EFE9', backgroundColor: t.bg }}>
          <span style={{ color: t.color }}><Icon name={t.icone} size={18} /></span>
          <span className="text-sm font-bold mt-1" style={{ color: heure ? '#1A1A1A' : '#B5ADA3' }}>{heure ?? '—'}</span>
          {m.type === 'enchainement' && m.arrivee?.checkInTime && (
            <span className="text-[10px] font-semibold" style={{ color: '#5B6EF5' }}>→ {m.arrivee.checkInTime}</span>
          )}
        </div>

        <div className="flex-1 min-w-0 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ color: t.color, backgroundColor: t.bg }}>{t.label}</span>
            <p className="text-[15px] font-semibold truncate" style={{ color: '#1A1A1A' }}>{m.logement}</p>
          </div>
          <p className="text-[11px] mt-0.5" style={{ color: '#A8A09A' }}>{[conciergerie, plateforme].filter(Boolean).join(' · ')}</p>
          <div className="mt-2 space-y-1">
            {m.depart && <Sejour r={m.depart} sens="depart" />}
            {m.arrivee && <Sejour r={m.arrivee} sens="arrivee" />}
          </div>
          {m.type === 'enchainement' && (
            <p className="text-[11px] mt-1.5 font-medium" style={{ color: '#B85A50' }}>
              Le ménage doit être fini avant l’arrivée{m.arrivee?.checkInTime ? ` de ${m.arrivee.checkInTime}` : ''}.
            </p>
          )}
          <button onClick={() => setDetail(o => !o)} className="text-[10px] underline mt-1.5" style={{ color: '#A8A09A' }}>
            {detail ? 'masquer le détail' : 'ce que la plateforme a envoyé'}
          </button>
        </div>

        {/* Le ménage : seulement quand quelqu'un part. */}
        <div className="w-36 shrink-0 flex items-center justify-end pr-4">
          {!d ? (
            <span className="text-[11px]" style={{ color: '#B5ADA3' }}>Pas de ménage</span>
          ) : d.missionId ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: '#5A8A6A15', color: '#5A8A6A' }}>
              <Icon name="check" size={12} /> Ménage créé
            </span>
          ) : d.status === 'confirmed' ? (
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: '#B85A5015', color: '#B85A50' }}>
              Ménage manquant
            </span>
          ) : (
            // Écarté par la synchro (date bloquée, à confirmer) : l'exploitant tranche.
            <button onClick={() => onCreerMenage(d.id)} disabled={enCreation}
              className="text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border disabled:opacity-50"
              style={{ borderColor: '#C9A84C', color: '#1A1A1A' }}>
              {enCreation ? 'Création…' : 'Créer le ménage'}
            </button>
          )}
        </div>
      </div>
      {detail && (
        <div className="px-4 pb-3 grid gap-2">
          {m.depart && <DetailReservation id={m.depart.id} titre={m.arrivee ? 'Départ' : undefined} />}
          {m.arrivee && <DetailReservation id={m.arrivee.id} titre={m.depart ? 'Arrivée' : undefined} />}
        </div>
      )}
    </div>
  );
}

export default function OngletMouvements({ reservations, conflits, partenaires, aujourdhui, enCreation, onCreerMenage }: {
  reservations: Reservation[];
  conflits: Conflit[];
  partenaires: PartnerAccount[];
  aujourdhui: string;
  enCreation: string | null;
  onCreerMenage: (id: string) => void;
}) {
  const [jour, setJour] = useState(aujourdhui);
  const [vue, setVue] = useState<'jour' | 'planning'>('jour');
  const [conciergerie, setConciergerie] = useState('all');
  const [recherche, setRecherche] = useState('');

  const nomConciergerie = useMemo(() => new Map(partenaires.map(p => [p.userId, p.name])), [partenaires]);

  const filtrees = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return reservations.filter(r =>
      (conciergerie === 'all' || r.partnerId === conciergerie)
      && (!q || (r.apartmentName ?? '').toLowerCase().includes(q)));
  }, [reservations, conciergerie, recherche]);

  const parJour = useMemo(() => new Map(mouvementsParJour(filtrees, aujourdhui).map(j => [j.jour, j])), [filtrees, aujourdhui]);
  const frise = Array.from({ length: JOURS_FRISE }, (_, i) => ajouterJours(aujourdhui, i));
  // Au-delà de la frise : les jours suivants qui ont des mouvements.
  const plusLoin = [...parJour.keys()].filter(j => j > frise[frise.length - 1]);
  const choisi = parJour.get(jour);
  const mouvements = choisi?.mouvements ?? [];
  const nb = (t: TypeMouvement) => mouvements.filter(m => m.type === t).length;

  // Conciergeries qui ont au moins une réservation à venir.
  const choix = useMemo(() => {
    const ids = new Set(reservations.filter(r => r.checkOut >= aujourdhui).map(r => r.partnerId).filter(Boolean));
    return partenaires.filter(p => p.userId && ids.has(p.userId));
  }, [reservations, partenaires, aujourdhui]);

  return (
    <>
      {conflits.length > 0 && (
        <div className="rounded-2xl border p-4 mb-5" style={{ borderColor: '#E4B7B1', backgroundColor: '#FDF3F2' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: '#8A3A31' }}>
            {conflits.length} séjour{conflits.length > 1 ? 's' : ''} impossible{conflits.length > 1 ? 's' : ''} : deux voyageurs au même endroit en même temps
          </p>
          <p className="text-xs mb-2" style={{ color: '#8A3A31' }}>
            Un des calendriers exporte des indisponibilités plutôt que des séjours, ou ce logement porte un calendrier de trop (onglet Calendriers).
          </p>
          {conflits.slice(0, 10).map((c, i) => (
            <p key={i} className="text-xs" style={{ color: '#7A3028' }}>
              <span className="font-semibold">{c.apartmentName ?? '—'}</span>
              {' : '}{platformLabel(c.a.platform)} {fmtDate(c.a.checkIn)}→{fmtDate(c.a.checkOut)}
              {' recouvre '}{platformLabel(c.b.platform)} {fmtDate(c.b.checkIn)}→{fmtDate(c.b.checkOut)}
            </p>
          ))}
        </div>
      )}

      {/* Frise des jours : on voit d'un coup d'œil les journées chargées. */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1" hidden={vue !== 'jour'}>
        {frise.map(j => {
          const info = parJour.get(j);
          const actif = j === jour;
          return (
            <button key={j} onClick={() => setJour(j)}
              className="shrink-0 w-[92px] rounded-2xl border px-2 py-2.5 text-center transition-all relative"
              style={{
                borderColor: actif ? '#C9A84C' : '#E8E4DC',
                backgroundColor: actif ? '#1A1A1A' : '#FFFFFF',
              }}>
              {!!info?.sansMenage && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full" style={{ backgroundColor: '#B85A50' }} title="Ménage manquant" />
              )}
              <p className="text-[11px] font-semibold capitalize" style={{ color: actif ? '#C9A84C' : '#7A7068' }}>{nomJour(j, aujourdhui, true)}</p>
              <div className="flex items-center justify-center gap-2 mt-1 text-xs font-bold" style={{ color: actif ? '#FFFFFF' : '#1A1A1A' }}>
                <span className="inline-flex items-center" title="Départs"><Icon name="arrowUp" size={12} />{info?.departs ?? 0}</span>
                <span className="inline-flex items-center" title="Arrivées"><Icon name="arrowDown" size={12} />{info?.arrivees ?? 0}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: '#F5F3EF' }}>
          {([['jour', 'Par jour'], ['planning', `Planning ${JOURS_FRISE} jours`]] as const).map(([v, label]) => (
            <button key={v} onClick={() => setVue(v)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ backgroundColor: vue === v ? '#FFFFFF' : 'transparent', color: vue === v ? '#1A1A1A' : '#A8A09A', boxShadow: vue === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
              {label}
            </button>
          ))}
        </div>
        <input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Rechercher un logement"
          className="flex-1 min-w-[200px] px-3 py-2 rounded-xl text-sm border" style={inputStyle} />
        {choix.length > 1 && (
          <select value={conciergerie} onChange={e => setConciergerie(e.target.value)}
            className="px-3 py-2 rounded-xl text-sm border appearance-none"
            style={{ ...inputStyle, color: conciergerie === 'all' ? '#7A7068' : '#1A1A1A' }}>
            <option value="all">Toutes les conciergeries</option>
            {choix.map(p => <option key={p.userId} value={p.userId!}>{p.name}</option>)}
          </select>
        )}
        {vue === 'jour' && plusLoin.length > 0 && (
          <select value={plusLoin.includes(jour) ? jour : ''} onChange={e => e.target.value && setJour(e.target.value)}
            className="px-3 py-2 rounded-xl text-sm border appearance-none" style={{ ...inputStyle, color: '#7A7068' }}>
            <option value="">Plus tard…</option>
            {plusLoin.map(j => <option key={j} value={j}>{nomJour(j, aujourdhui)} ({parJour.get(j)!.mouvements.length})</option>)}
          </select>
        )}
      </div>

      {vue === 'planning' ? (
        <VuePlanning reservations={filtrees} aujourdhui={aujourdhui} jours={JOURS_FRISE}
          onChoisirJour={j => { setJour(j); setVue('jour'); }} />
      ) : (<>
      <h2 className="text-lg font-bold mb-3 first-letter:uppercase" style={{ color: '#1A1A1A' }}>
        {nomJour(jour, aujourdhui)}
        {daysBetween(aujourdhui, jour) <= 1 && (
          <span className="text-sm font-normal ml-2" style={{ color: '#A8A09A' }}>
            {new Date(jour + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
        )}
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Compteur label="Départs" value={nb('depart')} color="#C48A2A" />
        <Compteur label="Arrivées" value={nb('arrivee')} color="#5B6EF5" />
        <Compteur label="Départ + arrivée le même jour" value={nb('enchainement')} color="#B85A50" />
        <Compteur label="Ménages manquants" value={choisi?.sansMenage ?? 0} color="#B85A50" />
      </div>

      {mouvements.length === 0 ? (
        <div className="rounded-2xl p-10 text-center border" style={carte}>
          <p className="text-sm" style={{ color: '#A8A09A' }}>Aucun départ ni aucune arrivée ce jour-là.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {(['enchainement', 'depart', 'arrivee'] as TypeMouvement[]).map(t => {
            const liste = mouvements.filter(m => m.type === t);
            if (!liste.length) return null;
            return (
              <section key={t}>
                <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-2" style={{ color: TYPE[t].color }}>
                  <Icon name={TYPE[t].icone} size={14} />
                  {t === 'enchainement' ? 'Départ + arrivée le même jour' : t === 'depart' ? 'Départs' : 'Arrivées'}
                  <span className="font-semibold" style={{ color: '#A8A09A' }}>{liste.length}</span>
                </h3>
                <div className="space-y-2.5">
                  {liste.map(m => (
                    <CarteMouvement key={`${m.airbnbId}|${m.type}`} m={m}
                      conciergerie={nomConciergerie.get((m.depart ?? m.arrivee)!.partnerId ?? null) ?? undefined}
                      enCreation={enCreation === m.depart?.id} onCreerMenage={onCreerMenage} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
      </>)}
    </>
  );
}
