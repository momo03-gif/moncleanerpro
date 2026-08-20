'use client';

// ── Suivi des prospects et des relances ───────────────────────────────────────
//
// Le problème : une demande de devis arrive, elle reste en brouillon, et rien ne
// rappelle de relancer. Cet écran met le retard en haut de la liste.
//
// Les fiches viennent de deux endroits : automatiquement des demandes du site
// (aucune ressaisie), ou saisies à la main. Tout passe par
// /api/admin/prospects — la table est fermée à la clé publique, ce sont des
// données personnelles de gens qui ne sont pas encore clients.

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  filterAndSort, computeStats, relanceLabel, relanceUrgency, todayISO, inDays,
  STATUT_LABEL, NATURE_LABEL,
  type Prospect, type ProspectStatut, type ProspectNature, type SortMode, type Urgency,
} from '@/lib/prospectsCompute';
import { useFeedback } from '@/contexts/FeedbackContext';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';

const FIELD = 'w-full px-3 py-2 rounded-lg text-sm border border-line bg-card text-ink';

// Couleur du statut. Même vocabulaire et mêmes teintes que les devis.
const STATUT_STYLE: Record<ProspectStatut, string> = {
  attente: 'bg-warn-soft text-warn',
  envoye: 'bg-gold-soft text-gold-ink',
  accepte: 'bg-success-soft text-success',
  refuse: 'bg-danger-soft text-danger',
};

const URGENCY_STYLE: Record<Urgency, string> = {
  overdue: 'text-danger font-semibold',
  today: 'text-warn font-semibold',
  soon: 'text-gold-ink',
  upcoming: 'text-muted',
  none: 'text-faint',
  closed: 'text-faint',
};

const emptyDraft = {
  nom: '', entreprise: '', email: '', telephone: '',
  nature: 'autre' as ProspectNature, statut: 'attente' as ProspectStatut,
  montant: '', relance: '', notes: '',
};

