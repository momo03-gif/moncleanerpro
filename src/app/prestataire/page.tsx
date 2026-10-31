'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import type { Mission } from '@/lib/types';
import type { TerrainInfo } from '@/lib/fieldContact';
import { formatDuration, formatHour, money } from '@/lib/format';
import { serviceLabel, SERVICE_BADGE } from '@/lib/service';
import { libelleSpecialite } from '@/lib/prestataireRegles';
import { appelPrestataire, type Agent } from '@/lib/prestataireApi';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';

// ════════════════════════════════════════════════════════════════════════════
//  Espace prestataire — les missions que MonCleanerPro lui confie.
//  Il choisit pour chacune l'agent qui s'en charge ; l'agent la réalise avec
//  l'application cleaner (démarrer, photos « après », rapport).
// ════════════════════════════════════════════════════════════════════════════

const loadDb = () => import('@/lib/db');

type Onglet = 'attribuer' | 'avenir' | 'terminees';

const STATUT: Record<string, { label: string; color: string; bg: string }> = {
  pending:     { label: 'À attribuer', color: '#B85A50', bg: '#B85A5014' },
  accepted:    { label: 'Attribuée',   color: '#5B6EF5', bg: '#5B6EF514' },
  in_progress: { label: 'En cours',    color: '#C48A2A', bg: '#C48A2A14' },
  completed:   { label: 'Terminée',    color: '#5A8A6A', bg: '#5A8A6A14' },
  cancelled:   { label: 'Annulée',     color: '#A8A09A', bg: '#A8A09A14' },
};

const aujourdhui = () => new Date().toLocaleDateString('en-CA');
function il_y_a(jours: number): string {
  const d = new Date(); d.setDate(d.getDate() - jours);
  return d.toLocaleDateString('en-CA');
}
function dateLongue(d: string): string {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function PrestataireMissionsPage() {
  const [missions, setMissions] = useState<Mission[] | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [erreur, setErreur] = useState('');
  const [onglet, setOnglet] = useState<Onglet>('attribuer');

  const charger = useCallback(async () => {
    const { getMissionsForPrestataireDB } = await loadDb();
    const [m, a] = await Promise.all([
      getMissionsForPrestataireDB({ since: il_y_a(45) }),
      appelPrestataire<{ agents: Agent[] }>('agents'),
    ]);
    if (m === null) setErreur('Impossible de charger vos missions. Réessayez.');
    else setErreur('');
    setMissions(m ?? []);
    if (a.ok) setAgents(a.agents.filter(x => x.status === 'active'));
  }, []);

  useEffect(() => {
    let actif = true;
    (async () => { if (actif) await charger(); })();
    return () => { actif = false; };
  }, [charger]);

  const listes = useMemo(() => {
    const tout = missions ?? [];
    const jour = aujourdhui();
    const parDate = (a: Mission, b: Mission) => (a.date + a.time).localeCompare(b.date + b.time);
    return {
      attribuer: tout.filter(m => m.status === 'pending' && m.date >= jour).sort(parDate),
      avenir: tout.filter(m => (m.status === 'accepted' || m.status === 'in_progress')).sort(parDate),
      terminees: tout.filter(m => m.status === 'completed' || m.status === 'cancelled' || (m.status === 'pending' && m.date < jour))
        .sort((a, b) => parDate(b, a)),
    };
  }, [missions]);

  const affichees = listes[onglet];

  return (
    <div className="p-5">
      <div className="mb-5 pt-2">
        <h1 className="text-xl font-bold" style={{ color: '#1A1A1A' }}>Missions confiées</h1>
        <p className="text-sm mt-1" style={{ color: '#A8A09A' }}>Choisissez l’agent qui réalise chaque mission.</p>
      </div>

      <div className="flex gap-2 mb-5 overflow-x-auto">
        {([
          ['attribuer', 'À attribuer', listes.attribuer.length],
          ['avenir', 'Planifiées', listes.avenir.length],
          ['terminees', 'Historique', null],
        ] as [Onglet, string, number | null][]).map(([cle, label, n]) => (
          <button key={cle} onClick={() => setOnglet(cle)}
            className="px-4 py-2 rounded-xl text-sm font-semibold border whitespace-nowrap transition-all"
            style={{
              borderColor: onglet === cle ? '#C9A84C' : '#E8E4DC',
              backgroundColor: onglet === cle ? '#C9A84C' : '#FFFFFF',
              color: onglet === cle ? '#1A1A1A' : '#7A7068',
            }}>
            {label}{n ? ` · ${n}` : ''}
          </button>
        ))}
      </div>

      {erreur && <p className="text-sm mb-4 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEF2F2', color: '#B85A50' }}>{erreur}</p>}

      {missions === null ? (
        <Loading variant="skeleton" rows={3} />
      ) : agents.length === 0 && onglet === 'attribuer' && listes.attribuer.length > 0 ? (
        <div className="rounded-2xl border p-5 mb-4" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: '#1A1A1A' }}>Ajoutez d’abord vos agents</p>
          <p className="text-sm mb-3" style={{ color: '#7A7068' }}>Chaque agent reçoit ses propres identifiants pour l’application terrain. Vous travaillez seul ? Ajoutez-vous comme agent (avec une autre adresse email) pour réaliser vous-même les missions.</p>
          <Link href="/prestataire/agents" className="inline-block px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
            Gérer mes agents
          </Link>
        </div>
      ) : null}

      {missions !== null && affichees.length === 0 && (
        <p className="text-sm text-center py-12" style={{ color: '#A8A09A' }}>
          {onglet === 'attribuer' ? 'Aucune mission à attribuer.' : onglet === 'avenir' ? 'Aucune mission planifiée.' : 'Aucune mission dans l’historique récent.'}
        </p>
      )}

      <div className="space-y-3">
        {affichees.map(m => (
          <CarteMission key={m.id} mission={m} agents={agents} onChange={charger} />
        ))}
      </div>
    </div>
  );
}

