'use client';

import { useState, useEffect, useCallback } from 'react';
import { appelPrestataire, libelleMois, type Prestataire, type Agent } from '@/lib/prestataireApi';
import { inputStyle } from '@/lib/ui';
import { money } from '@/lib/format';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import ReleveMois from '@/components/ReleveMois';
import DocumentsPrestataire from '@/components/DocumentsPrestataire';
import { useFeedback } from '@/contexts/FeedbackContext';
import { METIERS, specialitesDuMetier, libelleSpecialite, libelleMetier, metierValide, type Metier } from '@/lib/prestataireRegles';

// ════════════════════════════════════════════════════════════════════════════
//  Prestataires (sous-traitants) — entreprises extérieures à qui l'on confie
//  des missions. Elles gèrent elles-mêmes leurs agents depuis leur espace ;
//  on leur doit leur taux horaire × durée de chaque mission terminée.
//  On confie une mission depuis sa fiche (Missions › « Confier à un prestataire »).
// ════════════════════════════════════════════════════════════════════════════

const VIDE = { name: '', contactName: '', email: '', phone: '', siret: '', hourlyRate: '', password: '', metier: 'nettoyage' as Metier, specialites: [] as string[] };

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
    toast(`Prestataire créé. Il se connecte avec ${form.phone} et son mot de passe.`, 'success');
    setForm(VIDE); setAjout(false);
    await charger();
  }

  const demandes = (liste ?? []).filter(p => p.en_attente);
  const valides = (liste ?? []).filter(p => !p.en_attente);
  const actifs = valides.filter(p => p.status === 'active').length;

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
            <Champ label="Téléphone (identifiant) *"><input required type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-sm" style={inputStyle} /></Champ>
            <Champ label="Email *"><input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-sm" style={inputStyle} /></Champ>
            <Champ label="SIRET"><input value={form.siret} onChange={e => setForm(f => ({ ...f, siret: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-sm" style={inputStyle} /></Champ>
            <Champ label="Taux horaire payé (€/h) *"><input required type="number" min="0" step="0.5" inputMode="decimal" value={form.hourlyRate} onChange={e => setForm(f => ({ ...f, hourlyRate: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-sm" style={inputStyle} /></Champ>
            <Champ label="Mot de passe *"><input required minLength={6} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="6 caractères minimum" className="w-full px-3 py-2.5 rounded-xl text-sm" style={inputStyle} /></Champ>
          </div>
          <div className="mt-3">
            <ChoixSpecialites metier={form.metier} valeur={form.specialites}
              onMetier={m => setForm(f => ({ ...f, metier: m, specialites: [] }))}
              onChange={v => setForm(f => ({ ...f, specialites: v }))} />
          </div>
          <button type="submit" disabled={envoi} className="mt-5 px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
            {envoi ? 'Création…' : 'Créer le prestataire'}
          </button>
        </form>
      )}

      {demandes.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#C48A2A' }}>
            Demandes d’inscription · {demandes.length}
          </p>
          <div className="space-y-3">
            {demandes.map(p => <CarteDemande key={p.id} p={p} onChange={charger} />)}
          </div>
        </div>
      )}

      {liste === null ? <Loading variant="skeleton" rows={3} /> : valides.length === 0 && !ajout ? (
        <div className="rounded-2xl border p-8 text-center" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          <p className="text-sm" style={{ color: '#7A7068' }}>Aucun prestataire pour l’instant.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {valides.map(p => (
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

// Métier (nettoyage / artisan) et spécialités déclarées : pour savoir à qui confier quoi.
function ChoixSpecialites({ metier, valeur, onMetier, onChange }: {
  metier: Metier; valeur: string[]; onMetier: (m: Metier) => void; onChange: (v: string[]) => void;
}) {
  return (
    <div>
      <span className="block text-xs mb-1.5" style={{ color: '#A8A09A' }}>Métier</span>
      <div className="flex gap-1 mb-3 p-1 rounded-2xl w-fit" style={{ backgroundColor: '#F5F3EF' }}>
        {METIERS.map(m => (
          <button key={m.key} type="button" onClick={() => m.key !== metier && onMetier(m.key)}
            className="px-3 py-1.5 rounded-xl text-xs font-medium"
            style={{ backgroundColor: metier === m.key ? '#FFFFFF' : 'transparent', color: metier === m.key ? '#1A1A1A' : '#A8A09A' }}>
            {m.label}
          </button>
        ))}
      </div>
      <span className="block text-xs mb-1.5" style={{ color: '#A8A09A' }}>Spécialités</span>
      <div className="flex flex-wrap gap-2">
        {specialitesDuMetier(metier).map(sp => {
          const choisi = valeur.includes(sp.key);
          return (
            <button key={sp.key} type="button" aria-pressed={choisi}
              onClick={() => onChange(choisi ? valeur.filter(k => k !== sp.key) : [...valeur, sp.key])}
              className="px-3 py-1.5 rounded-full text-xs border"
              style={choisi
                ? { backgroundColor: '#C9A84C', borderColor: '#C9A84C', color: '#1A1A1A' }
                : { backgroundColor: '#FFFFFF', borderColor: '#E8E4DC', color: '#7A7068' }}>
              {sp.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Specialites({ keys }: { keys?: string[] }) {
  if (!keys?.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {keys.map(k => (
        <span key={k} className="text-[11px] px-2 py-0.5 rounded-full" style={{ backgroundColor: '#F5F3EF', color: '#7A7068' }}>
          {libelleSpecialite(k)}
        </span>
      ))}
    </div>
  );
}

// Demande venue de l'inscription publique : on la valide en fixant le taux
// qu'on lui paiera, ou on la refuse (le compte est alors supprimé).
function CarteDemande({ p, onChange }: { p: Prestataire; onChange: () => Promise<void> }) {
  const { toast, confirm } = useFeedback();
  const [taux, setTaux] = useState('');
  const [envoi, setEnvoi] = useState(false);

  async function valider() {
    setEnvoi(true);
    const r = await appelPrestataire('approve', { id: p.id, hourlyRate: Number(taux) });
    setEnvoi(false);
    if (!r.ok) { toast(r.error, 'error'); return; }
    toast(`${p.name} est validé : il peut se connecter et ajouter ses agents.`, 'success');
    await onChange();
  }

  async function refuser() {
    const ok = await confirm({
      title: `Refuser la demande de ${p.name} ?`,
      message: 'Le compte est supprimé : il ne pourra pas se connecter.',
      confirmLabel: 'Refuser', danger: true,
    });
    if (!ok) return;
    setEnvoi(true);
    const r = await appelPrestataire('refuse', { id: p.id });
    setEnvoi(false);
    if (!r.ok) { toast(r.error, 'error'); return; }
    toast('Demande refusée.', 'success');
    await onChange();
  }

  return (
    <div className="rounded-2xl border p-4 md:p-5" style={{ backgroundColor: '#FFFFFF', borderColor: '#C48A2A55' }}>
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="font-semibold" style={{ color: '#1A1A1A' }}>{p.name}</p>
          <p className="text-xs font-medium" style={{ color: '#C48A2A' }}>{libelleMetier(p.metier)}</p>
          <p className="text-xs" style={{ color: '#7A7068' }}>
            {[p.contact_name, p.email, p.phone].filter(Boolean).join(' · ')}
          </p>
          {p.siret && <p className="text-xs" style={{ color: '#A8A09A' }}>SIRET {p.siret}</p>}
          <Specialites keys={p.specialites} />
        </div>
        {p.created_at && (
          <span className="text-[11px]" style={{ color: '#A8A09A' }}>
            Reçue le {new Date(p.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
          </span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input type="number" min="0" step="0.5" inputMode="decimal" value={taux} onChange={e => setTaux(e.target.value)}
          placeholder="Taux" className="w-24 px-3 py-2 rounded-xl text-sm border text-right" style={inputStyle} />
        <span className="text-sm" style={{ color: '#7A7068' }}>€ / h</span>
        <button onClick={valider} disabled={envoi || !(Number(taux) > 0)}
          className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
          Valider
        </button>
        <button onClick={refuser} disabled={envoi}
          className="px-4 py-2 rounded-xl text-sm border disabled:opacity-40" style={{ borderColor: '#EAC4BE', color: '#B85A50' }}>
          Refuser
        </button>
      </div>
    </div>
  );
}

function CartePrestataire({ p, periode, ouvert, onToggle, onChange }: {
  p: Prestataire; periode: string; ouvert: boolean; onToggle: () => void; onChange: () => Promise<void>;
}) {
  const { toast, confirm } = useFeedback();
  const [onglet, setOnglet] = useState<'fiche' | 'agents' | 'releve' | 'documents'>('fiche');
  const [form, setForm] = useState({
    name: p.name, contactName: p.contact_name ?? '', email: p.email ?? '', phone: p.phone ?? '',
    siret: p.siret ?? '', hourlyRate: String(p.hourly_rate ?? 0), sapDeclare: p.sap_declare === true,
    metier: metierValide(p.metier), specialites: p.specialites ?? [],
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
            {p.metier === 'artisan' && <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#4A6A8A14', color: '#3F5A78' }}>Artisan</span>}
            {p.sap_declare && <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#5A8A6A14', color: '#3F6B4F' }}>SAP</span>}
            {p.vigilance_ok === false && <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#C48A2A15', color: '#C48A2A' }}>Documents à jour : non</span>}
          </div>
          <p className="text-xs truncate" style={{ color: '#A8A09A' }}>
            {money(p.hourly_rate)}/h · {p.agents ?? 0} agent{(p.agents ?? 0) > 1 ? 's' : ''}{p.contact_name ? ` · ${p.contact_name}` : ''}
          </p>
          <Specialites keys={p.specialites} />
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold" style={{ color: '#C9A84C' }}>{money(p.duMois ?? 0)}</p>
          <p className="text-[11px]" style={{ color: '#A8A09A' }}>{periode ? libelleMois(periode) : ''}</p>
        </div>
      </button>

      {ouvert && (
        <div className="px-4 md:px-6 pb-5 border-t" style={{ borderColor: '#F2EFE9' }}>
          <div className="flex gap-1 my-4 p-1 rounded-2xl w-fit" style={{ backgroundColor: '#F5F3EF' }}>
            {([['fiche', 'Fiche'], ['agents', 'Agents'], ['releve', 'Relevé'], ['documents', 'Documents']] as const).map(([k, l]) => (
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
                <Champ label="Email"><input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-sm" style={inputStyle} /></Champ>
                <Champ label="Téléphone (identifiant)"><input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-sm" style={inputStyle} /></Champ>
                <Champ label="SIRET"><input value={form.siret} onChange={e => setForm(f => ({ ...f, siret: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-sm" style={inputStyle} /></Champ>
                <Champ label="Taux horaire payé (€/h)"><input type="number" min="0" step="0.5" value={form.hourlyRate} onChange={e => setForm(f => ({ ...f, hourlyRate: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl text-sm" style={inputStyle} /></Champ>
              </div>
              <ChoixSpecialites metier={form.metier} valeur={form.specialites}
                onMetier={m => setForm(f => ({ ...f, metier: m, specialites: [] }))}
                onChange={v => setForm(f => ({ ...f, specialites: v }))} />
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input type="checkbox" checked={form.sapDeclare} onChange={e => setForm(f => ({ ...f, sapDeclare: e.target.checked }))}
                  className="mt-0.5 w-4 h-4 accent-[#C9A84C]" />
                <span>
                  <span className="block text-sm font-medium" style={{ color: '#1A1A1A' }}>Déclaré services à la personne (SAP)</span>
                  <span className="block text-xs" style={{ color: '#A8A09A' }}>Peut recevoir les ménages au domicile de particuliers (crédit d’impôt).</span>
                </span>
              </label>
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
          {onglet === 'documents' && <DocumentsPrestataire prestataireId={p.id} />}
        </div>
      )}
    </div>
  );
}
