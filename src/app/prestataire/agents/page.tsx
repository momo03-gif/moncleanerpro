'use client';

import { useState, useEffect, useCallback } from 'react';
import { appelPrestataire, type Agent } from '@/lib/prestataireApi';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';

// ════════════════════════════════════════════════════════════════════════════
//  Espace prestataire — ses agents. Chaque agent a ses propres identifiants
//  et se connecte à l'application terrain (la même que nos cleaners), où il
//  ne voit que les missions que son prestataire lui a données.
// ════════════════════════════════════════════════════════════════════════════

const inputStyle = { backgroundColor: '#FFFFFF', border: '1px solid #E8E4DC', color: '#1A1A1A', outline: 'none' };
const VIDE = { name: '', email: '', phone: '', password: '' };

export default function PrestataireAgentsPage() {
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [ajout, setAjout] = useState(false);
  const [form, setForm] = useState(VIDE);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const [info, setInfo] = useState('');

  const charger = useCallback(async () => {
    const r = await appelPrestataire<{ agents: Agent[] }>('agents');
    setAgents(r.ok ? r.agents : []);
    if (!r.ok) setErreur(r.error);
  }, []);

  useEffect(() => {
    let actif = true;
    (async () => { if (actif) await charger(); })();
    return () => { actif = false; };
  }, [charger]);

  async function creer(e: React.FormEvent) {
    e.preventDefault();
    setEnvoi(true); setErreur(''); setInfo('');
    const r = await appelPrestataire('agent-create', form);
    setEnvoi(false);
    if (!r.ok) { setErreur(r.error); return; }
    setInfo(`Compte créé. ${form.name} se connecte sur l’application avec ${form.email} et le mot de passe choisi.`);
    setForm(VIDE); setAjout(false);
    await charger();
  }

  const actifs = (agents ?? []).filter(a => a.status === 'active');
  const inactifs = (agents ?? []).filter(a => a.status !== 'active');

  return (
    <div className="p-5">
      <div className="mb-5 pt-2 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1A1A1A' }}>Mes agents</h1>
          <p className="text-sm mt-1" style={{ color: '#A8A09A' }}>Ils réalisent les missions avec l’application terrain.</p>
        </div>
        {!ajout && (
          <button onClick={() => { setAjout(true); setInfo(''); setErreur(''); }}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-1.5 shrink-0" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
            <Icon name="plus" size={16} /> Ajouter
          </button>
        )}
      </div>

      {info && <p className="text-sm mb-4 px-3 py-2 rounded-lg" style={{ backgroundColor: '#5A8A6A14', color: '#3F6B4F' }}>{info}</p>}
      {erreur && !ajout && <p className="text-sm mb-4 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEF2F2', color: '#B85A50' }}>{erreur}</p>}

      {ajout && (
        <form onSubmit={creer} className="rounded-2xl border p-4 mb-5 space-y-3" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>Nouvel agent</p>
          <input required placeholder="Nom et prénom" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl text-sm" style={inputStyle} />
          <input required type="email" placeholder="Email (identifiant de connexion)" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl text-sm" style={inputStyle} />
          <input type="tel" placeholder="Téléphone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl text-sm" style={inputStyle} />
          <input required minLength={6} placeholder="Mot de passe (6 caractères minimum)" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl text-sm" style={inputStyle} />
          {erreur && <p className="text-xs" style={{ color: '#B85A50' }}>{erreur}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={envoi} className="flex-1 py-3 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
              {envoi ? 'Création…' : 'Créer le compte'}
            </button>
            <button type="button" onClick={() => { setAjout(false); setErreur(''); }} className="px-4 py-3 rounded-xl text-sm font-semibold border" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>
              Annuler
            </button>
          </div>
        </form>
      )}

      {agents === null ? <Loading variant="skeleton" rows={3} /> : agents.length === 0 && !ajout ? (
        <p className="text-sm text-center py-12" style={{ color: '#A8A09A' }}>Aucun agent pour l’instant.</p>
      ) : (
        <div className="space-y-3">
          {actifs.map(a => <CarteAgent key={a.id} agent={a} onChange={charger} />)}
          {inactifs.length > 0 && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wider pt-3" style={{ color: '#A8A09A' }}>Désactivés</p>
              {inactifs.map(a => <CarteAgent key={a.id} agent={a} onChange={charger} />)}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CarteAgent({ agent, onChange }: { agent: Agent; onChange: () => Promise<void> }) {
  const [mode, setMode] = useState<null | 'modifier' | 'mdp'>(null);
  const [form, setForm] = useState({ name: agent.name, email: agent.email ?? '', phone: agent.phone ?? '' });
  const [mdp, setMdp] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const actif = agent.status === 'active';

  async function executer(op: string, corps: Record<string, unknown>, succes: string) {
    setEnvoi(true); setMessage(null);
    const r = await appelPrestataire<{ rendues?: number }>(op, { id: agent.id, ...corps });
    setEnvoi(false);
    if (!r.ok) { setMessage({ ok: false, texte: r.error }); return; }
    const rendues = r.rendues ? ` ${r.rendues} mission(s) à réattribuer.` : '';
    setMessage({ ok: true, texte: succes + rendues });
    setMode(null); setMdp('');
    await onChange();
  }

  return (
    <div className="rounded-2xl border p-4" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC', opacity: actif ? 1 : 0.7 }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold truncate" style={{ color: '#1A1A1A' }}>{agent.name}</p>
          <p className="text-sm truncate" style={{ color: '#7A7068' }}>{agent.email}{agent.phone ? ` · ${agent.phone}` : ''}</p>
        </div>
        <button onClick={() => executer('agent-active', { active: !actif }, actif ? 'Agent désactivé.' : 'Agent réactivé.')} disabled={envoi}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border shrink-0" style={{ borderColor: '#E8E4DC', color: actif ? '#B85A50' : '#5A8A6A' }}>
          {actif ? 'Désactiver' : 'Réactiver'}
        </button>
      </div>

      {actif && mode === null && (
        <div className="flex gap-3 mt-3">
          <button onClick={() => setMode('modifier')} className="text-xs font-semibold" style={{ color: '#7A7068' }}>Modifier</button>
          <button onClick={() => setMode('mdp')} className="text-xs font-semibold" style={{ color: '#7A7068' }}>Nouveau mot de passe</button>
        </div>
      )}

      {mode === 'modifier' && (
        <div className="mt-3 space-y-2">
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nom"
            className="w-full px-3 py-2.5 rounded-xl text-sm" style={inputStyle} />
          <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Email"
            className="w-full px-3 py-2.5 rounded-xl text-sm" style={inputStyle} />
          <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Téléphone"
            className="w-full px-3 py-2.5 rounded-xl text-sm" style={inputStyle} />
          <div className="flex gap-2">
            <button onClick={() => executer('agent-update', form, 'Enregistré.')} disabled={envoi}
              className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>Enregistrer</button>
            <button onClick={() => setMode(null)} className="px-4 py-2 rounded-xl text-sm font-semibold border" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>Annuler</button>
          </div>
        </div>
      )}

      {mode === 'mdp' && (
        <div className="mt-3 flex gap-2">
          <input value={mdp} onChange={e => setMdp(e.target.value)} placeholder="6 caractères minimum"
            className="flex-1 min-w-0 px-3 py-2.5 rounded-xl text-sm" style={inputStyle} />
          <button onClick={() => executer('agent-password', { password: mdp }, 'Mot de passe changé.')} disabled={envoi || mdp.length < 6}
            className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>OK</button>
          <button onClick={() => { setMode(null); setMdp(''); }} className="px-3 py-2 rounded-xl text-sm border" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>
            <Icon name="close" size={14} />
          </button>
        </div>
      )}

      {message && <p className="text-xs mt-2" style={{ color: message.ok ? '#3F6B4F' : '#B85A50' }}>{message.texte}</p>}
    </div>
  );
}