export default function ProspectsClient() {
  const { toast, confirm } = useFeedback();
  const [list, setList] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statut, setStatut] = useState<ProspectStatut | 'tous'>('tous');
  const [sort, setSort] = useState<SortMode>('relance');
  const [editing, setEditing] = useState<string | null>(null);   // id, ou 'new'
  const [draft, setDraft] = useState(emptyDraft);
  const [busy, setBusy] = useState(false);

  const today = todayISO();

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/prospects');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { toast(data.error ?? 'Lecture impossible.', 'error'); setLoading(false); return; }
    setList(data.prospects ?? []);
    setLoading(false);
    // Les demandes du site deviennent des fiches toutes seules : on le dit, sinon
    // l'utilisateur croit que la liste s'est remplie par magie.
    if (data.imported > 0) toast(`${data.imported} demande${data.imported > 1 ? 's' : ''} de devis reprise${data.imported > 1 ? 's' : ''} dans le suivi.`, 'success');
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  async function send(payload: Record<string, unknown>) {
    setBusy(true);
    const res = await fetch('/api/admin/prospects', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || !data.ok) { toast(data.error ?? 'Enregistrement impossible.', 'error'); return false; }
    await load();
    return true;
  }

  const visible = useMemo(
    () => filterAndSort(list, { statut, search, sort, today }),
    [list, statut, search, sort, today],
  );
  const stats = useMemo(() => computeStats(list, today), [list, today]);

  function openForm(p?: Prospect) {
    setDraft(p ? {
      nom: p.nom, entreprise: p.entreprise ?? '', email: p.email ?? '', telephone: p.telephone ?? '',
      nature: p.nature, statut: p.statut,
      montant: p.montant == null ? '' : String(p.montant),
      relance: p.relance ?? '', notes: p.notes ?? '',
    } : emptyDraft);
    setEditing(p?.id ?? 'new');
  }

  async function save() {
    const ok = await send({
      action: 'save',
      id: editing === 'new' ? undefined : editing,
      prospect: { ...draft, montant: draft.montant === '' ? null : Number(draft.montant) },
    });
    if (ok) { setEditing(null); toast(editing === 'new' ? 'Prospect ajouté.' : 'Modifications enregistrées.', 'success'); }
  }

  async function remove(p: Prospect) {
    const ok = await confirm({
      title: 'Supprimer ce prospect ?',
      message: `La fiche de ${p.nom} et son suivi seront perdus.${p.devisId ? ' Le devis, lui, est conservé.' : ''}`,
      confirmLabel: 'Supprimer', danger: true,
    });
    if (ok) await send({ action: 'delete', id: p.id });
  }

  if (loading) return <Loading className="p-6 text-sm" />;

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-xl font-bold text-ink">Prospects</h1>
          <p className="text-sm mt-1 max-w-lg text-muted">
            Chaque demande entrante, et la relance qui va avec. Les demandes reçues
            depuis le site arrivent ici toutes seules.
          </p>
        </div>
        <button onClick={() => openForm()}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-gold text-ink inline-flex items-center gap-2">
          <Icon name="plus" size={16} /> Nouveau prospect
        </button>
      </div>

      {/* Chiffres du pipeline */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        <Stat label="Total" value={String(stats.total)} />
        <Stat label="En attente d'envoi" value={String(stats.counts.attente)} />
        <Stat label="Devis envoyés" value={String(stats.counts.envoye)} />
        <Stat label="Acceptés" value={String(stats.counts.accepte)}
          sub={stats.tauxAcceptation !== null ? `${stats.tauxAcceptation}% des devis tranchés` : undefined} accent />
        <Stat label="En jeu" value={`${stats.potentiel.toLocaleString('fr-FR')} €`}
          sub="affaires encore ouvertes" />
      </div>

      {/* L'alerte qui justifie l'écran */}
      {stats.urgents > 0 && (
        <button onClick={() => { setStatut('tous'); setSearch(''); setSort('relance'); }}
          className="w-full text-left rounded-xl border border-warn-line bg-warn-soft px-4 py-3 mb-5 flex items-center gap-3">
          <Icon name="clock" size={16} className="text-warn shrink-0" />
          <span className="text-sm font-semibold text-warn">
            {stats.urgents} prospect{stats.urgents > 1 ? 's' : ''} à relancer aujourd&apos;hui ou en retard
          </span>
          <span className="ml-auto text-xs font-semibold text-warn">Voir →</span>
        </button>
      )}

      {/* Recherche, filtres, tri */}
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-faint pointer-events-none"><Icon name="search" size={15} /></span>
          <input value={search} onChange={e => setSearch(e.target.value)} type="search"
            placeholder="Nom, entreprise, email, téléphone…" className={`${FIELD} pl-9`} />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {([['tous', 'Tous', stats.total], ['attente', 'En attente', stats.counts.attente],
             ['envoye', 'Envoyés', stats.counts.envoye], ['accepte', 'Acceptés', stats.counts.accepte],
             ['refuse', 'Refusés', stats.counts.refuse]] as const).map(([id, label, n]) => (
            <button key={id} onClick={() => setStatut(id)}
              className={`text-xs font-semibold px-3 py-2 rounded-full border ${statut === id ? 'bg-ink text-white border-ink' : 'border-line text-muted'}`}>
              {label} <span className="opacity-70">{n}</span>
            </button>
          ))}
        </div>
        <select value={sort} onChange={e => setSort(e.target.value as SortMode)}
          className="px-3 py-2 rounded-lg text-sm border border-line bg-card text-ink">
          <option value="relance">Urgence des relances</option>
          <option value="recent">Plus récents d&apos;abord</option>
          <option value="nom">Nom (A→Z)</option>
        </select>
      </div>

      {/* La liste */}
      {visible.length === 0 ? (
        <div className="rounded-2xl border border-line bg-card p-12 text-center">
          <p className="font-semibold text-ink">
            {list.length === 0 ? 'Aucun prospect pour le moment' : 'Aucun résultat'}
          </p>
          <p className="text-sm mt-1 text-muted">
            {list.length === 0
              ? 'Les demandes reçues depuis le site apparaîtront ici automatiquement. Vous pouvez aussi en ajouter un à la main.'
              : 'Aucune fiche ne correspond à cette recherche.'}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-line bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead>
                <tr className="bg-surface-2 text-[11px] uppercase tracking-wide text-muted">
                  <th className="text-left font-semibold px-4 py-2.5">Prospect</th>
                  <th className="text-left font-semibold px-4 py-2.5">Contact</th>
                  <th className="text-left font-semibold px-4 py-2.5">Demande</th>
                  <th className="text-left font-semibold px-4 py-2.5">Statut</th>
                  <th className="text-left font-semibold px-4 py-2.5">Relance</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {visible.map(p => {
                  const urgency = relanceUrgency(p, today);
                  return (
                    <tr key={p.id} className="border-t border-hairline align-middle">
                      <td className="px-4 py-3">
                        <p className="text-sm font-semibold text-ink">{p.nom}</p>
                        {p.entreprise && <p className="text-xs text-muted">{p.entreprise}</p>}
                        {p.devisNumber && <p className="text-[11px] text-gold-ink">Devis {p.devisNumber}</p>}
                      </td>
                      <td className="px-4 py-3">
                        {p.email
                          ? <a href={`mailto:${p.email}`} className="text-sm text-gold-ink hover:underline">{p.email}</a>
                          : <span className="text-xs text-faint">—</span>}
                        {p.telephone && (
                          <p><a href={`tel:${p.telephone.replace(/\s+/g, '')}`} className="text-xs text-muted hover:underline">{p.telephone}</a></p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-ink">{NATURE_LABEL[p.nature]}</p>
                        {p.montant != null && <p className="text-xs text-muted">{p.montant.toLocaleString('fr-FR')} € estimé</p>}
                      </td>
                      <td className="px-4 py-3">
                        {/* Changer le statut depuis la liste : c'est le geste le
                            plus fréquent, il ne doit pas demander d'ouvrir la fiche. */}
                        <select value={p.statut} disabled={busy}
                          onChange={e => send({ action: 'patch', id: p.id, patch: { statut: e.target.value } })}
                          className={`text-xs font-semibold rounded-full px-3 py-1.5 border-0 ${STATUT_STYLE[p.statut]}`}>
                          {(Object.keys(STATUT_LABEL) as ProspectStatut[]).map(s => (
                            <option key={s} value={s}>{STATUT_LABEL[s]}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <p className={`text-xs ${URGENCY_STYLE[urgency]}`}>{relanceLabel(p, today)}</p>
                        {/* Reporter une relance sans ouvrir la fiche : sinon on ne
                            le fait pas, et la date reste fausse. */}
                        {urgency !== 'closed' && (
                          <div className="flex gap-1.5 mt-1">
                            {([['Demain', 1], ['3 j', 3], ['1 sem.', 7]] as const).map(([label, n]) => (
                              <button key={label} disabled={busy}
                                onClick={() => send({ action: 'patch', id: p.id, patch: { relance: inDays(n) } })}
                                className="text-[10px] px-1.5 py-0.5 rounded border border-line text-faint hover:text-muted">
                                {label}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => openForm(p)} aria-label={`Modifier ${p.nom}`}
                          className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-line text-muted">Ouvrir</button>
                        <button onClick={() => remove(p)} aria-label={`Supprimer ${p.nom}`}
                          className="ml-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-danger-line text-danger">✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Fiche : création et modification */}
      {editing && (
        <>
          <div className="fixed inset-0 bg-black/35 z-40" onClick={() => setEditing(null)} />
          <aside className="fixed top-0 right-0 h-full w-[460px] max-w-[92vw] bg-card z-50 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-line">
              <h2 className="font-bold text-ink">{editing === 'new' ? 'Nouveau prospect' : 'Modifier le prospect'}</h2>
              <button onClick={() => setEditing(null)} aria-label="Fermer" className="text-muted"><Icon name="close" size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 grid grid-cols-2 gap-3">
              <Field className="col-span-2" label="Nom" required value={draft.nom}
                onChange={v => setDraft(d => ({ ...d, nom: v }))} placeholder="Camille Bernard" />
              <Field className="col-span-2" label="Entreprise" value={draft.entreprise}
                onChange={v => setDraft(d => ({ ...d, entreprise: v }))} placeholder="Hôtel des Brotteaux (facultatif)" />
              <Field label="Email" value={draft.email} onChange={v => setDraft(d => ({ ...d, email: v }))} placeholder="nom@exemple.fr" />
              <Field label="Téléphone" value={draft.telephone} onChange={v => setDraft(d => ({ ...d, telephone: v }))} placeholder="06 12 34 56 78" />

              <div>
                <label className="block text-xs font-semibold mb-1 text-muted">Nature</label>
                <select value={draft.nature} onChange={e => setDraft(d => ({ ...d, nature: e.target.value as ProspectNature }))} className={FIELD}>
                  {(Object.keys(NATURE_LABEL) as ProspectNature[]).map(n => <option key={n} value={n}>{NATURE_LABEL[n]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 text-muted">Statut</label>
                <select value={draft.statut} onChange={e => setDraft(d => ({ ...d, statut: e.target.value as ProspectStatut }))} className={FIELD}>
                  {(Object.keys(STATUT_LABEL) as ProspectStatut[]).map(s => <option key={s} value={s}>{STATUT_LABEL[s]}</option>)}
                </select>
              </div>

              <Field label="Devis estimé (€)" value={draft.montant} onChange={v => setDraft(d => ({ ...d, montant: v }))} placeholder="450" />
              <div>
                <label className="block text-xs font-semibold mb-1 text-muted">Prochaine relance</label>
                <input type="date" value={draft.relance} onChange={e => setDraft(d => ({ ...d, relance: e.target.value }))} className={FIELD} />
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-semibold mb-1 text-muted">Notes</label>
                <textarea value={draft.notes} onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} rows={5}
                  placeholder="Ce qui s'est dit, ce qu'il faut redire au prochain appel…" className={`${FIELD} resize-y`} />
              </div>
            </div>

            <div className="flex justify-end gap-2 px-5 py-4 border-t border-line">
              <button onClick={() => setEditing(null)} className="px-4 py-2 rounded-xl text-sm border border-line text-muted">Annuler</button>
              <button onClick={save} disabled={busy || !draft.nom.trim()}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-gold text-ink disabled:opacity-50">
                {busy ? '…' : 'Enregistrer'}
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border bg-card px-4 py-3 ${accent ? 'border-gold' : 'border-line'}`}>
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="text-2xl font-bold mt-0.5 text-ink">{value}</p>
      <p className="text-[11px] h-4 text-gold-ink">{sub ?? ''}</p>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, required, className }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; required?: boolean; className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-xs font-semibold mb-1 text-muted">
        {label}{required && <span className="text-danger"> *</span>}
      </label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={FIELD} />
    </div>
  );
}
