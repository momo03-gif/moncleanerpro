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

import { useState, useMemo } from 'react';
import { classify, MACRO_DEF, SECTION_ORDER, isHiddenPublic, displayName } from '@/lib/devisCatalog';
import { UNITE_LABEL, type Tarif, type TarifUnite } from '@/lib/devis';
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

  async function send(payload: Record<string, unknown>) {
    setBusy(true);
    const res = await fetch('/api/admin/tarifs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok || !data.ok) { toast(data.error ?? 'Enregistrement impossible.', 'error'); return null; }
    onChanged();
    return data;
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

// ── Une prestation ────────────────────────────────────────────────────────────
function TarifRow({ tarif, busy, editing, onEdit, onSave, onRemove }: {
  tarif: Tarif; busy: boolean; editing: boolean;
  onEdit: () => void;
  onSave: (patch: Record<string, unknown>) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState({
    nom: tarif.nom,
    unite: tarif.unite,
    prixMin: tarif.prixMin != null ? String(tarif.prixMin) : '',
    prixMax: tarif.prixMax != null ? String(tarif.prixMax) : '',
    motsCles: tarif.motsCles ?? '',
  });

  const num = (s: string) => (s === '' ? null : parseFloat(s.replace(',', '.')) || 0);
  const prix = tarif.prixMin != null || tarif.prixMax != null
    ? `${tarif.prixMin ?? '?'} – ${tarif.prixMax ?? '?'} €`
    : tarif.prix > 0 ? `${tarif.prix} €` : 'sur devis';

  if (!editing) {
    return (
      <div className={`rounded-xl border px-3 py-2 flex items-center gap-3 ${tarif.actif ? 'border-line bg-card' : 'border-dashed border-line bg-surface-2'}`}>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${tarif.actif ? 'text-ink' : 'text-faint'}`}>
            {displayName(tarif)}
            {!tarif.actif && <span className="text-[10px] ml-2 text-faint">désactivée</span>}
            {isHiddenPublic(tarif) && <span className="text-[10px] ml-2 text-warn">non visible en ligne</span>}
          </p>
          {tarif.motsCles && <p className="text-[11px] truncate text-faint">{tarif.motsCles}</p>}
        </div>
        <span className="text-xs shrink-0 whitespace-nowrap text-muted">{prix}</span>
        <span className="text-[10px] shrink-0 text-faint">{UNITE_LABEL[tarif.unite] ?? tarif.unite}</span>
        <button onClick={() => onSave({ actif: !tarif.actif })} disabled={busy}
          className={`text-[11px] font-semibold px-2 py-1 rounded shrink-0 border ${tarif.actif ? 'border-line text-muted' : 'border-gold text-gold-ink'}`}>
          {tarif.actif ? 'Active' : 'Réactiver'}
        </button>
        <button onClick={onEdit} className="text-xs font-semibold px-2 py-1 rounded border border-line text-muted shrink-0">Modifier</button>
        <button onClick={onRemove} aria-label={`Supprimer ${tarif.nom}`} className="text-danger px-1 shrink-0"><Icon name="close" size={14} /></button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gold bg-gold-soft px-3 py-3 space-y-2">
      <input className={FIELD} value={draft.nom} onChange={e => setDraft(d => ({ ...d, nom: e.target.value }))} />
      <div className="flex gap-2 flex-wrap">
        <select className={`${FIELD} w-32`} value={draft.unite}
          onChange={e => setDraft(d => ({ ...d, unite: e.target.value as TarifUnite }))}>
          {UNITES.map(u => <option key={u} value={u}>{UNITE_LABEL[u] ?? u}</option>)}
        </select>
        <input className={`${FIELD} w-24`} value={draft.prixMin} inputMode="decimal" placeholder="prix de"
          onChange={e => setDraft(d => ({ ...d, prixMin: e.target.value }))} />
        <input className={`${FIELD} w-24`} value={draft.prixMax} inputMode="decimal" placeholder="à"
          onChange={e => setDraft(d => ({ ...d, prixMax: e.target.value }))} />
      </div>
      <input className={FIELD} value={draft.motsCles} placeholder="Mots-clés — servent à l'agent d'estimation"
        onChange={e => setDraft(d => ({ ...d, motsCles: e.target.value }))} />
      <div className="flex gap-2">
        <button disabled={busy || !draft.nom.trim()}
          onClick={() => onSave({
            nom: draft.nom, unite: draft.unite,
            prixMin: num(draft.prixMin), prixMax: num(draft.prixMax),
            // `prix` reste la valeur de référence quand il n'y a pas de fourchette.
            prix: num(draft.prixMin) ?? 0,
            motsCles: draft.motsCles,
          })}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gold text-ink disabled:opacity-50">Enregistrer</button>
        <button onClick={onEdit} className="px-3 py-1.5 rounded-lg text-xs border border-line text-muted">Annuler</button>
      </div>
    </div>
  );
}

// ── Ajout ─────────────────────────────────────────────────────────────────────
function NewTarif({ busy, onCreate }: { busy: boolean; onCreate: (t: Record<string, unknown>) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ nom: '', unite: 'forfait' as TarifUnite, prixMin: '', prixMax: '', motsCles: '' });
  const num = (s: string) => (s === '' ? null : parseFloat(s.replace(',', '.')) || 0);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full py-3 rounded-xl text-sm font-semibold border border-dashed border-line text-muted">
        + Ajouter une prestation
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-gold bg-gold-soft p-4 space-y-2">
      <input className={FIELD} value={draft.nom} autoFocus placeholder="Nom de la prestation"
        onChange={e => setDraft(d => ({ ...d, nom: e.target.value }))} />
      <p className="text-[11px] text-muted">
        Elle sera rangée automatiquement d&apos;après son nom — « Nettoyage vitres » ira dans
        Vitres · Sols · Textiles, « Entretien classique - T6 » dans Résidentiel.
      </p>
      <div className="flex gap-2 flex-wrap">
        <select className={`${FIELD} w-32`} value={draft.unite}
          onChange={e => setDraft(d => ({ ...d, unite: e.target.value as TarifUnite }))}>
          {UNITES.map(u => <option key={u} value={u}>{UNITE_LABEL[u] ?? u}</option>)}
        </select>
        <input className={`${FIELD} w-24`} value={draft.prixMin} inputMode="decimal" placeholder="prix de"
          onChange={e => setDraft(d => ({ ...d, prixMin: e.target.value }))} />
        <input className={`${FIELD} w-24`} value={draft.prixMax} inputMode="decimal" placeholder="à"
          onChange={e => setDraft(d => ({ ...d, prixMax: e.target.value }))} />
      </div>
      <input className={FIELD} value={draft.motsCles} placeholder="Mots-clés (facultatif)"
        onChange={e => setDraft(d => ({ ...d, motsCles: e.target.value }))} />
      <div className="flex gap-2">
        <button disabled={busy || !draft.nom.trim()}
          onClick={() => {
            onCreate({
              nom: draft.nom, unite: draft.unite,
              prixMin: num(draft.prixMin), prixMax: num(draft.prixMax),
              prix: num(draft.prixMin) ?? 0, motsCles: draft.motsCles,
            });
            setDraft({ nom: '', unite: 'forfait', prixMin: '', prixMax: '', motsCles: '' });
            setOpen(false);
          }}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gold text-ink disabled:opacity-50">Ajouter</button>
        <button onClick={() => setOpen(false)} className="px-3 py-1.5 rounded-lg text-xs border border-line text-muted">Annuler</button>
      </div>
    </div>
  );
}
