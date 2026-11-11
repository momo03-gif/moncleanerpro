'use client';

// ── Grille de prestations (admin) ─────────────────────────────────────────────
//
// Les 70+ prestations rangées EXACTEMENT comme le client les voit sur la page de
// devis : par carte (Résidentiel, Airbnb, Professionnel…), puis par section.
// Une liste à plat obligeait à chercher ; ici on ouvre la carte concernée.
//
// Le classement vient de `classify()`, le même que la page publique — impossible
// que l'admin range autrement que ce que voit le visiteur.
//
// L'écriture passe par /api/admin/tarifs : la table était modifiable avec la clé
// publique, celle qui part dans le navigateur.
//
// C'est le SEUL endroit où la grille se modifie (import CSV compris) : l'ancien
// éditeur de l'écran Devis appliquait d'autres règles et finissait par diverger.

import { useState, useMemo, useRef, type ChangeEvent, type Dispatch, type SetStateAction } from 'react';
import { classify, MACRO_DEF, SECTION_ORDER, isHiddenPublic, displayName } from '@/lib/devisCatalog';
import { UNITE_LABEL, type Tarif, type TarifUnite } from '@/lib/devis';
import { parseTarifsCsv, CSV_TEMPLATE } from '@/lib/tarifsCsv';
import { lireMontant, erreurFourchette, prixReferenceParDefaut, referenceHorsFourchette } from '@/lib/montant';
import { useFeedback } from '@/contexts/FeedbackContext';
import Icon from '@/components/Icon';

const FIELD = 'w-full px-2.5 py-1.5 rounded-lg text-sm border border-line bg-card text-ink';
const UNITES: TarifUnite[] = ['forfait', 'm2', 'heure', 'piece'];

interface Group { macroId: string; title: string; sections: { title: string; items: Tarif[] }[] }

/** Regroupe comme la page publique, mais SANS rien masquer : l'admin voit tout. */
function groupForAdmin(tarifs: Tarif[]): Group[] {
  const buckets = new Map<string, Map<string, Tarif[]>>();
  for (const t of tarifs) {
    const { macro, section } = classify(t);
    const sec = buckets.get(macro) ?? buckets.set(macro, new Map()).get(macro)!;
    (sec.get(section) ?? sec.set(section, []).get(section)!).push(t);
  }
  const out: Group[] = [];
  for (const m of MACRO_DEF) {
    const sec = buckets.get(m.id);
    if (!sec) continue;
    const order = SECTION_ORDER[m.id] ?? [...sec.keys()];
    const titles = [...order.filter(t => sec.has(t)), ...[...sec.keys()].filter(t => !order.includes(t))];
    out.push({
      macroId: m.id, title: m.title,
      sections: titles.map(title => ({
        title,
        items: sec.get(title)!.sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
      })),
    });
  }
  return out;
}