function CarteMission({ mission: m, agents, onChange }: { mission: Mission; agents: Agent[]; onChange: () => Promise<void> }) {
  const [choix, setChoix] = useState(m.cleanerId ?? '');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [acces, setAcces] = useState<TerrainInfo | null | 'chargement'>(null);
  const statut = STATUT[m.status] ?? STATUT.pending;
  const modifiable = m.status === 'pending' || m.status === 'accepted';
  const badge = SERVICE_BADGE[m.service ?? 'cleaning'];

  async function attribuer(cleanerId: string) {
    setEnvoi(true); setErreur('');
    const r = await appelPrestataire('attribuer', { missionId: m.id, cleanerId: cleanerId || null });
    setEnvoi(false);
    if (!r.ok) { setErreur(r.error); return; }
    await onChange();
  }

  async function voirAcces() {
    if (acces && acces !== 'chargement') { setAcces(null); return; }
    setAcces('chargement');
    const { getTerrainMap } = await import('@/lib/fieldContact');
    const t = await getTerrainMap([m.id]);
    setAcces(t[m.id] ?? {});
  }

  return (
    <div className="rounded-2xl border p-4" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#7A7068' }}>
            {dateLongue(m.date)}{m.time ? ` · ${formatHour(m.time)}` : ''}
          </p>
          <p className="text-base font-semibold mt-0.5 truncate" style={{ color: '#1A1A1A' }}>{m.property || 'Mission'}</p>
          {m.address && <p className="text-sm truncate" style={{ color: '#7A7068' }}>{m.address}</p>}
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-lg shrink-0" style={{ color: statut.color, backgroundColor: statut.bg }}>
          {statut.label}
        </span>
      </div>

      <div className="flex flex-wrap gap-2 items-center text-xs mb-3" style={{ color: '#7A7068' }}>
        <span className="px-2 py-0.5 rounded-md font-semibold" style={{ color: badge?.color, backgroundColor: badge?.bg }}>{serviceLabel(m.service)}</span>
        <span className="flex items-center gap-1"><Icon name="clock" size={13} /> {formatDuration(m.missionDurationMinutes)}</span>
        {m.prestataireGain != null && (
          <span className="flex items-center gap-1 font-semibold" style={{ color: '#1A1A1A' }}><Icon name="wallet" size={13} /> {money(m.prestataireGain)}</span>
        )}
      </div>

      {m.service === 'errand' && m.errandDetails && (
        <div className="text-sm mb-3 px-3 py-2 rounded-lg" style={{ backgroundColor: '#B07A4A12' }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: '#8A5A2E' }}>Course à faire</p>
          <p className="whitespace-pre-line" style={{ color: '#1A1A1A' }}>{m.errandDetails}</p>
        </div>
      )}

      {m.service === 'repair' && (
        <div className="text-sm mb-3 px-3 py-2 rounded-lg" style={{ backgroundColor: '#4A6A8A12' }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: '#3F5A78' }}>
            {m.repairSpecialite ? libelleSpecialite(m.repairSpecialite) : 'Travail à faire'}
          </p>
          {m.repairDetails && <p className="whitespace-pre-line" style={{ color: '#1A1A1A' }}>{m.repairDetails}</p>}
        </div>
      )}

      {m.notes && (
        <p className="text-sm mb-3 px-3 py-2 rounded-lg whitespace-pre-line" style={{ backgroundColor: '#F8F6F2', color: '#1A1A1A' }}>{m.notes}</p>
      )}

      {modifiable ? (
        <div className="flex gap-2 items-center">
          <select value={choix} onChange={e => setChoix(e.target.value)} disabled={envoi}
            className="flex-1 min-w-0 px-3 py-2.5 rounded-xl text-sm border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF', color: '#1A1A1A' }}>
            <option value="">— Choisir un agent —</option>
            {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            {m.cleanerId && !agents.some(a => a.id === m.cleanerId) && <option value={m.cleanerId}>{m.cleanerName ?? 'Agent'}</option>}
          </select>
          {choix !== (m.cleanerId ?? '') && (
            <button onClick={() => attribuer(choix)} disabled={envoi}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
              {envoi ? '…' : choix ? 'Attribuer' : 'Retirer'}
            </button>
          )}
        </div>
      ) : m.cleanerName ? (
        <p className="text-sm flex items-center gap-1.5" style={{ color: '#7A7068' }}><Icon name="user" size={14} /> {m.cleanerName}</p>
      ) : null}
      {erreur && <p className="text-xs mt-2" style={{ color: '#B85A50' }}>{erreur}</p>}

      {m.status !== 'cancelled' && m.status !== 'completed' && (
        <button onClick={voirAcces} className="mt-3 text-xs font-semibold flex items-center gap-1" style={{ color: '#7A7068' }}>
          <Icon name="lock" size={13} /> {acces && acces !== 'chargement' ? 'Masquer l’accès' : 'Voir l’accès au logement'}
        </button>
      )}
      {acces === 'chargement' && <p className="text-xs mt-2" style={{ color: '#A8A09A' }}>Chargement…</p>}
      {acces && acces !== 'chargement' && <BlocAcces info={acces} />}
    </div>
  );
}

