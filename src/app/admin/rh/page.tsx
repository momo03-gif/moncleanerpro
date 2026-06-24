'use client';

import { useState, useEffect } from 'react';
import {
  getRhConfigDB, saveRhConfigDB, RH_CONFIG_META, type RhConfigRow,
  getPrimeTypesDB, createPrimeTypeDB, updatePrimeTypeDB, deletePrimeTypeDB,
  PRIME_CONDITION_LABEL, type PrimeType, type PrimeConditionType, type PrimeMode,
} from '@/lib/rhApi';
import { inputStyle } from '@/lib/ui';
import Icon from '@/components/Icon';
import Loading from "@/components/Loading";

const SECTION_TITLE: Record<string, string> = {
  primes: 'Primes',
  avantages: 'Avantages (éligibilité, pas un montant de paie)',
  priorite: 'Priorité d’attribution',
};

// Petit interrupteur Activé/Désactivé — couleurs de l'app (doré actif).
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!on)}
      className="relative inline-flex items-center rounded-full transition-all shrink-0"
      style={{ width: 42, height: 24, backgroundColor: on ? '#C9A84C' : '#E8E4DC' }}
      aria-pressed={on}>
      <span className="inline-block rounded-full bg-white transition-all"
        style={{ width: 18, height: 18, transform: on ? 'translateX(21px)' : 'translateX(3px)' }} />
    </button>
  );
}

