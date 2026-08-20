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

import { useState, useEffect, useCallback } from 'react';
import { getSimulatorConfigDB, type SimulatorConfig } from '@/lib/devisConfig';
import { useFeedback } from '@/contexts/FeedbackContext';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';

const FIELD = 'w-full px-3 py-2 rounded-lg text-sm border border-line bg-card text-ink';

export default function TarificationClient() {
  const { toast, confirm } = useFeedback();
  const [config, setConfig] = useState<SimulatorConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'zones' | 'tiers' | 'options'>('zones');

  const load = useCallback(async () => {
    setConfig(await getSimulatorConfigDB());
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

  if (!config) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold text-ink">Tarification du simulateur</h1>
        <div className="mt-4 rounded-2xl border border-warn-line bg-warn-soft p-5">
          <p className="text-sm text-warn">
            Aucune grille trouvée. Exécutez <code>supabase/migration_devis_simulateur.sql</code>
            {' '}dans Supabase : il crée les tables et une grille de départ, modifiable ici ensuite.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-xl font-bold text-ink">Tarification du simulateur</h1>
      <p className="text-sm mt-1 text-muted">
        Ce que voit un visiteur dans le simulateur Airbnb de la page de devis. Toute
        modification est visible immédiatement sur le site.
      </p>

      <div className="flex gap-2 mt-5 mb-5">
        {([['zones', 'Zones & communes'], ['tiers', 'Paliers de surface'], ['options', 'Options']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`text-sm font-semibold px-4 py-2 rounded-xl border ${tab === id ? 'border-gold bg-gold-soft text-gold-ink' : 'border-line text-muted'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'zones' && <ZonesTab config={config} send={send} confirm={confirm} />}
      {tab === 'tiers' && <TiersTab config={config} send={send} />}
      {tab === 'options' && <OptionsTab config={config} send={send} />}
    </div>
  );
}

type Send = (p: Record<string, unknown>) => Promise<boolean>;
type Confirm = ReturnType<typeof useFeedback>['confirm'];

// ── Zones tarifaires ──────────────────────────────────────────────────────────
function ZonesTab({ config, send, confirm }: { config: SimulatorConfig; send: Send; confirm: Confirm }) {
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
    setBusy(true);
    const ok = await send({
      action: 'zone.save',
      zone: {
        id: editing === 'new' ? undefined : editing,
        name: draft.name,
        fee: parseFloat(draft.fee.replace(',', '.')) || 0,
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

  return (
    <div className="space-y-3">
      {config.zones.map(z => (
        <div key={z.id} className="rounded-2xl border border-line bg-card p-4">
          {editing === z.id ? (
            <ZoneForm draft={draft} setDraft={setDraft} busy={busy} onSave={save} onCancel={() => setEditing(null)} />
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
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

function ZoneForm({ draft, setDraft, busy, onSave, onCancel }: {
  draft: { name: string; fee: string; communes: string };
  setDraft: (f: (d: { name: string; fee: string; communes: string }) => { name: string; fee: string; communes: string }) => void;
  busy: boolean; onSave: () => void; onCancel: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
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
function TiersTab({ config, send }: { config: SimulatorConfig; send: Send }) {
  const [rows, setRows] = useState(() => config.tiers.map(t => ({ ...t })));
  const [busy, setBusy] = useState(false);
  useEffect(() => { setRows(config.tiers.map(t => ({ ...t }))); }, [config.tiers]);

  async function saveRow(i: number) {
    const t = rows[i];
    setBusy(true);
    await send({ action: 'tier.save', tier: { id: config.tiers[i]?.id, maxM2: t.maxM2, label: t.label, capText: t.capText ?? null, basePrice: t.basePrice } });
    setBusy(false);
  }

  return (
    <div className="rounded-2xl border border-line bg-card overflow-hidden">
      <div className="grid grid-cols-12 gap-2 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide border-b border-hairline text-muted">
        <span className="col-span-2">Jusqu&apos;à</span>
        <span className="col-span-4">Libellé</span>
        <span className="col-span-3">Capacité affichée</span>
        <span className="col-span-2">Prix</span>
        <span className="col-span-1" />
      </div>
      {rows.map((t, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 items-center px-4 py-2 border-b last:border-0 border-hairline">
          <input className={`${FIELD} col-span-2`} value={t.maxM2}
            onChange={e => setRows(r => r.map((x, j) => j === i ? { ...x, maxM2: parseInt(e.target.value, 10) || 0 } : x))} />
          <input className={`${FIELD} col-span-4`} value={t.label}
            onChange={e => setRows(r => r.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
          <input className={`${FIELD} col-span-3`} value={t.capText ?? ''}
            onChange={e => setRows(r => r.map((x, j) => j === i ? { ...x, capText: e.target.value } : x))} />
          <input className={`${FIELD} col-span-2`} value={t.basePrice ?? ''} placeholder="sur devis"
            onChange={e => setRows(r => r.map((x, j) => j === i ? { ...x, basePrice: e.target.value === '' ? null : parseFloat(e.target.value.replace(',', '.')) || 0 } : x))} />
          <button onClick={() => saveRow(i)} disabled={busy} aria-label="Enregistrer ce palier"
            className="col-span-1 text-gold-ink flex justify-center"><Icon name="check" size={16} /></button>
        </div>
      ))}
      <p className="px-4 py-3 text-[11px] text-faint">
        Un prix vide signifie « sur devis » : au-delà de ce palier, le simulateur cesse de
        chiffrer et invite le visiteur à vous contacter. Laisser un dernier palier sans prix
        évite d&apos;annoncer un montant sur un logement hors norme.
      </p>
    </div>
  );
}

// ── Options ───────────────────────────────────────────────────────────────────
function OptionsTab({ config, send }: { config: SimulatorConfig; send: Send }) {
  const [busy, setBusy] = useState(false);

  async function toggleDefault(key: string, current: boolean) {
    const o = config.options.find(x => x.key === key);
    if (!o) return;
    setBusy(true);
    await send({ action: 'option.save', option: { id: o.id, key: o.key, label: o.label, fee: o.fee, perCapacity: o.perCapacity, tiers: o.tiers, defaultOn: !current } });
    setBusy(false);
  }

  return (
    <div className="space-y-3">
      {config.options.map(o => (
        <div key={o.key} className="rounded-2xl border border-line bg-card p-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-semibold text-ink">{o.label}</p>
            <p className="text-xs mt-0.5 text-muted">
              {o.perCapacity
                ? `Indexé sur le nombre de voyageurs — ${(o.tiers ?? []).map(t => `≤${t.max} : ${t.fee} €`).join(' · ')}`
                : `Forfait ${o.fee} €`}
            </p>
          </div>
          <button onClick={() => toggleDefault(o.key, o.defaultOn)} disabled={busy}
            className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg border ${o.defaultOn ? 'border-gold bg-gold-soft text-gold-ink' : 'border-line text-muted'}`}>
            {o.defaultOn ? 'Cochée d’avance' : 'Décochée'}
          </button>
        </div>
      ))}
      <p className="text-[11px] text-faint">
        Les paliers d&apos;une option indexée sur la capacité se règlent pour l&apos;instant
        directement en base. Dites-moi si vous voulez les éditer ici aussi.
      </p>
    </div>
  );
}
