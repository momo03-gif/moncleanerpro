'use client';

// ── Tarification du simulateur de devis (admin) ───────────────────────────────
//
// C'est ici que se décide ce que voit un visiteur dans le simulateur Airbnb :
// quelles zones existent, quelles communes en font partie, quel supplément
// s'applique, et à quel prix commence chaque taille de logement.
//
// Rien n'est écrit depuis le navigateur : les tables sont en lecture seule pour
// la clé publique, et chaque enregistrement passe par /api/admin/devis-config,
// qui vérifie la session.

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import { getSimulatorConfigDB, type SimulatorConfig, type QuoteOption } from '@/lib/devisConfig';
import { lireMontant, lireEntier, erreurFourchette } from '@/lib/montant';
import { getTarifsDB, type Tarif } from '@/lib/devis';
import PrestationsTab from './PrestationsTab';
import GrilleAirbnbPdf from './GrilleAirbnbPdf';
import ApercuDevis from './ApercuDevis';
import { useFeedback } from '@/contexts/FeedbackContext';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';

const FIELD = 'w-full px-3 py-2 rounded-lg text-sm border border-line bg-card text-ink';

export default function TarificationClient() {
  const { toast, confirm } = useFeedback();
  const [config, setConfig] = useState<SimulatorConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'prestations' | 'zones' | 'tiers' | 'options' | 'reglages'>('prestations');
  const [tarifs, setTarifs] = useState<Tarif[]>([]);

  const load = useCallback(async () => {
    const [cfg, t] = await Promise.all([getSimulatorConfigDB(), getTarifsDB()]);
    setConfig(cfg); setTarifs(t);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function send(payload: Record<string, unknown>) {
    const res = await fetch('/api/admin/devis-config', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) { toast(data.error ?? 'Enregistrement impossible.', 'error'); return false; }
    await load();
    return true;
  }

  if (loading) return <Loading className="p-6 text-sm" />;

  return (
    <div className="p-4 sm:p-6 max-w-4xl">
      <h1 className="text-xl font-bold text-ink">Tarification</h1>
      <p className="text-sm mt-1 text-muted">
        Tous les prix du site en un seul endroit : les prestations de chaque carte de la
        page de devis, et le barème du simulateur Airbnb. Toute modification est visible
        immédiatement sur le site.
      </p>

      {/* Une seule rangée d'onglets, coupée en deux par un séparateur : ce qui
          vaut pour TOUTES les cartes de la page de devis, puis ce qui n'appartient
          qu'à la carte Airbnb & Conciergerie. La phrase sous les onglets rappelle
          la portée de l'onglet ouvert — à plat et sans elle, on croyait régler
          des paramètres généraux. */}
      <div className="mt-5 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Onglet actif={tab === 'prestations'} onClick={() => setTab('prestations')}>Prestations</Onglet>
          <span className="hidden sm:block w-px h-6 mx-1 bg-line" aria-hidden />
          <span className="basis-full sm:basis-auto text-[11px] font-semibold uppercase tracking-wider text-faint sm:mr-1">Airbnb</span>
          {([['tiers', 'Paliers'], ['zones', 'Zones'], ['options', 'Options'],
             ['reglages', 'Salles de bain & surface']] as const).map(([id, label]) => (
            <Onglet key={id} actif={tab === id} onClick={() => setTab(id)}>{label}</Onglet>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap mt-3 pt-3 border-t border-hairline">
          <p className="text-xs text-muted">
            {tab === 'prestations'
              ? 'Les prix de toutes les cartes de la page de devis.'
              : 'Le barème du simulateur : il ne s’applique qu’à la carte « Airbnb & Conciergerie ».'}
          </p>
          {tab !== 'prestations' && config && <GrilleAirbnbPdf config={config} />}
        </div>
      </div>

      {tab === 'prestations' && <PrestationsTab tarifs={tarifs} onChanged={load} />}

      {/* Les trois onglets du simulateur Airbnb ont besoin de sa configuration. */}
      {tab !== 'prestations' && !config ? (
        <div className="rounded-2xl border border-warn-line bg-warn-soft p-5">
          <p className="text-sm text-warn">
            Le barème du simulateur n&apos;est pas encore en base. Exécutez{' '}
            <code>supabase/migration_devis_simulateur.sql</code> dans Supabase.
          </p>
        </div>
      ) : config && tab !== 'prestations' && (
        <>
          {/* Visible sur les quatre onglets du simulateur : on règle, on voit le prix. */}
          <ApercuDevis config={config} />
          {tab === 'zones' && <ZonesTab config={config} send={send} confirm={confirm} />}
          {tab === 'tiers' && <TiersTab config={config} send={send} confirm={confirm} />}
          {tab === 'options' && <OptionsTab config={config} send={send} confirm={confirm} />}
          {tab === 'reglages' && <ReglagesTab config={config} send={send} />}
        </>
      )}
    </div>
  );
}

function Onglet({ actif, onClick, children }: { actif: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={actif}
      className={`text-sm font-semibold px-3.5 py-1.5 rounded-xl border ${actif ? 'border-gold bg-gold-soft text-gold-ink' : 'border-line bg-card text-muted'}`}>
      {children}
    </button>
  );
}

type Send = (p: Record<string, unknown>) => Promise<boolean>;
type Confirm = ReturnType<typeof useFeedback>['confirm'];

// ── Zones tarifaires ──────────────────────────────────────────────────────────
function ZonesTab({ config, send, confirm }: { config: SimulatorConfig; send: Send; confirm: Confirm }) {
  const { toast } = useFeedback();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ name: '', fee: '0', communes: '' });
  const [busy, setBusy] = useState(false);

  function open(zoneId: string | null) {
    const z = config.zones.find(x => x.id === zoneId);
    setDraft({
      name: z?.name ?? '',
      fee: String(z?.fee ?? 0),
      // Une commune par ligne : c'est la façon la plus simple d'en ajouter ou
      // d'en retirer sans interface compliquée.
      communes: (z?.communes ?? []).join('\n'),
    });
    setEditing(zoneId ?? 'new');
  }

  async function save() {
    const fee = lireMontant(draft.fee, 'Le supplément');
    if (!fee.ok) { toast(fee.erreur, 'error'); return; }
    setBusy(true);
    const ok = await send({
      action: 'zone.save',
      zone: {
        id: editing === 'new' ? undefined : editing,
        name: draft.name,
        fee: fee.valeur ?? 0,
        communes: draft.communes.split('\n').map(s => s.trim()).filter(Boolean),
        position: editing === 'new' ? config.zones.length : undefined,
      },
    });
    setBusy(false);
    if (ok) setEditing(null);
  }

  async function remove(id: string, name: string) {
    const ok = await confirm({
      title: 'Supprimer cette zone ?',
      message: `« ${name} » disparaîtra du simulateur. Les devis déjà envoyés ne changent pas.`,
      confirmLabel: 'Supprimer', danger: true,
    });
    if (ok) await send({ action: 'zone.delete', id });
  }

  // Une commune listée dans deux zones : le visiteur tombe sur la première
  // trouvée, pas forcément celle voulue. Signalé, à corriger à la main.
  const doublons = communesEnDouble(config.zones);

  return (
    <div className="space-y-3">
      {doublons.length > 0 && (
        <div className="rounded-2xl border border-warn-line bg-warn-soft px-4 py-3">
          <p className="text-sm font-semibold text-warn">Commune présente dans plusieurs zones</p>
          <p className="text-xs mt-1 text-muted">
            {doublons.map(d => `${d.commune} (${d.zones.join(', ')})`).join(' · ')}.
            Le visiteur sera rangé dans la première zone trouvée.
          </p>
        </div>
      )}
      {config.zones.map(z => (
        <div key={z.id} className="rounded-2xl border border-line bg-card p-4">
          {editing === z.id ? (
            <ZoneForm draft={draft} setDraft={setDraft} busy={busy} onSave={save} onCancel={() => setEditing(null)} />
          ) : (
            <>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{z.name}</p>
                  <p className="text-xs mt-0.5 text-muted">
                    {z.fee > 0 ? `+${z.fee} € par intervention` : 'aucun supplément'} · {z.communes.length} commune{z.communes.length > 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => open(z.id)} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-line text-muted">Modifier</button>
                  <button onClick={() => remove(z.id, z.name)} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-danger-line text-danger">Supprimer</button>
                </div>
              </div>
              <p className="text-xs mt-2 leading-relaxed text-faint">{z.communes.join(' · ') || 'Aucune commune renseignée'}</p>
            </>
          )}
        </div>
      ))}

      {editing === 'new' ? (
        <div className="rounded-2xl border border-gold bg-gold-soft p-4">
          <ZoneForm draft={draft} setDraft={setDraft} busy={busy} onSave={save} onCancel={() => setEditing(null)} />
        </div>
      ) : (
        <button onClick={() => open(null)} className="w-full py-3 rounded-xl text-sm font-semibold border border-dashed border-line text-muted">
          + Ajouter une zone
        </button>
      )}
    </div>
  );
}

// Même normalisation que la recherche du simulateur (casse et accents ignorés).
const normCommune = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

function communesEnDouble(zones: SimulatorConfig['zones']): { commune: string; zones: string[] }[] {
  const vues = new Map<string, { commune: string; zones: string[] }>();
  for (const z of zones) {
    for (const c of z.communes) {
      const k = normCommune(c);
      if (!k) continue;
      const e = vues.get(k) ?? vues.set(k, { commune: c, zones: [] }).get(k)!;
      if (!e.zones.includes(z.name)) e.zones.push(z.name);
    }
  }
  return [...vues.values()].filter(e => e.zones.length > 1);
}

function ZoneForm({ draft, setDraft, busy, onSave, onCancel }: {
  draft: { name: string; fee: string; communes: string };
  setDraft: (f: (d: { name: string; fee: string; communes: string }) => { name: string; fee: string; communes: string }) => void;
  busy: boolean; onSave: () => void; onCancel: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold mb-1 text-muted">Nom de la zone</label>
          <input value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
            placeholder="Lyon intramuros" className={FIELD} />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1 text-muted">Supplément (€)</label>
          <input value={draft.fee} onChange={e => setDraft(d => ({ ...d, fee: e.target.value }))}
            inputMode="decimal" placeholder="0" className={FIELD} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold mb-1 text-muted">Communes — une par ligne</label>
        <textarea value={draft.communes} onChange={e => setDraft(d => ({ ...d, communes: e.target.value }))}
          rows={6} placeholder={'Villeurbanne\nCaluire-et-Cuire\nBron'}
          className={`${FIELD} resize-y font-mono text-[13px]`} />
        <p className="text-[11px] mt-1 text-faint">
          Le visiteur tape sa commune et sa zone est reconnue automatiquement.
        </p>
      </div>
      <div className="flex gap-2">
        <button onClick={onSave} disabled={busy || !draft.name.trim()}
          className="px-4 py-2 rounded-xl text-sm font-semibold bg-gold text-ink disabled:opacity-50">
          {busy ? '…' : 'Enregistrer'}
        </button>
        <button onClick={onCancel} disabled={busy} className="px-4 py-2 rounded-xl text-sm border border-line text-muted">Annuler</button>
      </div>
    </div>
  );
}

// ── Paliers de surface ────────────────────────────────────────────────────────
//
// Chaque ligne est un BROUILLON EN TEXTE : on lit le montant seulement à
// l'enregistrement. Avant, la saisie était convertie à chaque frappe
// (`parseFloat(...) || 0`) : « 1 200 » devenait 1, une lettre devenait 0 €, et
// l'enregistrement automatique publiait ce prix sur le site.
interface TierRowDraft { id: string; maxM2: string; label: string; cap: string; base: string; max: string }

const vide = (n: number | null | undefined) => (n == null ? '' : String(n));
function tierToDraft(t: SimulatorConfig['tiers'][number]): TierRowDraft {
  return { id: t.id ?? '', maxM2: vide(t.maxM2), label: t.label, cap: vide(t.capacityIncluded), base: vide(t.basePrice), max: vide(t.priceMax) };
}

/** Lit un palier saisi ; renvoie une erreur lisible plutôt qu'un prix faux. */
function lireTier(d: Omit<TierRowDraft, 'id'>):
  { ok: true; maxM2: number; label: string; capacityIncluded: number | null; basePrice: number | null; priceMax: number | null }
  | { ok: false; erreur: string } {
  if (!d.label.trim()) return { ok: false, erreur: 'Le libellé est obligatoire.' };
  const m2 = lireEntier(d.maxM2, 'La surface');
  if (!m2.ok) return m2;
  if (!m2.valeur) return { ok: false, erreur: 'Indiquez la surface maximale du palier (en m²).' };
  const cap = lireEntier(d.cap, 'Les voyageurs compris');
  if (!cap.ok) return cap;
  const base = lireMontant(d.base, 'Le prix « de »');
  if (!base.ok) return base;
  const max = lireMontant(d.max, 'Le prix « à »');
  if (!max.ok) return max;
  const four = erreurFourchette(base.valeur, max.valeur);
  if (four) return { ok: false, erreur: four };
  if (base.valeur == null && max.valeur != null) {
    return { ok: false, erreur: 'Renseignez le prix « de » (le prix « à » seul ne suffit pas).' };
  }
  return { ok: true, maxM2: m2.valeur, label: d.label.trim(), capacityIncluded: cap.valeur, basePrice: base.valeur, priceMax: max.valeur };
}

function TiersTab({ config, send, confirm }: { config: SimulatorConfig; send: Send; confirm: Confirm }) {
  const { toast } = useFeedback();
  const [rows, setRows] = useState<TierRowDraft[]>(() => config.tiers.map(tierToDraft));
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState(emptyTierDraft());
  const [extraFee, setExtraFee] = useState(String(config.extraGuestFee ?? 0));
  const [savedId, setSavedId] = useState<string | null>(null);
  const [erreurs, setErreurs] = useState<Record<string, string>>({});

  // On ne réaligne les lignes sur la base QUE si la liste change (ajout,
  // suppression). Se caler sur `config.tiers` à chaque rechargement écrasait les
  // saisies en cours des AUTRES lignes : on tapait trois prix, on en enregistrait
  // un, et les deux autres revenaient à leur ancienne valeur.
  const idsKey = config.tiers.map(t => t.id).join('|');
  useEffect(() => { setRows(config.tiers.map(tierToDraft)); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);
  useEffect(() => { setExtraFee(String(config.extraGuestFee ?? 0)); }, [config.extraGuestFee]);

  function setRow(i: number, patch: Partial<TierRowDraft>) {
    setRows(r => r.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  }

  async function saveExtraFee() {
    const v = lireMontant(extraFee, 'Le supplément voyageurs');
    if (!v.ok) { toast(v.erreur, 'error'); return; }
    setBusy(true);
    await send({ action: 'settings.save', settings: { extraGuestFee: v.valeur ?? 0 } });
    setBusy(false);
  }

  /** Une ligne a-t-elle été modifiée depuis ce qui est en base ? */
  function isDirty(i: number): boolean {
    const a = rows[i];
    const src = config.tiers.find(t => t.id === a?.id);
    if (!a || !src) return false;
    const b = tierToDraft(src);
    return a.maxM2.trim() !== b.maxM2 || a.label !== b.label || a.cap.trim() !== b.cap
      || a.base.trim() !== b.base || a.max.trim() !== b.max;
  }

  // Enregistrement dès qu'on quitte le champ : la petite coche passait
  // inaperçue, et les prix tapés disparaissaient au rechargement suivant.
  // Une saisie illisible n'est PAS enregistrée : la ligne l'affiche en rouge.
  async function saveRow(i: number) {
    const d = rows[i];
    if (!d?.id || !isDirty(i)) { if (d?.id) setErreurs(e => { const n = { ...e }; delete n[d.id]; return n; }); return; }
    const t = lireTier(d);
    if (!t.ok) { setErreurs(e => ({ ...e, [d.id]: t.erreur })); return; }
    setErreurs(e => { const n = { ...e }; delete n[d.id]; return n; });
    const src = config.tiers.find(x => x.id === d.id);
    setBusy(true);
    const ok = await send({ action: 'tier.save', tier: {
      id: d.id, maxM2: t.maxM2, label: t.label, capText: src?.capText ?? null,
      basePrice: t.basePrice, priceMax: t.priceMax, capacityIncluded: t.capacityIncluded,
    } });
    setBusy(false);
    if (ok) { setSavedId(d.id); setTimeout(() => setSavedId(x => (x === d.id ? null : x)), 1800); }
  }

  async function removeRow(i: number) {
    const t = rows[i];
    const id = t?.id;
    if (!id) return;
    const ok = await confirm({
      title: 'Supprimer ce palier ?',
      message: `« ${t.label} » disparaîtra du simulateur. Les logements de cette taille seront chiffrés par le palier supérieur.`,
      confirmLabel: 'Supprimer', danger: true,
    });
    if (!ok) return;
    setBusy(true);
    await send({ action: 'tier.delete', id });
    setBusy(false);
  }

  async function addRow() {
    const t = lireTier({ maxM2: draft.maxM2, label: draft.label, cap: draft.capText, base: draft.basePrice, max: draft.priceMax });
    if (!t.ok) { toast(t.erreur, 'error'); return; }
    setBusy(true);
    const ok = await send({
      action: 'tier.save',
      tier: { maxM2: t.maxM2, label: t.label, capText: null, capacityIncluded: t.capacityIncluded, basePrice: t.basePrice, priceMax: t.priceMax },
    });
    setBusy(false);
    if (ok) setDraft(emptyTierDraft());
  }

  // Sur téléphone, chaque palier devient une petite carte aux champs étiquetés ;
  // à partir de la tablette, on retrouve le tableau à colonnes.
  const rouge = (err?: string) => (err ? ' border-danger-line' : '');

  return (
    <div className="rounded-2xl border border-line bg-card overflow-hidden">
      <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide border-b border-hairline text-muted">
        <span className="col-span-2">Jusqu&apos;à (m²)</span>
        <span className="col-span-2">Libellé</span>
        <span className="col-span-3">Voyageurs compris</span>
        <span className="col-span-2">Prix de</span>
        <span className="col-span-2">à</span>
        <span className="col-span-1" />
      </div>
      {rows.map((t, i) => {
        const err = erreurs[t.id];
        return (
          <div key={t.id || i} className="px-4 py-3 sm:py-2 border-b last:border-0 border-hairline">
            <div className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-end sm:items-center">
              <Cellule label="Jusqu'à (m²)" className="sm:col-span-2">
                <input className={FIELD + rouge(err)} value={t.maxM2} inputMode="numeric" onBlur={() => saveRow(i)}
                  onChange={e => setRow(i, { maxM2: e.target.value })} />
              </Cellule>
              <Cellule label="Libellé" className="sm:col-span-2">
                <input className={FIELD} value={t.label} onBlur={() => saveRow(i)}
                  onChange={e => setRow(i, { label: e.target.value })} />
              </Cellule>
              <Cellule label="Voyageurs compris" className="col-span-2 sm:col-span-3">
                <input className={FIELD + rouge(err)} value={t.cap} inputMode="numeric" placeholder="illimité" onBlur={() => saveRow(i)}
                  onChange={e => setRow(i, { cap: e.target.value })} />
              </Cellule>
              <Cellule label="Prix de" className="sm:col-span-2">
                <input className={FIELD + rouge(err)} value={t.base} inputMode="decimal" placeholder="sur devis" onBlur={() => saveRow(i)}
                  onChange={e => setRow(i, { base: e.target.value })} />
              </Cellule>
              <Cellule label="à" className="sm:col-span-2">
                <input className={FIELD + rouge(err)} value={t.max} inputMode="decimal" placeholder="prix ferme" onBlur={() => saveRow(i)}
                  onChange={e => setRow(i, { max: e.target.value })} />
              </Cellule>
              <div className="col-span-2 sm:col-span-1 flex justify-end items-center gap-1">
                {/* Trois états lisibles d'un coup d'œil : modifié, enregistré, au repos. */}
                {savedId === t.id
                  ? <span className="text-success" title="Enregistré"><Icon name="check" size={15} /></span>
                  : isDirty(i)
                    ? <button onClick={() => saveRow(i)} disabled={busy} className="text-[10px] font-semibold text-gold-ink">Enregistrer</button>
                    : <span className="w-4" />}
                <button onClick={() => removeRow(i)} disabled={busy} aria-label={`Supprimer le palier ${t.label}`}
                  className="text-danger px-1"><Icon name="close" size={15} /></button>
              </div>
            </div>
            {err && <p className="text-[11px] mt-1 font-semibold text-danger">Non enregistré — {err}</p>}
          </div>
        );
      })}

      {/* Nouveau palier — mêmes colonnes que la grille, pour qu'on voie où il ira. */}
      <div className="px-4 py-3 sm:py-2 border-t border-hairline bg-surface-2">
        <p className="sm:hidden text-xs font-semibold mb-2 text-ink">Nouveau palier</p>
        <div className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-end sm:items-center">
          <Cellule label="Jusqu'à (m²)" className="sm:col-span-2">
            <input className={FIELD} value={draft.maxM2} inputMode="numeric" placeholder="m²"
              onChange={e => setDraft(d => ({ ...d, maxM2: e.target.value }))} />
          </Cellule>
          <Cellule label="Libellé" className="sm:col-span-2">
            <input className={FIELD} value={draft.label} placeholder="T6, Loft…"
              onChange={e => setDraft(d => ({ ...d, label: e.target.value }))} />
          </Cellule>
          <Cellule label="Voyageurs compris" className="col-span-2 sm:col-span-3">
            <input className={FIELD} value={draft.capText} inputMode="numeric" placeholder="voyageurs"
              onChange={e => setDraft(d => ({ ...d, capText: e.target.value }))} />
          </Cellule>
          <Cellule label="Prix de" className="sm:col-span-2">
            <input className={FIELD} value={draft.basePrice} inputMode="decimal" placeholder="sur devis"
              onChange={e => setDraft(d => ({ ...d, basePrice: e.target.value }))} />
          </Cellule>
          <Cellule label="à" className="sm:col-span-2">
            <input className={FIELD} value={draft.priceMax} inputMode="decimal" placeholder="prix ferme"
              onChange={e => setDraft(d => ({ ...d, priceMax: e.target.value }))} />
          </Cellule>
          <button onClick={addRow} disabled={busy || !draft.label.trim() || !draft.maxM2}
            aria-label="Ajouter ce palier"
            className="col-span-2 sm:col-span-1 text-xs font-semibold text-gold-ink disabled:opacity-40 justify-self-end">Ajouter</button>
        </div>
      </div>

      <div className="px-4 py-3 border-t border-hairline flex items-center gap-3 flex-wrap">
        <span className="text-sm font-semibold text-ink">Voyageurs supplémentaires</span>
        <input className={`${FIELD} w-24`} value={extraFee} inputMode="decimal"
          onChange={e => setExtraFee(e.target.value)} />
        <span className="text-xs text-muted">€ par tranche de 2 voyageurs au-delà de la capacité comprise</span>
        <button onClick={saveExtraFee} disabled={busy}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gold text-ink disabled:opacity-50">
          Enregistrer
        </button>
      </div>

      {/* Légende courte : le détail du calcul se lit mieux dans « Tester un devis ». */}
      <ul className="px-4 py-3 border-t border-hairline grid gap-x-6 gap-y-1 sm:grid-cols-2 text-[11px] text-muted">
        <li><span className="font-semibold text-ink">Prix « à » vide</span> : prix ferme</li>
        <li><span className="font-semibold text-ink">Les deux prix vides</span> : sur devis au-delà de ce palier</li>
        <li><span className="font-semibold text-ink">Voyageurs compris vide</span> : aucune limite, jamais de supplément</li>
        <li><span className="font-semibold text-ink">Au-delà</span> : supplément par tranche de 2 voyageurs (1 en plus = 2)</li>
        <li className="sm:col-span-2 text-faint">Enregistré dès que vous quittez le champ · classé tout seul par surface · une saisie illisible n&apos;est pas enregistrée</li>
      </ul>
    </div>
  );
}

/** Un champ de palier : étiquette visible seulement sur téléphone (le tableau a ses en-têtes). */
function Cellule({ label, className = '', children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="sm:hidden block text-[10px] font-semibold mb-0.5 text-muted">{label}</span>
      {children}
    </label>
  );
}

interface TierDraft2 { maxM2: string; label: string; capText: string; basePrice: string; priceMax: string }
const emptyTierDraft = (): TierDraft2 => ({ maxM2: '', label: '', capText: '', basePrice: '', priceMax: '' });

// ── Options ───────────────────────────────────────────────────────────────────
function OptionsTab({ config, send, confirm }: { config: SimulatorConfig; send: Send; confirm: Confirm }) {
  const { toast } = useFeedback();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);   // id d'option, ou 'new'
  const [draft, setDraft] = useState(emptyOptionDraft());

  function open(o?: QuoteOption) {
    setDraft(o ? {
      label: o.label,
      perCapacity: o.perCapacity,
      fee: String(o.fee ?? 0),
      tiers: (o.tiers ?? []).map(t => ({ max: String(t.max), fee: String(t.fee) })),
      defaultOn: o.defaultOn,
    } : emptyOptionDraft());
    setEditing(o?.id ?? 'new');
  }

  async function save() {
    if (!draft.label.trim()) return;
    // Rien n'est envoyé si un montant est illisible : avant, il devenait 0 €.
    let fee = 0;
    let tiers: { max: number; fee: number }[] | null = null;
    if (draft.perCapacity) {
      tiers = [];
      for (const t of draft.tiers.filter(t => t.max.trim() !== '')) {
        const max = lireEntier(t.max, 'Le nombre de voyageurs');
        if (!max.ok) { toast(max.erreur, 'error'); return; }
        const f = lireMontant(t.fee, `Le prix jusqu'à ${t.max} voyageurs`);
        if (!f.ok) { toast(f.erreur, 'error'); return; }
        if (f.valeur == null) { toast(`Indiquez un prix pour « jusqu'à ${t.max} voyageurs ».`, 'error'); return; }
        tiers.push({ max: max.valeur ?? 0, fee: f.valeur });
      }
      // Paliers triés : le calcul prend le premier dont le plafond couvre la
      // capacité, un ordre de saisie approximatif fausserait le prix.
      tiers.sort((a, b) => a.max - b.max);
    } else {
      const f = lireMontant(draft.fee, 'Le montant');
      if (!f.ok) { toast(f.erreur, 'error'); return; }
      fee = f.valeur ?? 0;
    }
    setBusy(true);
    const ok = await send({
      action: 'option.save',
      option: {
        id: editing === 'new' ? undefined : editing,
        label: draft.label,
        fee,
        perCapacity: draft.perCapacity,
        tiers,
        defaultOn: draft.defaultOn,
      },
    });
    setBusy(false);
    if (ok) setEditing(null);
  }

  async function remove(o: QuoteOption) {
    const ok = await confirm({
      title: 'Supprimer cette option ?',
      message: `« ${o.label} » disparaîtra du simulateur. Les devis déjà envoyés ne changent pas.`,
      confirmLabel: 'Supprimer', danger: true,
    });
    if (ok) await send({ action: 'option.delete', id: o.id });
  }

  async function toggleDefault(o: QuoteOption) {
    setBusy(true);
    await send({
      action: 'option.save',
      option: { id: o.id, label: o.label, fee: o.fee, perCapacity: o.perCapacity, tiers: o.tiers, defaultOn: !o.defaultOn },
    });
    setBusy(false);
  }

  return (
    <div className="space-y-3">
      {config.options.map(o => (
        <div key={o.key} className="rounded-2xl border border-line bg-card p-4">
          {editing === o.id ? (
            <OptionForm draft={draft} setDraft={setDraft} busy={busy} onSave={save} onCancel={() => setEditing(null)} />
          ) : (
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="font-semibold text-ink">{o.label}</p>
                <p className="text-xs mt-0.5 text-muted">
                  {o.perCapacity
                    ? `Selon le nombre de voyageurs — ${(o.tiers ?? []).map(t => `≤${t.max} : ${t.fee} €`).join(' · ') || 'aucun palier défini'}`
                    : `Forfait ${o.fee} €`}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => toggleDefault(o)} disabled={busy}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${o.defaultOn ? 'border-gold bg-gold-soft text-gold-ink' : 'border-line text-muted'}`}>
                  {o.defaultOn ? 'Cochée d’avance' : 'Décochée'}
                </button>
                <button onClick={() => open(o)} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-line text-muted">Modifier</button>
                <button onClick={() => remove(o)} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-danger-line text-danger">Supprimer</button>
              </div>
            </div>
          )}
        </div>
      ))}

      {editing === 'new' ? (
        <div className="rounded-2xl border border-gold bg-gold-soft p-4">
          <OptionForm draft={draft} setDraft={setDraft} busy={busy} onSave={save} onCancel={() => setEditing(null)} />
        </div>
      ) : (
        <button onClick={() => open()} className="w-full py-3 rounded-xl text-sm font-semibold border border-dashed border-line text-muted">
          + Ajouter une option
        </button>
      )}
    </div>
  );
}

// ── Formulaire d'option ───────────────────────────────────────────────────────
interface TierDraft { max: string; fee: string }
interface OptionDraft { label: string; perCapacity: boolean; fee: string; tiers: TierDraft[]; defaultOn: boolean }

const emptyOptionDraft = (): OptionDraft => ({ label: '', perCapacity: false, fee: '0', tiers: [], defaultOn: false });

function OptionForm({ draft, setDraft, busy, onSave, onCancel }: {
  draft: OptionDraft;
  setDraft: (f: (d: OptionDraft) => OptionDraft) => void;
  busy: boolean; onSave: () => void; onCancel: () => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-semibold mb-1 text-muted">Nom de l&apos;option</label>
        <input value={draft.label} onChange={e => setDraft(d => ({ ...d, label: e.target.value }))}
          placeholder="Linge fourni & lavé" className={FIELD} autoFocus />
      </div>

      {/* Le mode change la nature du prix : forfait unique, ou barème par capacité. */}
      <div className="flex gap-2">
        <button type="button" onClick={() => setDraft(d => ({ ...d, perCapacity: false }))}
          className={`flex-1 text-xs font-semibold px-3 py-2 rounded-xl border ${!draft.perCapacity ? 'border-gold bg-gold-soft text-gold-ink' : 'border-line text-muted'}`}>
          Prix fixe
        </button>
        <button type="button" onClick={() => setDraft(d => ({ ...d, perCapacity: true, tiers: d.tiers.length ? d.tiers : [{ max: '2', fee: '' }] }))}
          className={`flex-1 text-xs font-semibold px-3 py-2 rounded-xl border ${draft.perCapacity ? 'border-gold bg-gold-soft text-gold-ink' : 'border-line text-muted'}`}>
          Selon le nombre de voyageurs
        </button>
      </div>

      {draft.perCapacity ? (
        <div>
          <label className="block text-xs font-semibold mb-1 text-muted">Paliers</label>
          <div className="space-y-2">
            {draft.tiers.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs shrink-0 text-muted">jusqu&apos;à</span>
                <input value={t.max} inputMode="numeric" className={`${FIELD} w-20`}
                  onChange={e => setDraft(d => ({ ...d, tiers: d.tiers.map((x, j) => j === i ? { ...x, max: e.target.value } : x) }))} />
                <span className="text-xs shrink-0 text-muted">voyageurs :</span>
                <input value={t.fee} inputMode="decimal" className={`${FIELD} w-24`} placeholder="€"
                  onChange={e => setDraft(d => ({ ...d, tiers: d.tiers.map((x, j) => j === i ? { ...x, fee: e.target.value } : x) }))} />
                <button type="button" aria-label="Retirer ce palier" className="text-danger px-1"
                  onClick={() => setDraft(d => ({ ...d, tiers: d.tiers.filter((_, j) => j !== i) }))}>
                  <Icon name="close" size={14} />
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setDraft(d => ({ ...d, tiers: [...d.tiers, { max: '', fee: '' }] }))}
            className="mt-2 text-xs font-semibold px-3 py-1.5 rounded-lg border border-line text-muted">
            + Ajouter un palier
          </button>
          <p className="text-[11px] mt-2 text-faint">
            Au-delà du dernier palier, le simulateur cesse de chiffrer et bascule en
            « sur devis » plutôt que d&apos;inventer un prix.
          </p>
        </div>
      ) : (
        <div>
          <label className="block text-xs font-semibold mb-1 text-muted">Montant (€)</label>
          <input value={draft.fee} inputMode="decimal" className={`${FIELD} w-32`}
            onChange={e => setDraft(d => ({ ...d, fee: e.target.value }))} />
        </div>
      )}

      <label className="flex items-center gap-2 text-xs text-muted">
        <input type="checkbox" checked={draft.defaultOn}
          onChange={e => setDraft(d => ({ ...d, defaultOn: e.target.checked }))} />
        Cochée d&apos;avance dans le simulateur
      </label>

      <div className="flex gap-2">
        <button onClick={onSave} disabled={busy || !draft.label.trim()}
          className="px-4 py-2 rounded-xl text-sm font-semibold bg-gold text-ink disabled:opacity-50">
          {busy ? '…' : 'Enregistrer'}
        </button>
        <button onClick={onCancel} disabled={busy} className="px-4 py-2 rounded-xl text-sm border border-line text-muted">Annuler</button>
      </div>
    </div>
  );
}

// ── Salles de bain & surface ──────────────────────────────────────────────────
//
// Ces réglages existaient en base et dans le calcul du simulateur, mais ne se
// modifiaient nulle part dans l'admin : il fallait passer par Supabase. Tout ce
// qui fixe un prix public doit se gérer depuis Tarification.
function ReglagesTab({ config, send }: { config: SimulatorConfig; send: Send }) {
  const { toast } = useFeedback();
  const [busy, setBusy] = useState(false);
  const versBrouillon = () => [...config.bathroomSurcharge]
    .sort((a, b) => a.from - b.from)
    .map(b => ({ from: String(b.from), fee: String(b.fee) }));
  const [bains, setBains] = useState(versBrouillon);
  const [surface, setSurface] = useState({ min: String(config.minM2), max: String(config.maxM2) });

  async function saveBains() {
    const steps: { from: number; fee: number }[] = [];
    for (const b of bains.filter(b => b.from.trim() !== '' || b.fee.trim() !== '')) {
      const from = lireEntier(b.from, 'Le nombre de salles de bain');
      if (!from.ok) { toast(from.erreur, 'error'); return; }
      if (from.valeur == null || from.valeur < 2) { toast('Un palier commence à 2 salles de bain au minimum (la première est comprise).', 'error'); return; }
      const fee = lireMontant(b.fee, `Le supplément pour ${from.valeur} salles de bain`);
      if (!fee.ok) { toast(fee.erreur, 'error'); return; }
      if (fee.valeur == null) { toast(`Indiquez le supplément pour ${from.valeur} salles de bain.`, 'error'); return; }
      if (steps.some(s => s.from === from.valeur)) { toast(`Le palier « ${from.valeur} salles de bain » est en double.`, 'error'); return; }
      steps.push({ from: from.valeur, fee: fee.valeur });
    }
    steps.sort((a, b) => a.from - b.from);
    setBusy(true);
    const ok = await send({ action: 'settings.save', settings: { bathroomSurcharge: steps } });
    setBusy(false);
    if (ok) { setBains(steps.map(s => ({ from: String(s.from), fee: String(s.fee) }))); toast('Suppléments salles de bain enregistrés.', 'success'); }
  }

  async function saveSurface() {
    const min = lireEntier(surface.min, 'La surface minimale');
    if (!min.ok) { toast(min.erreur, 'error'); return; }
    const max = lireEntier(surface.max, 'La surface maximale');
    if (!max.ok) { toast(max.erreur, 'error'); return; }
    if (!min.valeur || !max.valeur || min.valeur >= max.valeur) {
      toast('La surface minimale doit être plus petite que la maximale.', 'error'); return;
    }
    setBusy(true);
    const ok = await send({ action: 'settings.save', settings: { minM2: min.valeur, maxM2: max.valeur } });
    setBusy(false);
    if (ok) toast('Curseur de surface enregistré.', 'success');
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-line bg-card p-4">
        <p className="font-semibold text-ink">Salles de bain supplémentaires</p>
        <p className="text-xs mt-0.5 mb-3 text-muted">
          La première salle de bain est comprise dans le prix du palier. Au-delà du dernier
          palier, le simulateur prolonge avec le dernier écart (par exemple +10 € par salle de bain).
        </p>
        <div className="space-y-2">
          {bains.map((b, i) => (
            <div key={i} className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted">À partir de</span>
              <input value={b.from} inputMode="numeric" className={`${FIELD} w-16`}
                onChange={e => setBains(l => l.map((x, j) => (j === i ? { ...x, from: e.target.value } : x)))} />
              <span className="text-xs text-muted">salles de bain : +</span>
              <input value={b.fee} inputMode="decimal" className={`${FIELD} w-24`} placeholder="€"
                onChange={e => setBains(l => l.map((x, j) => (j === i ? { ...x, fee: e.target.value } : x)))} />
              <span className="text-xs text-muted">€</span>
              <button type="button" aria-label="Retirer ce palier" className="text-danger px-1"
                onClick={() => setBains(l => l.filter((_, j) => j !== i))}>
                <Icon name="close" size={14} />
              </button>
            </div>
          ))}
          {bains.length === 0 && <p className="text-xs text-faint">Aucun supplément : toutes les salles de bain sont comprises.</p>}
        </div>
        <div className="flex gap-2 mt-3">
          <button type="button" onClick={() => setBains(l => [...l, { from: String((Number(l[l.length - 1]?.from) || 1) + 1), fee: '' }])}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-line text-muted">
            + Ajouter un palier
          </button>
          <button onClick={saveBains} disabled={busy}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gold text-ink disabled:opacity-50">
            Enregistrer
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-card p-4">
        <p className="font-semibold text-ink">Curseur de surface</p>
        <p className="text-xs mt-0.5 mb-3 text-muted">
          Les bornes du curseur « surface » que le visiteur fait glisser dans le simulateur.
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted">De</span>
          <input value={surface.min} inputMode="numeric" className={`${FIELD} w-20`}
            onChange={e => setSurface(s => ({ ...s, min: e.target.value }))} />
          <span className="text-xs text-muted">à</span>
          <input value={surface.max} inputMode="numeric" className={`${FIELD} w-20`}
            onChange={e => setSurface(s => ({ ...s, max: e.target.value }))} />
          <span className="text-xs text-muted">m²</span>
          <button onClick={saveSurface} disabled={busy}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gold text-ink disabled:opacity-50">
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
