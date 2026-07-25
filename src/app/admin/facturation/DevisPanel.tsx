'use client';

import { useState, useEffect, useCallback } from 'react';
import type { CompanyInfo } from '@/lib/types';
import { inputStyle } from '@/lib/ui';
import {
  getTarifsDB, createTarifDB, updateTarifDB, deleteTarifDB, UNITE_LABEL, type Tarif, type TarifUnite,
  getDevisListDB, saveDevisDB, updateDevisDB, nextDevisNumberDB, setDevisStatusDB, convertDevisToInvoiceDB,
  type Devis, type DevisLine,
} from '@/lib/devis';
import { InvoiceDoc } from './page';

function money(n: number) { return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'; }

const STATUT_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  brouillon: { label: 'Brouillon', color: '#7A7068', bg: '#F5F3EF' },
  envoye:    { label: 'Envoyé',    color: '#C48A2A', bg: '#FBF4E2' },
  accepte:   { label: 'Accepté',   color: '#4E7D5E', bg: '#EAF3EC' },
  refuse:    { label: 'Refusé',    color: '#B85A50', bg: '#FBECEA' },
};

// ── Modèles rapides : un clic pré-remplit les lignes de base (adaptables ensuite). ──
// Objectif : rendre le devis TRÈS rapide à faire. Les prix sont repris de la grille
// tarifs quand un tarif correspond au nom, sinon 0 (à ajuster).
const DEVIS_MODELES: { label: string; lignes: string[] }[] = [
  { label: 'Studio / T1', lignes: ['Ménage complet studio', 'Salle de bain', 'Cuisine', 'Sols & surfaces', 'Poubelles & évacuation'] },
  { label: 'T2', lignes: ['Ménage complet T2', 'Chambre', 'Salle de bain', 'Cuisine', 'Sols & surfaces', 'Poubelles & évacuation'] },
  { label: 'T3', lignes: ['Ménage complet T3', 'Chambre 1', 'Chambre 2', 'Salle de bain', 'Cuisine', 'Sols & surfaces', 'Poubelles & évacuation'] },
  { label: 'T4 / +', lignes: ['Ménage complet T4', 'Chambre 1', 'Chambre 2', 'Chambre 3', 'Salle de bain', 'Cuisine', 'Sols & surfaces', 'Poubelles & évacuation'] },
  { label: 'Espace commune', lignes: ["Hall d'entrée", "Cage d'escalier", 'Ascenseur', 'Local poubelles', 'Vitres parties communes'] },
  { label: 'Bureaux', lignes: ['Postes de travail', 'Sanitaires', 'Salle de réunion', 'Espace accueil', 'Sols & surfaces', 'Poubelles & réassort'] },
  // Recouche : ménage EN COURS DE SÉJOUR (client qui reste longtemps).
  { label: 'Recouche + linge', lignes: ['Ménage des espaces de vie', 'Salle de bain', 'Cuisine', 'Change complet du linge (lits + toilette)', 'Poubelles & évacuation'] },
  { label: 'Recouche (espace de vie)', lignes: ['Ménage des espaces de vie', 'Salle de bain', 'Cuisine', 'Poubelles & évacuation'] },
];
// Options à ajouter à la volée (une ligne chacune).
const DEVIS_OPTIONS: string[] = [
  'Gestion du linge', 'Fourniture des consommables', 'Ménage approfondi',
];

export default function DevisPanel({ company }: { company: CompanyInfo }) {
  const [sub, setSub] = useState<'new' | 'history' | 'tarifs'>('new');
  const [tarifs, setTarifs] = useState<Tarif[]>([]);
  const [devisList, setDevisList] = useState<Devis[]>([]);
  // Brouillon en cours de modification (null = création d'un nouveau devis).
  const [editing, setEditing] = useState<Devis | null>(null);

  const load = useCallback(async () => {
    const [t, d] = await Promise.all([getTarifsDB(), getDevisListDB()]);
    setTarifs(t); setDevisList(d);
  }, []);
  useEffect(() => { load(); }, [load]);

  function startEdit(d: Devis) { setEditing(d); setSub('new'); }

  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-5 p-1 rounded-2xl w-fit" style={{ backgroundColor: '#F5F3EF' }}>
        {([['new', editing ? `Modifier ${editing.number}` : 'Nouveau devis'], ['history', `Historique devis (${devisList.length})`], ['tarifs', 'Tarifs']] as const).map(([v, label]) => (
          <button key={v} onClick={() => { if (v !== 'new') setEditing(null); setSub(v); }} className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{ backgroundColor: sub === v ? '#FFFFFF' : 'transparent', color: sub === v ? '#1A1A1A' : '#A8A09A', boxShadow: sub === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
            {label}
          </button>
        ))}
      </div>

      {sub === 'new' && <NewDevis company={company} tarifs={tarifs.filter(t => t.actif)} editing={editing} onSaved={() => { setEditing(null); load(); }} onCancelEdit={() => setEditing(null)} />}
      {sub === 'history' && <DevisHistory company={company} list={devisList} onChanged={load} onEdit={startEdit} />}
      {sub === 'tarifs' && <TarifsManager tarifs={tarifs} onChanged={load} />}
    </div>
  );
}