export default function ReglesRhPage() {
  const [tab, setTab] = useState<'reglages' | 'primes'>('reglages');

  // ── Réglages (rh_config) ──
  const [config, setConfig] = useState<RhConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // ── Primes (prime_types) ──
  const [primes, setPrimes] = useState<PrimeType[]>([]);
  const [showForm, setShowForm] = useState(false);

  async function loadAll() {
    const [cfg, pr] = await Promise.all([getRhConfigDB(), getPrimeTypesDB()]);
    setConfig(cfg);
    setPrimes(pr);
    setLoading(false);
  }
  useEffect(() => { loadAll(); }, []);

  // Met à jour une valeur de config en mémoire (sauvegarde explicite au bouton).
  function setVal(key: string, value: number) {
    setConfig(c => c.map(r => (r.key === key ? { ...r, value } : r)));
    setSaved(false);
  }
  function setEnabled(key: string, enabled: boolean) {
    setConfig(c => c.map(r => (r.key === key ? { ...r, enabled } : r)));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    await saveRhConfigDB(config);
    setSaving(false);
    setSaved(true);
  }

  // Ordonne les lignes selon RH_CONFIG_META (clés connues), puis le reste.
  const known = RH_CONFIG_META.map(m => m.key) as string[];
  const orderedKeys = [
    ...RH_CONFIG_META.map(m => m.key),
    ...config.map(c => c.key).filter(k => !known.includes(k)),
  ];
  const byKey = Object.fromEntries(config.map(c => [c.key, c]));
  const sections: ('primes' | 'avantages' | 'priorite')[] = ['primes', 'avantages', 'priorite'];

  if (loading) return <Loading className="p-4 md:p-6 text-sm" />;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Règles RH</h1>
        <p className="text-sm mt-1" style={{ color: '#A8A09A' }}>
          Primes, avantages et seuils. Les changements s’appliquent aux calculs du mois suivant.
        </p>
      </div>

      {/* Onglets — même pilule que Facturation */}
      <div className="flex gap-1 mb-6 p-1 rounded-2xl w-fit" style={{ backgroundColor: '#F5F3EF' }}>
        {([['reglages', 'Réglages'], ['primes', `Primes (${primes.length})`]] as const).map(([v, label]) => (
          <button key={v} onClick={() => setTab(v)} className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{ backgroundColor: tab === v ? '#FFFFFF' : 'transparent', color: tab === v ? '#1A1A1A' : '#A8A09A', boxShadow: tab === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── RÉGLAGES ── */}
      {tab === 'reglages' && (
        <>
          {sections.map(section => {
            const metas = RH_CONFIG_META.filter(m => m.section === section);
            return (
              <div key={section} className="rounded-2xl border mb-4 overflow-hidden" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
                <div className="px-5 py-3 border-b" style={{ borderColor: '#F2EFE9', backgroundColor: '#FAFAF8' }}>
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#7A7068' }}>{SECTION_TITLE[section]}</p>
                </div>
                {metas.map((m, i) => {
                  const row = byKey[m.key];
                  if (!row) return null;
                  return (
                    <div key={m.key} className={`px-5 py-4 flex items-center gap-4 ${i < metas.length - 1 ? 'border-b' : ''}`} style={{ borderColor: '#F2EFE9' }}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{m.label}</p>
                        {m.hint && <p className="text-xs mt-0.5" style={{ color: '#A8A09A' }}>{m.hint}</p>}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <input type="number" value={row.value}
                          onChange={e => setVal(m.key, Number(e.target.value))}
                          className="w-20 px-3 py-2 rounded-xl text-sm text-right"
                          style={{ ...inputStyle }} />
                        <span className="text-xs w-14" style={{ color: '#A8A09A' }}>{m.unit}</span>
                      </div>
                      <Toggle on={row.enabled} onChange={v => setEnabled(m.key, v)} />
                    </div>
                  );
                })}
              </div>
            );
          })}

          <div className="flex items-center gap-3 mt-5">
            <button onClick={save} disabled={saving}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all"
              style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
              {saving ? 'Enregistrement...' : 'Enregistrer les réglages'}
            </button>
            {saved && <span className="text-sm font-medium" style={{ color: '#5A8A6A' }}>✓ Enregistré</span>}
          </div>
        </>
      )}

      {/* ── PRIMES ── */}
      {tab === 'primes' && (
        <PrimesPanel primes={primes} showForm={showForm} setShowForm={setShowForm} onChanged={loadAll} />
      )}
    </div>
  );
}

// ── Panneau Primes : liste + création + activation/suppression ──────────────────
function PrimesPanel({ primes, showForm, setShowForm, onChanged }: {
  primes: PrimeType[]; showForm: boolean; setShowForm: (v: boolean) => void; onChanged: () => void;
}) {
  const empty = { nom: '', montant: 0, conditionType: 'manuel' as PrimeConditionType, conditionValeur: undefined as number | undefined, mode: 'validation_admin' as PrimeMode };
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    if (!form.nom.trim()) { setErr('Nom requis.'); return; }
    setBusy(true); setErr('');
    const res = await createPrimeTypeDB({
      nom: form.nom.trim(), montant: Number(form.montant) || 0,
      conditionType: form.conditionType, conditionValeur: form.conditionValeur,
      mode: form.mode, actif: true,
    });
    setBusy(false);
    if (res.error) { setErr(res.error); return; }
    setForm(empty); setShowForm(false); onChanged();
  }

  async function toggleActif(p: PrimeType) {
    await updatePrimeTypeDB(p.id, { actif: !p.actif });
    onChanged();
  }
  async function remove(p: PrimeType) {
    await deletePrimeTypeDB(p.id);
    onChanged();
  }

  return (
    <>
      <div className="rounded-2xl border overflow-hidden mb-4" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
        <div className="hidden md:grid grid-cols-12 px-5 py-3 text-xs font-semibold uppercase tracking-wide border-b" style={{ color: '#A8A09A', borderColor: '#F2EFE9', backgroundColor: '#FAFAF8' }}>
          <span className="col-span-4">Prime</span><span className="col-span-2">Montant</span><span className="col-span-4">Condition</span><span className="col-span-2">Mode</span>
        </div>
        {primes.length === 0 && <div className="py-10 text-center text-sm" style={{ color: '#A8A09A' }}>Aucune prime — créez-en une ci-dessous.</div>}
        {primes.map((p, i) => (
          <div key={p.id} className={`px-5 py-4 flex flex-col md:grid md:grid-cols-12 gap-2 md:gap-0 md:items-center ${i < primes.length - 1 ? 'border-b' : ''}`} style={{ borderColor: '#F2EFE9' }}>
            <div className="md:col-span-4 flex items-center gap-2">
              <span className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{p.nom}</span>
              {!p.actif && <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#F5F3EF', color: '#A8A09A' }}>inactive</span>}
            </div>
            <div className="md:col-span-2"><span className="text-sm font-semibold" style={{ color: '#C9A84C' }}>{p.montant}€</span></div>
            <div className="md:col-span-4">
              <span className="text-xs" style={{ color: '#7A7068' }}>
                {PRIME_CONDITION_LABEL[p.conditionType]}{p.conditionValeur != null ? ` (${p.conditionValeur})` : ''}
              </span>
            </div>
            <div className="md:col-span-2 flex items-center justify-between gap-2">
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: p.mode === 'automatique' ? '#5A8A6A15' : '#C9A84C15', color: p.mode === 'automatique' ? '#5A8A6A' : '#C48A2A' }}>
                {p.mode === 'automatique' ? 'Auto' : 'À valider'}
              </span>
              <div className="flex items-center gap-2">
                <Toggle on={p.actif} onChange={() => toggleActif(p)} />
                <button onClick={() => remove(p)} className="text-xs" style={{ color: '#B85A50' }} aria-label="Supprimer">
                  <Icon name="close" size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {!showForm ? (
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
          <Icon name="plus" size={16} /> Nouvelle prime
        </button>
      ) : (
        <div className="rounded-2xl border p-5 space-y-4" style={{ backgroundColor: '#FAFAF8', borderColor: '#E8E4DC' }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#7A7068' }}>Nouvelle prime</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1.5" style={{ color: '#A8A09A' }}>Nom</label>
              <input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                placeholder="ex : Prime exceptionnelle"
                className="w-full px-3 py-2.5 rounded-xl text-sm" style={{ ...inputStyle }} />
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: '#A8A09A' }}>Montant (€)</label>
              <input type="number" value={form.montant} onChange={e => setForm(f => ({ ...f, montant: Number(e.target.value) }))}
                className="w-full px-3 py-2.5 rounded-xl text-sm" style={{ ...inputStyle }} />
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: '#A8A09A' }}>Condition</label>
              <select value={form.conditionType} onChange={e => setForm(f => ({ ...f, conditionType: e.target.value as PrimeConditionType }))}
                className="w-full px-3 py-2.5 rounded-xl text-sm" style={{ ...inputStyle }}>
                {(Object.keys(PRIME_CONDITION_LABEL) as PrimeConditionType[]).map(ct => (
                  <option key={ct} value={ct}>{PRIME_CONDITION_LABEL[ct]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: '#A8A09A' }}>Seuil (facultatif)</label>
              <input type="number" value={form.conditionValeur ?? ''} onChange={e => setForm(f => ({ ...f, conditionValeur: e.target.value === '' ? undefined : Number(e.target.value) }))}
                placeholder="ex : 80"
                className="w-full px-3 py-2.5 rounded-xl text-sm" style={{ ...inputStyle }} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs mb-1.5" style={{ color: '#A8A09A' }}>Mode</label>
              <select value={form.mode} onChange={e => setForm(f => ({ ...f, mode: e.target.value as PrimeMode }))}
                className="w-full px-3 py-2.5 rounded-xl text-sm" style={{ ...inputStyle }}>
                <option value="automatique">Automatique — ajoutée à la paie dès la condition remplie</option>
                <option value="validation_admin">À valider — crée une demande Accepter/Refuser</option>
              </select>
            </div>
          </div>
          {err && <p className="text-xs" style={{ color: '#B85A50' }}>{err}</p>}
          <div className="flex gap-2">
            <button onClick={submit} disabled={busy}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
              style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
              {busy ? '...' : 'Créer la prime'}
            </button>
            <button onClick={() => { setShowForm(false); setErr(''); }}
              className="px-4 py-2.5 rounded-xl text-sm border" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>
              Annuler
            </button>
          </div>
        </div>
      )}
    </>
  );
}
