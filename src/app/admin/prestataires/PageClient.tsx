'use client';

import { useState, useEffect, useCallback } from 'react';
import { appelPrestataire, libelleMois, type Prestataire, type Agent } from '@/lib/prestataireApi';
import { inputStyle } from '@/lib/ui';
import { money } from '@/lib/format';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import ReleveMois from '@/components/ReleveMois';
import { useFeedback } from '@/contexts/FeedbackContext';

// ════════════════════════════════════════════════════════════════════════════
//  Prestataires (sous-traitants) — entreprises extérieures à qui l'on confie
//  des missions. Elles gèrent elles-mêmes leurs agents depuis leur espace ;
//  on leur doit leur taux horaire × durée de chaque mission terminée.
//  On confie une mission depuis sa fiche (Missions › « Confier à un prestataire »).
// ════════════════════════════════════════════════════════════════════════════

const VIDE = { name: '', contactName: '', email: '', phone: '', siret: '', hourlyRate: '', password: '' };

export default function PrestatairesPage() {
  const { toast } = useFeedback();
  const [liste, setListe] = useState<Prestataire[] | null>(null);
  const [periode, setPeriode] = useState('');
  const [erreur, setErreur] = useState('');
  const [ajout, setAjout] = useState(false);
  const [form, setForm] = useState(VIDE);
  const [envoi, setEnvoi] = useState(false);
  const [ouvert, setOuvert] = useState<string | null>(null);

  const charger = useCallback(async () => {
    const r = await appelPrestataire<{ prestataires: Prestataire[]; periode: string }>('list');
    if (r.ok) { setListe(r.prestataires); setPeriode(r.periode); setErreur(''); }
    else { setListe([]); setErreur(r.error); }
  }, []);

  useEffect(() => {
    let actif = true;
    (async () => { if (actif) await charger(); })();
    return () => { actif = false; };
  }, [charger]);

  async function creer(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true);
    const r = await appelPrestataire('create', { ...form, hourlyRate: Number(form.hourlyRate) || 0 });
    setEnvoi(false);
    if (!r.ok) { toast(r.error, 'error'); return; }
    toast(`Prestataire créé. Il se connecte avec ${form.email}.`, 'success');
    setForm(VIDE); setAjout(false);
    await charger();
  }

  const actifs = (liste ?? []).filter(p => p.status === 'active').length;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Prestataires</h1>
          <p className="text-sm mt-1" style={{ color: '#A8A09A' }}>
            Sous-traitants : ils attribuent nos missions à leurs propres agents. {liste ? `${actifs} actif${actifs > 1 ? 's' : ''}` : ''}
          </p>
        </div>
        <button onClick={() => setAjout(s => !s)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
          style={{ backgroundColor: ajout ? '#F5F3EF' : '#C9A84C', color: ajout ? '#7A7068' : '#1A1A1A' }}>
          {ajout ? 'Annuler' : <><Icon name="plus" size={16} /> Ajouter un prestataire</>}
        </button>
      </div>

      {erreur && <p className="text-sm mb-4 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEF2F2', color: '#B85A50' }}>{erreur}</p>}

      {ajout && (
        <form onSubmit={creer} className="rounded-2xl border p-6 mb-6" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          <h2 className="font-semibold mb-4" style={{ color: '#1A1A1A' }}>Nouveau prestataire</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Champ label="Raison sociale *"><input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-sm" style={inputStyle} /></Champ>
            <Champ label="Contact"><input value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-sm" style={inputStyle} /></Champ>
            <Champ label="Email (identifiant) *"><input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-sm" style={inputStyle} /></Champ>
            <Champ label="Téléphone"><input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-sm" style={inputStyle} /></Champ>
            <Champ label="SIRET"><input value={form.siret} onChange={e => setForm(f => ({ ...f, siret: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-sm" style={inputStyle} /></Champ>
            <Champ label="Taux horaire payé (€/h) *"><input required type="number" min="0" step="0.5" inputMode="decimal" value={form.hourlyRate} onChange={e => setForm(f => ({ ...f, hourlyRate: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-sm" style={inputStyle} /></Champ>
            <Champ label="Mot de passe *"><input required minLength={6} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="6 caractères minimum" className="w-full px-3 py-2.5 rounded-xl text-sm" style={inputStyle} /></Champ>
          </div>
          <button type="submit" disabled={envoi} className="mt-5 px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
            {envoi ? 'Création…' : 'Créer le prestataire'}
          </button>
        </form>
      )}

      {liste === null ? <Loading variant="skeleton" rows={3} /> : liste.length === 0 && !ajout ? (
        <div className="rounded-2xl border p-8 text-center" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          <p className="text-sm" style={{ color: '#7A7068' }}>Aucun prestataire pour l’instant.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {liste.map(p => (
            <CartePrestataire key={p.id} p={p} periode={periode} ouvert={ouvert === p.id}
              onToggle={() => setOuvert(o => (o === p.id ? null : p.id))} onChange={charger} />
          ))}
        </div>
      )}
    </div>
  );
}

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs mb-1.5" style={{ color: '#A8A09A' }}>{label}</span>
      {children}
    </label>
  );
}

function CartePrestataire({ p, periode, ouvert, onToggle, onChange }: {
  p: Prestataire; periode: string; ouvert: boolean; onToggle: () => void; onChange: () => Promise<void>;
}) {
  const { toast, confirm } = useFeedback();
  const [onglet, setOnglet] = useState<'fiche' | 'agents' | 'releve'>('fiche');
  const [form, setForm] = useState({
    name: p.name, contactName: p.contact_name ?? '', email: p.email ?? '', phone: p.phone ?? '',
    siret: p.siret ?? '', hourlyRate: String(p.hourly_rate ?? 0),
  });
  const [mdp, setMdp] = useState('');
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const actif = p.status === 'active';

  useEffect(() => {
    if (!ouvert || onglet !== 'agents' || agents !== null) return;
    let vivant = true;
    (async () => {
      const r = await appelPrestataire<{ agents: Agent[] }>('agents', { id: p.id });
      if (vivant) setAgents(r.ok ? r.agents : []);
    })();
    return () => { vivant = false; };
  }, [ouvert, onglet, agents, p.id]);

  async function enregistrer() {
    setEnvoi(true);
    const r = await appelPrestataire('update', { id: p.id, ...form, hourlyRate: Number(form.hourlyRate) || 0 });
    setEnvoi(false);
    if (!r.ok) { toast(r.error, 'error'); return; }
    toast('Enregistré. Le nouveau taux s’applique aux missions confiées à partir de maintenant.', 'success');
    await onChange();
  }

  async function changerMdp() {
    setEnvoi(true);
    const r = await appelPrestataire('set-password', { id: p.id, password: mdp });
    setEnvoi(false);
    if (!r.ok) { toast(r.error, 'error'); return; }
    setMdp(''); toast('Mot de passe changé.', 'success');
  }

  async function basculer() {
    if (actif) {
      const ok = await confirm({
        title: `Suspendre ${p.name} ?`,
        message: 'Ni le prestataire ni ses agents ne pourront plus se connecter. Les missions déjà confiées restent chez lui : reprenez-les depuis Missions si besoin.',
        confirmLabel: 'Suspendre', danger: true,
      });
      if (!ok) return;
    }
    setEnvoi(true);
    const r = await appelPrestataire('update', { id: p.id, status: actif ? 'suspended' : 'active' });
    setEnvoi(false);
    if (!r.ok) { toast(r.error, 'error'); return; }
    await onChange();
  }

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC', opacity: actif ? 1 : 0.7 }}>
      <button onClick={onToggle} className="w-full px-4 md:px-6 py-4 flex items-center gap-4 text-left">
        <div className="w-11 h-11 rounded-full flex items-center justify-center text-base font-bold shrink-0"
          style={{ backgroundColor: actif ? '#C9A84C18' : '#F5F3EF', color: actif ? '#C9A84C' : '#A8A09A' }}>
          {p.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold truncate" style={{ color: '#1A1A1A' }}>{p.name}</p>
            {!actif && <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#B85A5015', color: '#B85A50' }}>Suspendu</span>}
          </div>
          <p className="text-xs truncate" style={{ color: '#A8A09A' }}>
            {money(p.hourly_rate)}/h · {p.agents ?? 0} agent{(p.agents ?? 0) > 1 ? 's' : ''}{p.contact_name ? ` · ${p.contact_name}` : ''}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold" style={{ color: '#C9A84C' }}>{money(p.duMois ?? 0)}</p>
          <p className="text-[11px]" style={{ color: '#A8A09A' }}>{periode ? libelleMois(periode) : ''}</p>
        </div>
      </button>

      {ouvert && (
        <div className="px-4 md:px-6 pb-5 border-t" style={{ borderColor: '#F2EFE9' }}>
          <div className="flex gap-1 my-4 p-1 rounded-2xl w-fit" style={{ backgroundColor: '#F5F3EF' }}>
            {([['fiche', 'Fiche'], ['agents', 'Agents'], ['releve', 'Relevé']] as const).map(([k, l]) => (
              <button key={k} onClick={() => setOnglet(k)} className="px-4 py-1.5 rounded-xl text-sm font-medium"
                style={{ backgroundColor: onglet === k ? '#FFFFFF' : 'transparent', color: onglet === k ? '#1A1A1A' : '#A8A09A' }}>
                {l}
              </button>
            ))}
          </div>

          {onglet === 'fiche' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Champ label="Raison sociale"><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-sm" style={inputStyle} /></Champ>
                <Champ label="Contact"><input value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-sm" style={inputStyle} /></Champ>
                <Champ label="Email (identifiant)"><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-sm" style={inputStyle} /></Champ>
                <Champ label="Téléphone"><input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-sm" style={inputStyle} /></Champ>
                <Champ label="SIRET"><input value={form.siret} onChange={e => setForm(f => ({ ...f, siret: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-sm" style={inputStyle} /></Champ>
                <Champ label="Taux horaire payé (€/h)"><input type="number" min="0" step="0.5" value={form.hourlyRate} onChange={e => setForm(f => ({ ...f, hourlyRate: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-sm" style={inputStyle} /></Champ>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={enregistrer} disabled={envoi} className="px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>Enregistrer</button>
                <button onClick={basculer} disabled={envoi} className="px-4 py-2.5 rounded-xl text-sm border disabled:opacity-50"
                  style={{ borderColor: actif ? '#EAC4BE' : '#E8E4DC', color: actif ? '#B85A50' : '#5A8A6A' }}>
                  {actif ? 'Suspendre' : 'Réactiver'}
                </button>
              </div>
              <div className="flex gap-2 items-end max-w-md">
                <Champ label="Nouveau mot de passe"><input value={mdp} onChange={e => setMdp(e.target.value)} placeholder="6 caractères minimum" className="w-full px-3 py-2.5 rounded-xl text-sm" style={inputStyle} /></Champ>
                <button onClick={changerMdp} disabled={envoi || mdp.length < 6} className="px-4 py-2.5 rounded-xl text-sm border disabled:opacity-40" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>Changer</button>
              </div>
            </div>
          )}

          {onglet === 'agents' && (
            agents === null ? <p className="text-sm" style={{ color: '#A8A09A' }}>Chargement…</p>
              : agents.length === 0 ? <p className="text-sm" style={{ color: '#A8A09A' }}>Le prestataire n’a encore créé aucun agent.</p>
              : (
                <div className="divide-y rounded-xl border" style={{ borderColor: '#E8E4DC' }}>
                  {agents.map(a => (
                    <div key={a.id} className="px-4 py-2.5 flex items-center justify-between gap-3" style={{ borderColor: '#F2EFE9' }}>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: '#1A1A1A' }}>{a.name}</p>
                        <p className="text-xs truncate" style={{ color: '#A8A09A' }}>{a.email}{a.phone ? ` · ${a.phone}` : ''}</p>
                      </div>
                      <span className="text-xs font-semibold" style={{ color: a.status === 'active' ? '#5A8A6A' : '#A8A09A' }}>
                        {a.status === 'active' ? 'Actif' : 'Désactivé'}
                      </span>
                    </div>
                  ))}
                </div>
              )
          )}

          {onglet === 'releve' && <ReleveMois prestataireId={p.id} />}
        </div>
      )}
    </div>
  );
}