// ── NOUVEAU DEVIS / MODIFICATION (manuel + IA) ──────────────────────────────────
function NewDevis({ company, tarifs, editing, onSaved, onCancelEdit }: { company: CompanyInfo; tarifs: Tarif[]; editing: Devis | null; onSaved: () => void; onCancelEdit: () => void }) {
  const [client, setClient] = useState({ name: '', email: '', address: '' });
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<DevisLine[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMsg, setAiMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedNumber, setSavedNumber] = useState('');

  // Pré-remplit le formulaire quand on ouvre un brouillon en modification.
  useEffect(() => {
    if (editing) {
      setClient({ name: editing.clientName ?? editing.partnerLabel ?? '', email: editing.clientEmail ?? '', address: editing.clientAddress ?? '' });
      setDescription(editing.description ?? '');
      setLines(editing.lines ?? []);
      setSavedNumber('');
    }
  }, [editing]);

  const total = lines.reduce((s, l) => s + l.total, 0);

  function addTarif(t: Tarif) {
    setLines(ls => [...ls, { nom: t.nom, quantite: 1, prix_unitaire: t.prix, total: t.prix }]);
  }
  function addBlank() { setLines(ls => [...ls, { nom: '', quantite: 1, prix_unitaire: 0, total: 0 }]); }

  // Prix suggéré pour un nom de ligne : cherche un tarif dont le nom correspond
  // (l'un contient l'autre, insensible à la casse), sinon 0 (à ajuster à la main).
  function priceFor(nom: string): number {
    const n = nom.toLowerCase().trim();
    const t = tarifs.find(t => { const tn = t.nom.toLowerCase().trim(); return tn && (n.includes(tn) || tn.includes(n)); });
    return t?.prix ?? 0;
  }
  function addLignes(noms: string[]) {
    setLines(ls => [...ls, ...noms.map(nom => { const p = priceFor(nom); return { nom, quantite: 1, prix_unitaire: p, total: p }; })]);
  }
  function applyModele(noms: string[]) { setLines([]); addLignes(noms); }
  function updateLine(i: number, patch: Partial<DevisLine>) {
    setLines(ls => ls.map((l, idx) => {
      if (idx !== i) return l;
      const m = { ...l, ...patch };
      m.total = Math.round((Number(m.quantite) || 0) * (Number(m.prix_unitaire) || 0) * 100) / 100;
      return m;
    }));
  }
  function removeLine(i: number) { setLines(ls => ls.filter((_, idx) => idx !== i)); }

  async function generateAI() {
    setAiBusy(true); setAiMsg('');
    try {
      const res = await fetch('/api/devis-ai', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ description }),
      });
      const data = await res.json();
      if (data.error) { setAiMsg(data.error); }
      else if (Array.isArray(data.lignes)) { setLines(data.lignes); setAiMsg(`Devis pré-rempli (${data.lignes.length} ligne(s)). Vérifie puis valide.`); }
    } catch {
      setAiMsg('Erreur de connexion à l’IA — saisis le devis à la main.');
    }
    setAiBusy(false);
  }

  async function save(status: 'brouillon' | 'envoye') {
    if (lines.length === 0) return;
    setSaving(true);
    // MODIFICATION d'un devis existant : on met à jour le MÊME devis (même numéro).
    if (editing) {
      const res = await updateDevisDB(editing.id, {
        clientName: client.name, clientEmail: client.email, clientAddress: client.address,
        description, lines, total, validUntil: editing.validUntil, status,
      });
      setSaving(false);
      if (!res.error) {
        setSavedNumber(editing.number);
        setClient({ name: '', email: '', address: '' }); setDescription(''); setLines([]);
        onSaved();
      }
      return;
    }
    // CRÉATION d'un nouveau devis.
    const number = await nextDevisNumberDB();
    const validUntil = new Date(Date.now() + 30 * 86400000).toLocaleDateString('en-CA');
    const res = await saveDevisDB({
      number, partnerLabel: client.name || 'Client', partnerType: 'devis',
      clientName: client.name, clientEmail: client.email, clientAddress: client.address,
      description, lines, total, validUntil, status,
    });
    setSaving(false);
    if (!res.error) {
      setSavedNumber(number);
      setClient({ name: '', email: '', address: '' }); setDescription(''); setLines([]);
      onSaved();
    }
  }

  return (
    <div className="space-y-5">
      {editing && !savedNumber && (
        <div className="rounded-xl px-4 py-3 text-sm font-medium flex items-center justify-between gap-3" style={{ backgroundColor: '#FBF4E2', color: '#C48A2A' }}>
          <span>Modification du devis {editing.number}. Enregistre pour mettre à jour ce devis.</span>
          <button onClick={onCancelEdit} className="text-xs font-semibold underline shrink-0">Annuler</button>
        </div>
      )}
      {savedNumber && (
        <div className="rounded-xl px-4 py-3 text-sm font-medium" style={{ backgroundColor: '#EAF3EC', color: '#4E7D5E' }}>
          Devis {savedNumber} {editing ? 'mis à jour' : 'enregistré'}. Retrouve-le dans « Historique devis ».
        </div>
      )}

      {/* Client */}
      <div className="rounded-2xl border p-5" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#7A7068' }}>Client</p>
        <div className="grid sm:grid-cols-3 gap-3">
          <input value={client.name} onChange={e => setClient(c => ({ ...c, name: e.target.value }))} placeholder="Nom" className="px-3 py-2.5 rounded-xl text-sm" style={{ ...inputStyle }} />
          <input value={client.email} onChange={e => setClient(c => ({ ...c, email: e.target.value }))} placeholder="Email" className="px-3 py-2.5 rounded-xl text-sm" style={{ ...inputStyle }} />
          <input value={client.address} onChange={e => setClient(c => ({ ...c, address: e.target.value }))} placeholder="Adresse" className="px-3 py-2.5 rounded-xl text-sm" style={{ ...inputStyle }} />
        </div>
      </div>

      {/* Modèles rapides : un clic pour pré-remplir un devis type (adaptable ensuite). */}
      <div className="rounded-2xl border p-5" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#7A7068' }}>Modèles rapides</p>
        <p className="text-[11px] mb-3" style={{ color: '#A8A09A' }}>Un clic charge les lignes de base. Tout reste modifiable (noms, quantités, prix).</p>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {DEVIS_MODELES.map(m => (
            <button key={m.label} onClick={() => applyModele(m.lignes)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
              style={{ borderColor: '#C9A84C', color: '#9A7B22', backgroundColor: '#C9A84C10' }}>
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] mb-2" style={{ color: '#A8A09A' }}>Options à ajouter :</p>
        <div className="flex flex-wrap gap-1.5">
          {DEVIS_OPTIONS.map(opt => (
            <button key={opt} onClick={() => addLignes([opt])}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>
              + {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Assistant IA */}
      <div className="rounded-2xl border p-5" style={{ backgroundColor: '#FAFAF8', borderColor: '#E8E4DC' }}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#7A7068' }}>Décrire la prestation (assistant IA)</p>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
          placeholder="Ex : grand ménage de fin de bail pour un T3 au 4e étage sans ascenseur, avec nettoyage des vitres et du four."
          className="w-full px-3 py-2.5 rounded-xl text-sm mb-3" style={{ ...inputStyle }} />
        <div className="flex items-center gap-3">
          <button onClick={generateAI} disabled={aiBusy || !description.trim()}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
            {aiBusy ? 'Génération...' : 'Générer le devis avec l’IA'}
          </button>
          {aiMsg && <span className="text-xs" style={{ color: aiMsg.startsWith('Devis') ? '#5A8A6A' : '#B85A50' }}>{aiMsg}</span>}
        </div>
        <p className="text-[11px] mt-2" style={{ color: '#A8A09A' }}>Les prix viennent toujours de la grille tarifs. L’IA ne fait que proposer les lignes.</p>
      </div>

      {/* Lignes */}
      <div className="rounded-2xl border p-5" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#7A7068' }}>Lignes de prestation</p>
          <button onClick={addBlank} className="text-xs font-semibold" style={{ color: '#C9A84C' }}>+ Ligne libre</button>
        </div>

        {tarifs.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {tarifs.map(t => (
              <button key={t.id} onClick={() => addTarif(t)} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ backgroundColor: '#F5F3EF', color: '#7A7068' }}>
                + {t.nom} ({t.prix}€)
              </button>
            ))}
          </div>
        )}

        {lines.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: '#A8A09A' }}>Ajoute des lignes depuis la grille ou via l’IA.</p>
        ) : (
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={l.nom} onChange={e => updateLine(i, { nom: e.target.value })} placeholder="Prestation" className="flex-1 px-3 py-2 rounded-lg text-sm" style={{ ...inputStyle }} />
                <input type="number" min="1" value={l.quantite} onChange={e => updateLine(i, { quantite: Number(e.target.value) })} className="w-16 px-2 py-2 rounded-lg text-sm text-center" style={{ ...inputStyle }} />
                <input type="number" min="0" step="0.01" value={l.prix_unitaire} onChange={e => updateLine(i, { prix_unitaire: Number(e.target.value) })} className="w-24 px-2 py-2 rounded-lg text-sm text-right" style={{ ...inputStyle }} />
                <span className="w-24 text-right text-sm font-semibold" style={{ color: '#1A1A1A' }}>{money(l.total)}</span>
                <button onClick={() => removeLine(i)} style={{ color: '#B85A50' }}>✕</button>
              </div>
            ))}
            <div className="flex justify-end pt-2 border-t mt-2" style={{ borderColor: '#F2EFE9' }}>
              <span className="text-sm font-bold" style={{ color: '#1A1A1A' }}>Net à payer : {money(total)}</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button onClick={() => save('brouillon')} disabled={saving || lines.length === 0} className="px-5 py-2.5 rounded-xl text-sm font-semibold border disabled:opacity-50" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>
          {editing ? 'Enregistrer les modifications' : 'Enregistrer (brouillon)'}
        </button>
        <button onClick={() => save('envoye')} disabled={saving || lines.length === 0} className="px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>{saving ? '...' : 'Enregistrer & marquer envoyé'}</button>
        {editing && (
          <button onClick={onCancelEdit} disabled={saving} className="px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50" style={{ color: '#B85A50' }}>Annuler</button>
        )}
      </div>
    </div>
  );
}