export default function PrestationsTab({ tarifs, onChanged }: { tarifs: Tarif[]; onChanged: () => void }) {
  const { toast, confirm } = useFeedback();
  const [open, setOpen] = useState<string | null>(MACRO_DEF[0]?.id ?? null);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tarifs;
    return tarifs.filter(t => t.nom.toLowerCase().includes(q) || (t.motsCles ?? '').toLowerCase().includes(q));
  }, [tarifs, search]);

  const groups = useMemo(() => groupForAdmin(filtered), [filtered]);

  // Prix de référence sortis de leur fourchette : souvent un reste d'anciennes
  // saisies. Signalés, jamais corrigés d'office (ils servent au kit de linge).
  const horsFourchette = useMemo(
    () => tarifs.filter(t => referenceHorsFourchette(t.prix, t.prixMin ?? null, t.prixMax ?? null)),
    [tarifs],
  );

  async function send(payload: Record<string, unknown>) {
    setBusy(true);
    const res = await fetch('/api/admin/tarifs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok || !data.ok) { toast(data.error ?? 'Enregistrement impossible.', 'error'); return null; }
    onChanged();
    return data as { ok: true; inserted?: number; updated?: number };
  }

  async function remove(t: Tarif) {
    const ok = await confirm({
      title: 'Supprimer cette prestation ?',
      message: `« ${t.nom} » disparaîtra de la page de devis et de l'agent d'estimation. Les devis déjà envoyés ne changent pas.`,
      confirmLabel: 'Supprimer', danger: true,
    });
    if (ok) await send({ action: 'delete', id: t.id });
  }

  // La recherche ouvre tout : on cherche justement parce qu'on ne sait pas où c'est.
  const searching = search.trim().length > 0;

  return (
    <div className="space-y-3">
      <ImportCsv busy={busy} onImport={rows => send({ action: 'import', rows })} />

      {horsFourchette.length > 0 && (
        <div className="rounded-2xl border border-warn-line bg-warn-soft px-4 py-3">
          <p className="text-sm font-semibold text-warn">
            {horsFourchette.length} prestation{horsFourchette.length > 1 ? 's ont' : ' a'} un prix de référence en dehors de sa fourchette
          </p>
          <p className="text-xs mt-1 text-muted">
            Ce prix sert quand vous ajoutez la prestation à un devis à la main, et pour le prix du kit de linge.
            À vérifier : {horsFourchette.map(t => displayName(t)).join(' · ')}.
          </p>
        </div>
      )}

      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-faint pointer-events-none"><Icon name="search" size={15} /></span>
        <input value={search} onChange={e => setSearch(e.target.value)} type="search"
          placeholder="Chercher une prestation ou un mot-clé…"
          className="w-full pl-9 pr-3 py-2 rounded-lg text-sm border border-line bg-card text-ink" />
      </div>

      {groups.length === 0 && (
        <p className="text-sm py-8 text-center text-muted">Aucune prestation ne correspond.</p>
      )}

      {groups.map(g => {
        const total = g.sections.reduce((s, x) => s + x.items.length, 0);
        const isOpen = searching || open === g.macroId;
        return (
          <div key={g.macroId} className="rounded-2xl border border-line bg-card overflow-hidden">
            <button onClick={() => setOpen(open === g.macroId ? null : g.macroId)}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left">
              <span className="font-semibold text-ink">{g.title}</span>
              <span className="text-xs flex items-center gap-2 text-muted">
                {total} prestation{total > 1 ? 's' : ''}
                <span className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}><Icon name="chevronDown" size={14} /></span>
              </span>
            </button>

            {isOpen && (
              <div className="px-4 pb-4 space-y-4">
                {g.sections.map(s => (
                  <div key={s.title}>
                    <p className="text-[11px] font-semibold uppercase tracking-wider mb-1.5 text-faint">{s.title}</p>
                    <div className="space-y-1.5">
                      {s.items.map(t => (
                        <TarifRow key={t.id} tarif={t} busy={busy}
                          editing={editing === t.id}
                          onEdit={() => setEditing(editing === t.id ? null : t.id)}
                          onSave={patch => send({ action: 'save', tarif: { id: t.id, ...patch } }).then(r => { if (r) setEditing(null); })}
                          onRemove={() => remove(t)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <NewTarif busy={busy} onCreate={t => send({ action: 'save', tarif: t })} />
    </div>
  );
}

// ── Prix : lecture et contrôle ────────────────────────────────────────────────
interface PrixDraft { unite: TarifUnite; prixMin: string; prixMax: string; prixRef: string }

/** Contrôle les champs prix. Rien n'est enregistré tant qu'un champ est illisible. */
function lirePrix(d: PrixDraft): { prixMin: number | null; prixMax: number | null; prix: number } | { erreur: string } {
  const min = lireMontant(d.prixMin, 'Le prix « de »');
  if (!min.ok) return { erreur: min.erreur };
  const max = lireMontant(d.prixMax, 'Le prix « à »');
  if (!max.ok) return { erreur: max.erreur };
  const four = erreurFourchette(min.valeur, max.valeur);
  if (four) return { erreur: four };
  const ref = lireMontant(d.prixRef, 'Le prix de référence');
  if (!ref.ok) return { erreur: ref.erreur };
  // Vide = milieu de la fourchette : la même règle que l'import CSV.
  const prix = ref.valeur ?? prixReferenceParDefaut(min.valeur, max.valeur) ?? 0;
  return { prixMin: min.valeur, prixMax: max.valeur, prix };
}

function ChampsPrix<T extends PrixDraft>({ draft, setDraft }: { draft: T; setDraft: Dispatch<SetStateAction<T>> }) {
  const min = lireMontant(draft.prixMin), max = lireMontant(draft.prixMax);
  const defaut = min.ok && max.ok ? prixReferenceParDefaut(min.valeur, max.valeur) : null;
  return (
    <div className="flex gap-2 flex-wrap items-end">
      <div>
        <label className="block text-[10px] font-semibold mb-0.5 text-muted">Unité</label>
        <select className={`${FIELD} w-32`} value={draft.unite}
          onChange={e => setDraft(d => ({ ...d, unite: e.target.value as TarifUnite }))}>
          {UNITES.map(u => <option key={u} value={u}>{UNITE_LABEL[u] ?? u}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-[10px] font-semibold mb-0.5 text-muted">Prix de</label>
        <input className={`${FIELD} w-24`} value={draft.prixMin} inputMode="decimal" placeholder="sur devis"
          onChange={e => setDraft(d => ({ ...d, prixMin: e.target.value }))} />
      </div>
      <div>
        <label className="block text-[10px] font-semibold mb-0.5 text-muted">à</label>
        <input className={`${FIELD} w-24`} value={draft.prixMax} inputMode="decimal" placeholder="prix ferme"
          onChange={e => setDraft(d => ({ ...d, prixMax: e.target.value }))} />
      </div>
      <div>
        <label className="block text-[10px] font-semibold mb-0.5 text-muted">Prix de référence</label>
        <input className={`${FIELD} w-32`} value={draft.prixRef} inputMode="decimal"
          placeholder={defaut != null ? `${defaut} (milieu)` : '—'}
          onChange={e => setDraft(d => ({ ...d, prixRef: e.target.value }))} />
      </div>
      <p className="basis-full text-[11px] text-faint">
        Le visiteur voit la fourchette. Le prix de référence sert aux devis faits à la main et
        au kit de linge ; laissé vide, c&apos;est le milieu de la fourchette.
      </p>
    </div>
  );
}

/** Où la prestation sera rangée sur la page de devis, d'après son nom. */
function Rangement({ nom, avant }: { nom: string; avant?: Tarif }) {
  if (!nom.trim()) return null;
  const essai: Tarif = { ...(avant ?? { id: '', unite: 'forfait', prix: 0, actif: true }), nom };
  const { macro, section } = classify(essai);
  const titre = MACRO_DEF.find(m => m.id === macro)?.title ?? macro;
  const change = avant != null && classify(avant).macro !== macro;
  return (
    <p className={`text-[11px] ${change ? 'text-warn' : 'text-muted'}`}>
      Rangée dans : <span className="font-semibold">{titre} › {section}</span>
      {change && ' — elle changera de carte sur la page de devis'}
      {isHiddenPublic(essai) && <span className="text-warn"> · non visible en ligne</span>}
    </p>
  );
}

// ── Une prestation ────────────────────────────────────────────────────────────
function TarifRow({ tarif, busy, editing, onEdit, onSave, onRemove }: {
  tarif: Tarif; busy: boolean; editing: boolean;
  onEdit: () => void;
  onSave: (patch: Record<string, unknown>) => void;
  onRemove: () => void;
}) {
  const initial = () => ({
    nom: tarif.nom,
    unite: tarif.unite,
    prixMin: tarif.prixMin != null ? String(tarif.prixMin) : '',
    prixMax: tarif.prixMax != null ? String(tarif.prixMax) : '',
    // Le prix de référence est montré tel qu'il est en base. Avant, enregistrer
    // la prestation le remplaçait en douce par le prix « de ».
    prixRef: tarif.prix > 0 ? String(tarif.prix) : '',
    motsCles: tarif.motsCles ?? '',
  });
  const [draft, setDraft] = useState(initial);
  const [erreur, setErreur] = useState<string | null>(null);

  const aFourchette = tarif.prixMin != null || tarif.prixMax != null;
  const prix = aFourchette
    ? (tarif.prixMin != null && tarif.prixMax != null ? `${tarif.prixMin} – ${tarif.prixMax} €` : `${tarif.prixMin ?? tarif.prixMax} €`)
    : tarif.prix > 0 ? `${tarif.prix} €` : 'sur devis';
  const hors = referenceHorsFourchette(tarif.prix, tarif.prixMin ?? null, tarif.prixMax ?? null);

  if (!editing) {
    return (
      <div className={`rounded-xl border px-3 py-2 flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-1.5 ${tarif.actif ? 'border-line bg-card' : 'border-dashed border-line bg-surface-2'}`}>
        {/* Sur téléphone, le nom prend toute la ligne et les boutons passent dessous. */}
        <div className="basis-full sm:basis-auto flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${tarif.actif ? 'text-ink' : 'text-faint'}`}>
            {displayName(tarif)}
            {!tarif.actif && <span className="text-[10px] ml-2 text-faint">désactivée</span>}
            {isHiddenPublic(tarif) && <span className="text-[10px] ml-2 text-warn">non visible en ligne</span>}
          </p>
          {tarif.motsCles && <p className="text-[11px] truncate text-faint">{tarif.motsCles}</p>}
        </div>
        <span className="sm:text-right shrink-0 whitespace-nowrap mr-auto sm:mr-0">
          <span className="block text-xs text-muted">{prix}</span>
          {aFourchette && tarif.prix > 0 && (
            <span className={`block text-[10px] ${hors ? 'text-warn font-semibold' : 'text-faint'}`}
              title={hors ? 'Prix de référence en dehors de la fourchette' : 'Prix de référence (devis manuel, kit de linge)'}>
              réf. {tarif.prix} €{hors && ' — hors fourchette'}
            </span>
          )}
        </span>
        <span className="text-[10px] shrink-0 text-faint">{UNITE_LABEL[tarif.unite] ?? tarif.unite}</span>
        {/* Une seule action sur la ligne : désactiver et supprimer sont dans
            « Modifier ». Trois boutons par ligne rendaient la liste illisible. */}
        <button onClick={() => { setDraft(initial()); setErreur(null); onEdit(); }}
          className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-line text-muted shrink-0">Modifier</button>
      </div>
    );
  }

  function save() {
    const p = lirePrix(draft);
    if ('erreur' in p) { setErreur(p.erreur); return; }
    setErreur(null);
    onSave({ nom: draft.nom.trim(), unite: draft.unite, ...p, motsCles: draft.motsCles });
  }

  return (
    <div className="rounded-xl border border-gold bg-gold-soft px-3 py-3 space-y-2">
      <input className={FIELD} value={draft.nom} onChange={e => setDraft(d => ({ ...d, nom: e.target.value }))} />
      <Rangement nom={draft.nom} avant={tarif} />
      <ChampsPrix draft={draft} setDraft={setDraft} />
      <input className={FIELD} value={draft.motsCles} placeholder="Mots-clés — servent à l'agent d'estimation"
        onChange={e => setDraft(d => ({ ...d, motsCles: e.target.value }))} />
      {erreur && <p className="text-xs font-semibold text-danger">{erreur}</p>}
      <div className="flex gap-2 flex-wrap items-center">
        <button disabled={busy || !draft.nom.trim()} onClick={save}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gold text-ink disabled:opacity-50">Enregistrer</button>
        <button onClick={onEdit} className="px-3 py-1.5 rounded-lg text-xs border border-line text-muted">Annuler</button>
        <span className="flex gap-2 ml-auto">
          {/* Désactiver = retirer de la page de devis sans perdre la ligne. */}
          <button onClick={() => onSave({ actif: !tarif.actif })} disabled={busy}
            title={tarif.actif ? 'Retirer de la page de devis sans la supprimer' : 'Remettre sur la page de devis'}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${tarif.actif ? 'border-line text-muted' : 'border-gold text-gold-ink'}`}>
            {tarif.actif ? 'Désactiver' : 'Réactiver'}
          </button>
          <button onClick={onRemove} disabled={busy}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-danger-line text-danger">Supprimer</button>
        </span>
      </div>
    </div>
  );
}

// ── Ajout ─────────────────────────────────────────────────────────────────────
function NewTarif({ busy, onCreate }: { busy: boolean; onCreate: (t: Record<string, unknown>) => Promise<unknown> }) {
  const vide = () => ({ nom: '', unite: 'forfait' as TarifUnite, prixMin: '', prixMax: '', prixRef: '', motsCles: '' });
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(vide);
  const [erreur, setErreur] = useState<string | null>(null);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full py-3 rounded-xl text-sm font-semibold border border-dashed border-line text-muted">
        + Ajouter une prestation
      </button>
    );
  }

  async function create() {
    const p = lirePrix(draft);
    if ('erreur' in p) { setErreur(p.erreur); return; }
    setErreur(null);
    // Le formulaire ne se vide que si l'enregistrement a réussi : avant, une
    // erreur faisait perdre la saisie.
    const r = await onCreate({ nom: draft.nom.trim(), unite: draft.unite, ...p, motsCles: draft.motsCles });
    if (r) { setDraft(vide()); setOpen(false); }
  }

  return (
    <div className="rounded-2xl border border-gold bg-gold-soft p-4 space-y-2">
      <input className={FIELD} value={draft.nom} autoFocus placeholder="Nom de la prestation"
        onChange={e => setDraft(d => ({ ...d, nom: e.target.value }))} />
      {draft.nom.trim()
        ? <Rangement nom={draft.nom} />
        : <p className="text-[11px] text-muted">
            Elle sera rangée automatiquement d&apos;après son nom — « Nettoyage vitres » ira dans
            Vitres · Sols · Textiles, « Entretien classique - T6 » dans Résidentiel.
          </p>}
      <ChampsPrix draft={draft} setDraft={setDraft} />
      <input className={FIELD} value={draft.motsCles} placeholder="Mots-clés (facultatif)"
        onChange={e => setDraft(d => ({ ...d, motsCles: e.target.value }))} />
      {erreur && <p className="text-xs font-semibold text-danger">{erreur}</p>}
      <div className="flex gap-2">
        <button disabled={busy || !draft.nom.trim()} onClick={create}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gold text-ink disabled:opacity-50">Ajouter</button>
        <button onClick={() => { setOpen(false); setErreur(null); }} className="px-3 py-1.5 rounded-lg text-xs border border-line text-muted">Annuler</button>
      </div>
    </div>
  );
}

// ── Import CSV ────────────────────────────────────────────────────────────────
// Rapatrié de l'écran Devis : toute la grille se gère depuis Tarification.
function ImportCsv({ busy, onImport }: {
  busy: boolean;
  onImport: (rows: unknown[]) => Promise<{ inserted?: number; updated?: number } | null>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [open, setOpen] = useState(false);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setMsg(null);
    try {
      const { rows, errors } = parseTarifsCsv(await file.text());
      if (rows.length === 0) { setMsg({ text: errors[0] ?? 'Aucune ligne trouvée.', ok: false }); return; }
      const r = await onImport(rows);
      if (r) setMsg({ text: `Import réussi : ${r.inserted ?? 0} ajoutée(s), ${r.updated ?? 0} mise(s) à jour.`, ok: true });
    } catch {
      setMsg({ text: 'Fichier illisible. Vérifiez qu’il s’agit bien d’un CSV.', ok: false });
    }
  }

  function downloadTemplate() {
    const blob = new Blob(['﻿' + CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'modele-grille-tarifs.csv';
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="rounded-2xl border border-line bg-surface-2">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left">
        <span className="text-sm font-semibold text-ink">Importer la grille depuis Excel (CSV)</span>
        <span className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`}><Icon name="chevronDown" size={14} /></span>
      </button>
      {open && (
        <div className="px-4 pb-4">
          <p className="text-[11px] mb-3 text-muted">
            Colonnes : Prestation ; Unité ; Prix ; Mots-clés ; Actif. Le prix accepte une fourchette (« 40-70 »).
            Les prestations existantes sont mises à jour par leur nom, sans doublon, et leur prix de référence
            repasse au milieu de la fourchette. Une prestation désactivée le reste, sauf si la colonne Actif dit « oui ».
          </p>
          <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => fileRef.current?.click()} disabled={busy}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-gold text-ink disabled:opacity-50">
              {busy ? 'Import…' : 'Importer un fichier CSV'}
            </button>
            <button onClick={downloadTemplate} className="px-4 py-2 rounded-xl text-sm font-semibold border border-line text-muted">
              Télécharger le modèle
            </button>
          </div>
          {msg && <p className={`text-xs mt-2 ${msg.ok ? 'text-success' : 'text-danger'}`}>{msg.text}</p>}
        </div>
      )}
    </div>
  );
}