function BlocAcces({ info }: { info: TerrainInfo }) {
  const lignes: [string, string | undefined][] = [
    ['Code portail', info.portalCode],
    ['Boîte à clés', info.keyboxCode],
    ['Accès', info.entryInstructions],
    ['Notes du logement', info.apartmentNotes],
    ['Contact sur place', info.siteContact ? [info.siteContact.name, info.siteContact.phone].filter(Boolean).join(' · ') : undefined],
  ];
  const remplies = lignes.filter(([, v]) => v);
  return (
    <div className="mt-2 rounded-lg px-3 py-2 space-y-1.5" style={{ backgroundColor: '#F8F6F2' }}>
      {remplies.length === 0 && <p className="text-xs" style={{ color: '#A8A09A' }}>Aucune information d’accès renseignée.</p>}
      {remplies.map(([k, v]) => (
        <p key={k} className="text-sm whitespace-pre-line" style={{ color: '#1A1A1A' }}>
          <span className="text-xs font-semibold uppercase tracking-wide mr-1.5" style={{ color: '#7A7068' }}>{k}</span>{v}
        </p>
      ))}
      {info.accessVideoUrl && (
        <a href={info.accessVideoUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold underline" style={{ color: '#7A7068' }}>Vidéo d’accès</a>
      )}
    </div>
  );
}