// ── HISTORIQUE DEVIS ────────────────────────────────────────────────────────────
function DevisHistory({ company, list, onChanged, onEdit }: { company: CompanyInfo; list: Devis[]; onChanged: () => void; onEdit: (d: Devis) => void }) {
  const [viewing, setViewing] = useState<Devis | null>(null);
  const [convertMsg, setConvertMsg] = useState('');

  async function convert(d: Devis) {
    const res = await convertDevisToInvoiceDB(d);
    if (res.error) setConvertMsg(res.error);
    else { setConvertMsg(`Facture ${res.number} créée depuis ${d.number}.`); onChanged(); }
  }

  if (viewing) {
    const invLines = viewing.lines.map(l => ({ date: viewing.createdAt?.slice(0, 10) ?? '', label: l.nom, type: 'devis', amount: l.total, unitPrice: l.prix_unitaire }));
    return (
      <div>
        <button onClick={() => setViewing(null)} className="text-sm mb-4" style={{ color: '#C9A84C' }}>← Retour</button>
        <InvoiceDoc company={company} number={viewing.number} partnerLabel={viewing.partnerLabel || viewing.clientName || 'Client'}
          partnerType={viewing.partnerType} status={viewing.status === 'accepte' ? 'paid' : 'pending'}
          from={viewing.createdAt?.slice(0, 10) ?? ''} to={viewing.validUntil ?? ''} lines={invLines} total={viewing.total}
          docLabel="DEVIS" validUntil={viewing.validUntil} totalLabel="Net à payer" />
        <div className="flex gap-2 mt-4">
          <button onClick={() => window.print()} className="px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>Imprimer / PDF</button>
          {typeof window !== 'undefined' && (
            <button onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/devis/${viewing.publicToken}`)}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold border" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>Copier le lien client</button>
          )}
          {viewing.status === 'accepte' && !viewing.invoiceId && (
            <button onClick={() => convert(viewing)} className="px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#5A8A6A', color: '#FFFFFF' }}>Convertir en facture</button>
          )}
        </div>
        {convertMsg && <p className="text-sm mt-3" style={{ color: '#5A8A6A' }}>{convertMsg}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
      {convertMsg && <div className="px-5 py-3 text-sm" style={{ color: '#5A8A6A' }}>{convertMsg}</div>}
      {list.length === 0 && <div className="py-10 text-center text-sm" style={{ color: '#A8A09A' }}>Aucun devis</div>}
      {list.map((d, i) => {
        const badge = STATUT_BADGE[d.status] ?? STATUT_BADGE.brouillon;
        return (
          <div key={d.id} className={`px-5 py-4 flex items-center justify-between gap-3 ${i < list.length - 1 ? 'border-b' : ''}`} style={{ borderColor: '#F2EFE9' }}>
            <div className="min-w-0">
              <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{d.number} — {d.clientName || d.partnerLabel}</p>
              <p className="text-xs" style={{ color: '#A8A09A' }}>{money(d.total)}{d.source === 'public' ? ' · demande en ligne' : ''}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: badge.bg, color: badge.color }}>{badge.label}</span>
              {/* Seuls les brouillons sont modifiables (un devis envoyé/accepté est figé). */}
              {d.status === 'brouillon' && (
                <button onClick={() => onEdit(d)} className="px-3 py-1.5 rounded-xl text-xs font-semibold border" style={{ borderColor: '#C9A84C', color: '#9A7B22' }}>Modifier</button>
              )}
              <button onClick={() => setViewing(d)} className="px-3 py-1.5 rounded-xl text-xs font-semibold border" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>Ouvrir</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── GRILLE TARIFAIRE (LOT 8A) ───────────────────────────────────────────────────
const UNITES: TarifUnite[] = ['forfait', 'm2', 'heure', 'piece'];
function TarifsManager({ tarifs, onChanged }: { tarifs: Tarif[]; onChanged: () => void }) {
  const [form, setForm] = useState({ nom: '', unite: 'forfait' as TarifUnite, prix: 0 });

  async function add() {
    if (!form.nom.trim()) return;
    await createTarifDB({ nom: form.nom.trim(), unite: form.unite, prix: Number(form.prix) || 0 });
    setForm({ nom: '', unite: 'forfait', prix: 0 }); onChanged();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
        {tarifs.length === 0 && <div className="py-8 text-center text-sm" style={{ color: '#A8A09A' }}>Aucun tarif</div>}
        {tarifs.map((t, i) => (
          <div key={t.id} className={`px-5 py-3 flex items-center gap-3 ${i < tarifs.length - 1 ? 'border-b' : ''}`} style={{ borderColor: '#F2EFE9', opacity: t.actif ? 1 : 0.55 }}>
            <input defaultValue={t.nom} onBlur={e => e.target.value !== t.nom && updateTarifDB(t.id, { nom: e.target.value }).then(onChanged)} className="flex-1 px-2 py-1.5 rounded-lg text-sm" style={{ ...inputStyle }} />
            <select defaultValue={t.unite} onChange={e => updateTarifDB(t.id, { unite: e.target.value as TarifUnite }).then(onChanged)} className="px-2 py-1.5 rounded-lg text-sm" style={{ ...inputStyle }}>
              {UNITES.map(u => <option key={u} value={u}>{UNITE_LABEL[u]}</option>)}
            </select>
            <input type="number" defaultValue={t.prix} onBlur={e => Number(e.target.value) !== t.prix && updateTarifDB(t.id, { prix: Number(e.target.value) }).then(onChanged)} className="w-24 px-2 py-1.5 rounded-lg text-sm text-right" style={{ ...inputStyle }} />
            <button onClick={() => updateTarifDB(t.id, { actif: !t.actif }).then(onChanged)} className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: t.actif ? '#5A8A6A15' : '#F5F3EF', color: t.actif ? '#5A8A6A' : '#A8A09A' }}>{t.actif ? 'Actif' : 'Inactif'}</button>
            <button onClick={() => deleteTarifDB(t.id).then(onChanged)} style={{ color: '#B85A50' }}>✕</button>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border p-4 flex flex-wrap items-end gap-3" style={{ backgroundColor: '#FAFAF8', borderColor: '#E8E4DC' }}>
        <input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} placeholder="Nouvelle prestation" className="flex-1 min-w-[160px] px-3 py-2.5 rounded-xl text-sm" style={{ ...inputStyle }} />
        <select value={form.unite} onChange={e => setForm(f => ({ ...f, unite: e.target.value as TarifUnite }))} className="px-3 py-2.5 rounded-xl text-sm" style={{ ...inputStyle }}>
          {UNITES.map(u => <option key={u} value={u}>{UNITE_LABEL[u]}</option>)}
        </select>
        <input type="number" value={form.prix} onChange={e => setForm(f => ({ ...f, prix: Number(e.target.value) }))} placeholder="Prix" className="w-28 px-3 py-2.5 rounded-xl text-sm text-right" style={{ ...inputStyle }} />
        <button onClick={add} className="px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>Ajouter</button>
      </div>
    </div>
  );
}
