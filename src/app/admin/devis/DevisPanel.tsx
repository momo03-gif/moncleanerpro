'use client';

import { useState, useEffect, useCallback, useRef, type ChangeEvent } from 'react';
import type { CompanyInfo } from '@/lib/types';
import { inputStyle } from '@/lib/ui';
import {
  getTarifsDB, createTarifDB, updateTarifDB, deleteTarifDB, importTarifsDB, UNITE_LABEL, type Tarif, type TarifUnite,
  getDevisListDB, saveDevisDB, updateDevisDB, reviseDevisDB, nextDevisNumberDB, setDevisStatusDB, convertDevisToInvoiceDB,
  estimateFromDescription, type Devis, type DevisLine,
} from '@/lib/devis';
import { parseTarifsCsv } from '@/lib/tarifsCsv';
import { DEVIS_PENDING_EVENT } from '@/lib/events';
import { InvoiceDoc } from '@/components/InvoiceDoc';

// Modèle CSV téléchargeable (mêmes colonnes que l'export de la grille MonCleanerPro).
const CSV_TEMPLATE = `Prestation;Unité;Prix;Mots-clés;Actif
Entretien classique - T2;forfait;70-120;t2, deux pièces, appartement;oui
Nettoyage vitres;piece;6-12;vitres, fenêtres, baies, carreaux;oui
Fin de chantier;m2;5-12;travaux, rénovation, chantier;oui
Ménage régulier;heure;25-35;récurrent, entretien, heure;oui
`;

function money(n: number) { return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'; }

// Lien public du devis : accepter ET réserver son créneau se font au même endroit.
// Il ne change JAMAIS, même après correction — le client garde une seule adresse.
function devisUrl(d: Devis): string {
  return typeof window !== 'undefined' ? `${window.location.origin}/devis/${d.publicToken}` : `/devis/${d.publicToken}`;
}

// Email pré-rempli (modifiable ensuite par l'admin). Deux versions : premier envoi,
// ou renvoi d'un devis CORRIGÉ — dans ce cas le mot d'explication passe en tête,
// sinon le client relit une proposition qui a changé sans comprendre pourquoi.
function devisEmailDraft(d: Devis, company: CompanyInfo): { to: string; subject: string; body: string } {
  const url = devisUrl(d);
  // « Bonjour Jean » plutôt que le nom complet : plus naturel à l'oral comme à
  // l'écrit. On retombe sur la formule d'usage si le nom est vide.
  const prenom = (d.clientName ?? '').trim().split(/\s+/)[0];
  const nom = prenom || 'Madame, Monsieur';
  const nbPresta = d.lines.length;
  const ttc = money(d.total * 1.2);
  const valid = d.validUntil
    ? `\nCette proposition reste valable jusqu'au ${new Date(d.validUntil + 'T00:00:00').toLocaleDateString('fr-FR')}.\n`
    : '';
  const signature = `Cordialement,
${company.name || 'MonCleanerPro'}
${[company.phone, company.email].filter(Boolean).join(' · ')}`;

  if (d.revision > 1) {
    return {
      to: d.clientEmail ?? '',
      subject: `Votre devis ${d.number} corrigé — à valider`,
      body:
`Bonjour ${nom},

${d.revisionNote ?? ''}

Voici votre devis ${d.number} mis à jour : ${nbPresta} prestation${nbPresta > 1 ? 's' : ''} pour un total de ${ttc} TTC. Il annule et remplace la version précédente.

Tout se passe sur le même lien qu'avant :
${url}

Vous pourrez y faire deux choses :
  1. accepter ce devis corrigé en un clic ;
  2. choisir dans la foulée la date et l'heure de votre intervention.
${valid}
Une question, un ajustement ? Répondez simplement à cet email.

${signature}`,
    };
  }
  return {
    to: d.clientEmail ?? '',
    subject: `Votre devis ${d.number} — acceptez et réservez votre date`,
    body:
`Bonjour ${nom},

Merci pour votre confiance. Voici votre devis ${d.number} : ${nbPresta} prestation${nbPresta > 1 ? 's' : ''} pour un total de ${ttc} TTC.

Tout se passe sur un seul lien :
${url}

Vous pourrez y faire deux choses :
  1. accepter le devis en un clic ;
  2. choisir dans la foulée la date et l'heure de votre intervention.

Nous vous conseillons de réserver votre créneau dès l'acceptation : les disponibilités partent vite, et votre date n'est réservée qu'une fois le rendez-vous confirmé.
${valid}
Une question, un ajustement ? Répondez simplement à cet email.

${signature}`,
  };
}

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

// ── Messages types de CORRECTION d'un devis déjà envoyé ─────────────────────────
// Cas courant : le client a choisi une prestation qui ne correspond pas à son
// besoin. On lui renvoie le même devis corrigé avec un mot qui dit ce qui change
// — sinon il compare deux propositions sans savoir laquelle fait foi.
// Le texte cite les prestations retenues : le client voit tout de suite « la
// prestation, c'est celle-là ».
function listePrestations(lines: DevisLine[]): string {
  const noms = lines.map(l => l.nom.trim()).filter(Boolean);
  if (noms.length === 0) return 'la prestation retenue';
  if (noms.length <= 3) return noms.join(', ');
  return `${noms.slice(0, 3).join(', ')} et ${noms.length - 3} autre${noms.length - 3 > 1 ? 's' : ''} prestation${noms.length - 3 > 1 ? 's' : ''}`;
}
const CORRECTION_MODELES: { label: string; texte: (lines: DevisLine[]) => string }[] = [
  {
    label: 'Prestation mal choisie',
    texte: l => `Après avoir étudié votre demande, la prestation sélectionnée ne correspondait pas à votre besoin. Nous vous proposons celle qui convient : ${listePrestations(l)}. Ce devis remplace le précédent.`,
  },
  {
    label: 'Prestation oubliée',
    texte: l => `Une prestation manquait à votre demande. Nous avons complété le devis : ${listePrestations(l)}. Ce devis remplace le précédent.`,
  },
  {
    label: 'Tarif ajusté',
    texte: () => `Nous avons revu le chiffrage de votre devis. Le détail corrigé se trouve ci-dessous ; ce devis remplace le précédent.`,
  },
  {
    label: 'Après échange / visite',
    texte: l => `Suite à notre échange, nous avons ajusté votre devis pour coller à ce dont vous avez besoin : ${listePrestations(l)}. Ce devis remplace le précédent.`,
  },
];

export default function DevisPanel({ company }: { company: CompanyInfo }) {
  const [sub, setSub] = useState<'requests' | 'new' | 'history' | 'tarifs'>('requests');
  const [tarifs, setTarifs] = useState<Tarif[]>([]);
  const [devisList, setDevisList] = useState<Devis[]>([]);
  // Devis en cours de modification (null = création d'un nouveau devis).
  // Brouillon → simple mise à jour ; devis déjà envoyé → correction versionnée.
  const [editing, setEditing] = useState<Devis | null>(null);

  const load = useCallback(async () => {
    const [t, d] = await Promise.all([getTarifsDB(), getDevisListDB()]);
    setTarifs(t); setDevisList(d);
    // La pastille du menu doit dire la même chose que cet écran : on la met à jour
    // à chaque rechargement, sans requête supplémentaire. Sans ça elle restait sur
    // l'ancien compte tant qu'on ne changeait pas de page.
    if (typeof window !== 'undefined') {
      const pending = d.filter(x => x.source === 'public' && x.status === 'brouillon').length;
      window.dispatchEvent(new CustomEvent(DEVIS_PENDING_EVENT, { detail: pending }));
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Devis corrigé à renvoyer : on rebascule sur l'historique, fiche ouverte et
  // email de renvoi prêt — la correction ne sert à rien tant que le client ne l'a pas.
  const [resendId, setResendId] = useState<string | null>(null);

  function startEdit(d: Devis) { setEditing(d); setSub('new'); }
  async function afterSave(id?: string) {
    setEditing(null);
    // On recharge AVANT de basculer : l'historique doit afficher la version
    // corrigée, pas celle qu'on vient de remplacer.
    await load();
    if (id) { setResendId(id); setSub('history'); }
  }

  // Demandes de devis reçues et pas encore chiffrées. C'est la file d'attente de
  // l'écran : elle vaut notification, et remplace la cloche pour ce sujet.
  const requests = devisList.filter(d => d.source === 'public' && d.status === 'brouillon');

  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-1 mb-5 p-1 rounded-2xl w-fit" style={{ backgroundColor: '#F5F3EF' }}>
        {([
          ['requests', `Demandes à traiter${requests.length ? ` (${requests.length})` : ''}`],
          ['new', editing ? `${editing.status === 'brouillon' ? 'Modifier' : 'Corriger'} ${editing.number}` : 'Nouveau devis'],
          ['history', `Historique devis (${devisList.length})`],
          ['tarifs', 'Tarifs'],
        ] as const).map(([v, label]) => (
          <button key={v} onClick={() => { if (v !== 'new') setEditing(null); setResendId(null); setSub(v); }} className="px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2"
            style={{ backgroundColor: sub === v ? '#FFFFFF' : 'transparent', color: sub === v ? '#1A1A1A' : '#A8A09A', boxShadow: sub === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
            {label}
            {v === 'requests' && requests.length > 0 && (
              <span className="min-w-[8px] h-2 w-2 rounded-full" style={{ backgroundColor: '#E5484D' }} aria-label="demandes en attente" />
            )}
          </button>
        ))}
      </div>

      {sub === 'requests' && (
        <DevisRequests list={requests} onTraiter={startEdit} onNew={() => setSub('new')}
          onEcarter={async d => { await setDevisStatusDB(d.id, 'refuse'); await load(); }} />
      )}
      {sub === 'new' && <NewDevis company={company} tarifs={tarifs.filter(t => t.actif)} editing={editing} onSaved={afterSave} onCancelEdit={() => setEditing(null)} />}
      {sub === 'history' && <DevisHistory company={company} list={devisList} onChanged={load} onEdit={startEdit} resendId={resendId} />}
      {/* La grille a déménagé dans Tarification, rangée par carte de la page de
          devis. On garde l'import CSV ici — il sert au même endroit que la
          création de devis — mais l'édition ligne à ligne se fait là-bas :
          deux éditeurs finiraient par diverger. */}
      {sub === 'tarifs' && (
        <div className="space-y-4">
          <div className="rounded-2xl border p-5" style={{ backgroundColor: '#FCF6E8', borderColor: '#EBD9A8' }}>
            <p className="text-sm font-semibold" style={{ color: '#8A6A1E' }}>La grille se gère dans « Tarification »</p>
            <p className="text-xs mt-1" style={{ color: '#7A7068' }}>
              Les {tarifs.length} prestations y sont rangées par carte de la page de devis,
              avec le barème du simulateur Airbnb.
            </p>
            <a href="/admin/tarification" className="inline-block mt-3 text-xs font-semibold px-3 py-2 rounded-lg"
              style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>Ouvrir Tarification →</a>
          </div>
          <TarifsManager tarifs={tarifs} onChanged={load} />
        </div>
      )}
    </div>
  );
}

// ── DEMANDES DE DEVIS REÇUES ────────────────────────────────────────────────────
// Les demandes n'alertent plus dans la cloche générale : elles s'empilaient au
// milieu des missions et des rappels, et une demande de devis se traite ici, pas
// ailleurs. Cet onglet EST la notification — une demande y reste tant qu'elle
// n'est pas chiffrée, là où une notification lue disparaît qu'on l'ait traitée ou non.
function DevisRequests({ list, onTraiter, onNew, onEcarter }: { list: Devis[]; onTraiter: (d: Devis) => void; onNew: () => void; onEcarter: (d: Devis) => void }) {
  // Écarter demande une confirmation sur place (2e clic) : la demande porte le
  // nom et le besoin d'un vrai client, on ne la fait pas disparaître d'un clic.
  const [confirming, setConfirming] = useState<string | null>(null);

  if (list.length === 0) {
    return (
      <div className="rounded-2xl border p-10 text-center" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
        <p className="text-sm font-medium" style={{ color: '#7A7068' }}>Aucune demande en attente</p>
        <p className="text-xs mt-1.5" style={{ color: '#A8A09A' }}>
          Les demandes envoyées depuis le site ou l’espace partenaire arrivent ici.
        </p>
        <button onClick={onNew} className="mt-4 px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
          Créer un devis
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-2.5">
      <p className="text-xs px-1" style={{ color: '#A8A09A' }}>
        Une demande reste ici tant que le devis n’a pas été envoyé au client — l’ouvrir ne la fait pas disparaître.
      </p>
      {list.map(d => {
        const quand = d.createdAt ? new Date(d.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
        const origine = d.partnerType === 'airbnb' ? 'espace partenaire' : 'site public';
        return (
          <div key={d.id} className="rounded-2xl border p-4 flex items-start justify-between gap-4" style={{ backgroundColor: '#FFFFFF', borderColor: '#EBD9A8' }}>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{d.clientName || d.partnerLabel || 'Client'}</p>
                <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: '#FBF4E2', color: '#C48A2A' }}>À traiter</span>
              </div>
              <p className="text-xs mt-1" style={{ color: '#A8A09A' }}>
                {d.number} · demande reçue {quand ? `le ${quand}` : ''} depuis le {origine}
                {d.total > 0 ? ` · estimation ${money(d.total)}` : ''}
              </p>
              {d.description && (
                <p className="text-sm mt-2 line-clamp-3" style={{ color: '#7A7068' }}>{d.description}</p>
              )}
              {/* Une ligne par information. Le téléphone d'abord et en lien
                  d'appel : sur mobile, traiter une demande commence par appeler. */}
              {d.clientPhone && (
                <p className="text-sm mt-2">
                  <a href={`tel:${d.clientPhone.replace(/\s+/g, '')}`} className="font-semibold hover:underline" style={{ color: '#C9A84C' }}>
                    {d.clientPhone}
                  </a>
                </p>
              )}
              {d.clientEmail && (
                <p className="text-xs mt-1">
                  <a href={`mailto:${d.clientEmail}`} className="hover:underline" style={{ color: '#7A7068' }}>{d.clientEmail}</a>
                </p>
              )}
              {d.clientAddress && <p className="text-xs mt-1" style={{ color: '#A8A09A' }}>{d.clientAddress}</p>}
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <button onClick={() => onTraiter(d)} className="px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
                Chiffrer
              </button>
              {confirming === d.id ? (
                <div className="flex items-center gap-2">
                  <button onClick={() => { setConfirming(null); onEcarter(d); }} className="text-xs font-semibold" style={{ color: '#B85A50' }}>Confirmer</button>
                  <button onClick={() => setConfirming(null)} className="text-xs" style={{ color: '#A8A09A' }}>Annuler</button>
                </div>
              ) : (
                <button onClick={() => setConfirming(d.id)} className="text-xs" style={{ color: '#A8A09A' }}>Écarter</button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── NOUVEAU DEVIS / MODIFICATION (manuel + IA) ──────────────────────────────────
function NewDevis({ company, tarifs, editing, onSaved, onCancelEdit }: { company: CompanyInfo; tarifs: Tarif[]; editing: Devis | null; onSaved: (resendId?: string) => void; onCancelEdit: () => void }) {
  const [client, setClient] = useState({ name: '', email: '', phone: '', address: '' });
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<DevisLine[]>([]);
  const [aiMsg, setAiMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedNumber, setSavedNumber] = useState('');
  // Mot d'explication de la correction, montré au client sur son lien et repris
  // dans l'email de renvoi. Obligatoire : un devis qui change sans un mot d'excuse
  // ni d'explication, c'est un client qui appelle.
  const [note, setNote] = useState('');
  const [saveErr, setSaveErr] = useState('');

  // Devis déjà parti chez le client : on ne l'écrase pas en silence, on le CORRIGE
  // (nouvelle version + explication). Un brouillon reste une simple modification.
  const correcting = !!editing && editing.status !== 'brouillon';

  // Pré-remplit le formulaire quand on ouvre un devis en modification.
  useEffect(() => {
    if (editing) {
      setClient({ name: editing.clientName ?? editing.partnerLabel ?? '', email: editing.clientEmail ?? '', phone: editing.clientPhone ?? '', address: editing.clientAddress ?? '' });
      setDescription(editing.description ?? '');
      setLines(editing.lines ?? []);
      setSavedNumber(''); setNote(''); setSaveErr('');
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

  // Agent d'estimation LOCAL (grille tarifs + mots-clés) — aucune IA externe.
  // Reconnaît les prestations dans la description et pré-remplit les lignes.
  function generateFromText() {
    setAiMsg('');
    const found = estimateFromDescription(description, tarifs);
    if (found.length === 0) { setAiMsg('Aucune prestation reconnue — ajoute-les depuis la grille, ou complète les mots-clés dans l’onglet Tarifs.'); return; }
    setLines(found);
    setAiMsg(`Devis pré-rempli (${found.length} ligne(s)). Vérifie puis valide.`);
  }

  // CORRECTION d'un devis déjà envoyé : même numéro, même lien, version + 1.
  // On enchaîne directement sur le renvoi au client — corriger sans prévenir
  // laisserait le client sur l'ancienne proposition.
  async function saveCorrection() {
    if (!editing || lines.length === 0) return;
    if (!note.trim()) { setSaveErr('Explique au client ce qui change (il verra ce message sur son lien).'); return; }
    setSaving(true); setSaveErr('');
    const res = await reviseDevisDB(editing.id, {
      clientName: client.name, clientEmail: client.email, clientPhone: client.phone, clientAddress: client.address,
      description, lines, total, validUntil: editing.validUntil, note,
    });
    setSaving(false);
    if (res.error) { setSaveErr(res.error); return; }
    const id = editing.id;
    setClient({ name: '', email: '', phone: '', address: '' }); setDescription(''); setLines([]); setNote('');
    onSaved(id);
  }

  async function save(status: 'brouillon' | 'envoye') {
    if (lines.length === 0) return;
    setSaving(true);
    // MODIFICATION d'un devis existant : on met à jour le MÊME devis (même numéro).
    if (editing) {
      const res = await updateDevisDB(editing.id, {
        clientName: client.name, clientEmail: client.email, clientPhone: client.phone, clientAddress: client.address,
        description, lines, total, validUntil: editing.validUntil, status,
      });
      setSaving(false);
      if (!res.error) {
        setSavedNumber(editing.number);
        setClient({ name: '', email: '', phone: '', address: '' }); setDescription(''); setLines([]);
        onSaved();
      }
      return;
    }
    // CRÉATION d'un nouveau devis.
    const number = await nextDevisNumberDB();
    const validUntil = new Date(Date.now() + 30 * 86400000).toLocaleDateString('en-CA');
    const res = await saveDevisDB({
      number, partnerLabel: client.name || 'Client', partnerType: 'devis',
      clientName: client.name, clientEmail: client.email, clientPhone: client.phone, clientAddress: client.address,
      description, lines, total, validUntil, status,
    });
    setSaving(false);
    if (!res.error) {
      setSavedNumber(number);
      setClient({ name: '', email: '', phone: '', address: '' }); setDescription(''); setLines([]);
      onSaved();
    }
  }

  return (
    <div className="space-y-5">
      {editing && !savedNumber && (
        <div className="rounded-xl px-4 py-3 text-sm font-medium flex items-center justify-between gap-3" style={{ backgroundColor: '#FBF4E2', color: '#C48A2A' }}>
          <span>
            {correcting
              ? `Correction du devis ${editing.number} (déjà ${editing.status === 'accepte' ? 'accepté' : editing.status === 'refuse' ? 'refusé' : 'envoyé'}). Il deviendra la version ${editing.revision + 1} : même numéro, même lien, et le client devra se prononcer à nouveau.`
              : `Modification du devis ${editing.number}. Enregistre pour mettre à jour ce devis.`}
          </span>
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
        {/* Téléphone et adresse sont DEUX champs : un numéro rangé dans l'adresse
            n'est plus qu'un bout de texte — ni cliquable, ni cherchable. */}
        <div className="grid sm:grid-cols-2 gap-3">
          <input value={client.name} onChange={e => setClient(c => ({ ...c, name: e.target.value }))} placeholder="Nom" className="px-3 py-2.5 rounded-xl text-sm" style={{ ...inputStyle }} />
          <input value={client.email} onChange={e => setClient(c => ({ ...c, email: e.target.value }))} placeholder="Email" className="px-3 py-2.5 rounded-xl text-sm" style={{ ...inputStyle }} />
          <input value={client.phone} onChange={e => setClient(c => ({ ...c, phone: e.target.value }))} placeholder="Téléphone" type="tel" className="px-3 py-2.5 rounded-xl text-sm" style={{ ...inputStyle }} />
          <input value={client.address} onChange={e => setClient(c => ({ ...c, address: e.target.value }))} placeholder="Adresse" className="px-3 py-2.5 rounded-xl text-sm" style={{ ...inputStyle }} />
        </div>
        {client.phone.trim() && (
          <p className="text-xs mt-2" style={{ color: '#A8A09A' }}>
            Appeler : <a href={`tel:${client.phone.replace(/\s+/g, '')}`} className="font-semibold hover:underline" style={{ color: '#C9A84C' }}>{client.phone}</a>
          </p>
        )}
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

      {/* Décrire la prestation → agent d'estimation LOCAL (grille + mots-clés) */}
      <div className="rounded-2xl border p-5" style={{ backgroundColor: '#FAFAF8', borderColor: '#E8E4DC' }}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#7A7068' }}>Décrire la prestation</p>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
          placeholder="Ex : grand ménage de fin de bail pour un T3 au 4e étage sans ascenseur, avec nettoyage des vitres et du four."
          className="w-full px-3 py-2.5 rounded-xl text-sm mb-3" style={{ ...inputStyle }} />
        <div className="flex items-center gap-3">
          <button onClick={generateFromText} disabled={!description.trim()}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
            Proposer les prestations
          </button>
          {aiMsg && <span className="text-xs" style={{ color: aiMsg.startsWith('Devis') ? '#5A8A6A' : '#B85A50' }}>{aiMsg}</span>}
        </div>
        <p className="text-[11px] mt-2" style={{ color: '#A8A09A' }}>Reconnaissance par notre agent local : les prestations sont repérées d’après ta grille tarifs et ses mots-clés. Les prix viennent toujours de la grille.</p>
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
            <div className="pt-2 border-t mt-2 space-y-1" style={{ borderColor: '#F2EFE9' }}>
              <div className="flex justify-between text-sm"><span style={{ color: '#7A7068' }}>Total HT</span><span style={{ color: '#1A1A1A' }}>{money(total)}</span></div>
              <div className="flex justify-between text-sm"><span style={{ color: '#7A7068' }}>TVA 20 %</span><span style={{ color: '#1A1A1A' }}>{money(total * 0.2)}</span></div>
              <div className="flex justify-between text-sm font-bold"><span style={{ color: '#1A1A1A' }}>Net à payer (TTC)</span><span style={{ color: '#C9A84C' }}>{money(total * 1.2)}</span></div>
            </div>
          </div>
        )}
      </div>

      {/* Mot d'explication : ce que le client lira en haut de son devis corrigé. */}
      {correcting && (
        <div className="rounded-2xl border p-5" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#7A7068' }}>Message au client</p>
          <p className="text-[11px] mb-3" style={{ color: '#A8A09A' }}>
            Affiché en haut de son devis et repris dans l’email de renvoi. Dis-lui simplement ce qui change et pourquoi.
          </p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {CORRECTION_MODELES.map(m => (
              <button key={m.label} onClick={() => setNote(m.texte(lines))}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>
                {m.label}
              </button>
            ))}
          </div>
          <textarea value={note} onChange={e => { setNote(e.target.value); setSaveErr(''); }} rows={4}
            placeholder="Ex : la prestation sélectionnée ne correspondait pas à votre logement. Nous l’avons remplacée par un grand ménage de fin de bail, mieux adapté."
            className="w-full px-3 py-2.5 rounded-xl text-sm" style={{ ...inputStyle }} />
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        {correcting ? (
          <button onClick={saveCorrection} disabled={saving || lines.length === 0} className="px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
            {saving ? '...' : `Enregistrer la correction et renvoyer (v${(editing?.revision ?? 1) + 1})`}
          </button>
        ) : (
          <>
            <button onClick={() => save('brouillon')} disabled={saving || lines.length === 0} className="px-5 py-2.5 rounded-xl text-sm font-semibold border disabled:opacity-50" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>
              {editing ? 'Enregistrer les modifications' : 'Enregistrer (brouillon)'}
            </button>
            <button onClick={() => save('envoye')} disabled={saving || lines.length === 0} className="px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>{saving ? '...' : 'Enregistrer & marquer envoyé'}</button>
          </>
        )}
        {editing && (
          <button onClick={onCancelEdit} disabled={saving} className="px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50" style={{ color: '#B85A50' }}>Annuler</button>
        )}
        {saveErr && <span className="text-xs" style={{ color: '#B85A50' }}>{saveErr}</span>}
      </div>
    </div>
  );
}

// ── HISTORIQUE DEVIS ────────────────────────────────────────────────────────────
function DevisHistory({ company, list, onChanged, onEdit, resendId }: { company: CompanyInfo; list: Devis[]; onChanged: () => void; onEdit: (d: Devis) => void; resendId: string | null }) {
  // Arrivée depuis une correction : la fiche s'ouvre directement, email de renvoi
  // prêt — une correction que le client ne reçoit pas ne sert à rien. L'état est
  // calculé au MONTAGE (l'onglet est démonté quand on le quitte), pas dans un effet.
  const resent = resendId ? list.find(d => d.id === resendId) ?? null : null;
  const resentDraft = resent ? devisEmailDraft(resent, company) : null;

  const [viewing, setViewing] = useState<Devis | null>(resent);
  const [convertMsg, setConvertMsg] = useState('');
  // Envoi email (message pré-rempli, éditable).
  const [emailOpen, setEmailOpen] = useState(!!resentDraft);
  const [emailTo, setEmailTo] = useState(resentDraft?.to ?? '');
  const [emailSubject, setEmailSubject] = useState(resentDraft?.subject ?? '');
  const [emailBody, setEmailBody] = useState(resentDraft?.body ?? '');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState('');
  const [pdfBusy, setPdfBusy] = useState(false);

  async function downloadPdf(d: Devis) {
    const el = document.querySelector('.invoice-print') as HTMLElement | null;
    if (!el) return;
    setPdfBusy(true);
    try {
      const { downloadElementPdf } = await import('@/lib/pdf');
      await downloadElementPdf(el, `Devis-${d.number}.pdf`);
    } catch (e) {
      console.error('PDF devis:', e);
      window.print();   // repli : impression → « Enregistrer au format PDF »
    }
    setPdfBusy(false);
  }

  async function convert(d: Devis) {
    const res = await convertDevisToInvoiceDB(d);
    if (res.error) setConvertMsg(res.error);
    else { setConvertMsg(`Facture ${res.number} créée depuis ${d.number}.`); onChanged(); }
  }

  function openEmail(d: Devis) {
    const draft = devisEmailDraft(d, company);
    setEmailTo(draft.to); setEmailSubject(draft.subject); setEmailBody(draft.body);
    setEmailMsg('');
    setEmailOpen(true);
  }

  // Version HTML de l'email : reprend le message (éventuellement retouché par
  // l'admin) et y ajoute le récapitulatif du devis + le bouton d'action. L'URL
  // brute est retirée du texte — le bouton la porte déjà.
  function buildDevisHtml(d: Devis, message: string): string {
    const url = devisUrl(d);
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const intro = message.split('\n')
      .filter(l => l.trim() !== url)
      .join('\n').replace(/\n{3,}/g, '\n\n').trim();
    const companyName = company.name || 'MonCleanerPro';
    const rows = d.lines.map((l, i) =>
      `<tr style="background:${i % 2 ? '#FAF8F3' : '#FFFFFF'}">
        <td style="padding:10px 12px;font-size:13px;color:#1A1A1A;font-weight:600;border-bottom:1px solid #F0EBE0">${esc(l.nom)}${l.quantite > 1 ? ` <span style="color:#8A8178;font-weight:400">× ${l.quantite}</span>` : ''}</td>
        <td style="padding:10px 12px;font-size:13px;color:#1A1A1A;font-weight:700;text-align:right;border-bottom:1px solid #F0EBE0">${money(l.total)}</td></tr>`).join('');
    const info = [company.address, [company.email, company.phone].filter(Boolean).join('  ·  ')]
      .filter(Boolean).map(x => `<div style="color:#B8AE9E;font-size:11px;line-height:1.7">${esc(String(x))}</div>`).join('');
    return `<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;max-width:640px;margin:0 auto;background:#FFFFFF;border:1px solid #ECE7DC;border-radius:16px;overflow:hidden">
      <div style="background:#0D0D0D;padding:26px 30px">
        <div style="font-size:18px;font-weight:800;letter-spacing:0.12em;color:#FFFFFF"><span style="display:inline-block;width:24px;height:24px;border-radius:6px;background:#C9A84C;color:#0D0D0D;font-weight:800;text-align:center;line-height:24px;font-size:13px;margin-right:6px;vertical-align:middle">M</span>MONCLEANERPRO</div>
        <div style="font-size:10px;font-weight:600;letter-spacing:0.3em;text-transform:uppercase;color:#C9A84C;margin-top:5px;margin-left:24px">Nettoyage Professionnel</div>
      </div>
      <div style="padding:28px 30px">
        <p style="margin:0 0 2px;font-size:20px;font-weight:300;letter-spacing:0.16em;color:#0D0D0D">DEVIS <span style="font-weight:700;font-size:14px;color:#C9A84C">${esc(d.number)}</span>${d.revision > 1 ? `<span style="font-size:11px;font-weight:700;letter-spacing:0.06em;color:#8A6A1E;background:#FBF4E2;border-radius:6px;padding:3px 8px;margin-left:8px;vertical-align:middle">VERSION ${d.revision} — CORRIGÉ</span>` : ''}</p>
        ${d.revision > 1 ? `<p style="margin:0 0 6px;color:#8A6A1E;font-size:12px">Ce devis annule et remplace la version précédente${d.previousTotal != null ? ` (ancien total : ${money(d.previousTotal * 1.2)} TTC)` : ''}.</p>` : ''}
        ${d.validUntil ? `<p style="margin:0 0 16px;color:#8A8178;font-size:12px">Valable jusqu'au ${new Date(d.validUntil + 'T00:00:00').toLocaleDateString('fr-FR')}</p>` : '<div style="height:12px"></div>'}
        <div style="font-size:14px;color:#4A443D;line-height:1.65;white-space:pre-line">${esc(intro)}</div>
        <table style="width:100%;border-collapse:collapse;border-radius:10px;overflow:hidden;margin-top:22px">
          <tr style="background:#0D0D0D">
            <th style="text-align:left;padding:10px 12px;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:#E9E2D2">Prestation</th>
            <th style="text-align:right;padding:10px 12px;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:#E9E2D2">Montant</th>
          </tr>
          ${rows}
        </table>
        <table style="width:100%;margin-top:18px"><tr>
          <td></td>
          <td style="width:220px">
            <div style="background:#C9A84C;border-radius:12px;padding:14px 18px;text-align:right">
              <span style="font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#1A1A1A">Net à payer (TTC)</span>
              <div style="font-size:21px;font-weight:800;color:#1A1A1A;margin-top:2px">${money(d.total * 1.2)}</div>
            </div>
          </td>
        </tr></table>
        <div style="background:#FAF8F3;border:1px solid #F0EBE0;border-radius:12px;padding:20px;margin-top:24px;text-align:center">
          <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#0D0D0D">Accepter votre devis et réserver votre date</p>
          <p style="margin:0 0 16px;font-size:13px;color:#4A443D;line-height:1.6">Le même lien vous permet d'accepter le devis, puis de choisir le créneau de votre intervention. Réservez dès l'acceptation : votre date n'est bloquée qu'une fois le rendez-vous confirmé.</p>
          <a href="${url}" style="display:inline-block;background:#5A8A6A;color:#FFFFFF;text-decoration:none;font-size:15px;font-weight:700;padding:14px 30px;border-radius:10px">Accepter et choisir ma date</a>
          <p style="margin:14px 0 0;font-size:11px;color:#8A8178;word-break:break-all">${url}</p>
        </div>
        <p style="margin:24px 0 0;font-size:14px;font-weight:700;color:#0D0D0D">Merci pour votre confiance.</p>
        <p style="margin:4px 0 14px;font-size:12px;color:#8A8178">L'équipe ${esc(companyName)}</p>
        ${info}
      </div>
    </div>`;
  }

  async function sendEmail() {
    if (!emailTo.trim()) { setEmailMsg("Renseigne l'email du client."); return; }
    if (!viewing) { setEmailMsg('Devis introuvable.'); return; }
    setEmailBusy(true); setEmailMsg('');
    try {
      const res = await fetch('/api/send-invoice', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ to: emailTo.trim(), subject: emailSubject, text: emailBody, html: buildDevisHtml(viewing, emailBody) }),
      });
      const data = await res.json().catch(() => ({}));
      setEmailBusy(false);
      if (!res.ok || data.error) { setEmailMsg(data.error || "Échec de l'envoi."); return; }
      setEmailMsg('Devis envoyé au client ✓');
      if (viewing) { await setDevisStatusDB(viewing.id, 'envoye'); onChanged(); }
      setTimeout(() => setEmailOpen(false), 1200);
    } catch {
      setEmailBusy(false);
      setEmailMsg("Échec de l'envoi (connexion).");
    }
  }

  if (viewing) {
    // `qty` : le gabarit affiche la quantité à la place de la durée sur un devis.
    const invLines = viewing.lines.map(l => ({ date: viewing.createdAt?.slice(0, 10) ?? '', label: l.nom, type: 'devis', amount: l.total, unitPrice: l.prix_unitaire, qty: l.quantite }));
    return (
      <div>
        <button onClick={() => setViewing(null)} className="text-sm mb-4" style={{ color: '#C9A84C' }}>← Retour</button>

        {/* Coordonnées du client, au-dessus du document. Hors impression : le devis
            envoyé n'a pas à porter les notes de contact de l'équipe. Le numéro est
            un lien d'appel — relancer un devis se fait depuis cette fiche. */}
        {(viewing.clientPhone || viewing.clientEmail || viewing.clientAddress) && (
          <div className="rounded-2xl border p-4 mb-4 print-hidden flex flex-wrap items-center gap-x-6 gap-y-2" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
            {viewing.clientPhone && (
              <a href={`tel:${viewing.clientPhone.replace(/\s+/g, '')}`} className="text-sm font-semibold hover:underline" style={{ color: '#C9A84C' }}>
                {viewing.clientPhone}
              </a>
            )}
            {viewing.clientEmail && (
              <a href={`mailto:${viewing.clientEmail}`} className="text-sm hover:underline" style={{ color: '#7A7068' }}>{viewing.clientEmail}</a>
            )}
            {viewing.clientAddress && <span className="text-sm" style={{ color: '#A8A09A' }}>{viewing.clientAddress}</span>}
          </div>
        )}

        {viewing.revision > 1 && (
          <div className="rounded-2xl border p-4 mb-4 print-hidden" style={{ backgroundColor: '#FBF4E2', borderColor: '#EBD9A8' }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#8A6A1E' }}>
              Version {viewing.revision} — corrigé{viewing.revisedAt ? ` le ${new Date(viewing.revisedAt).toLocaleDateString('fr-FR')}` : ''}
            </p>
            {viewing.revisionNote && <p className="text-sm mt-1.5 whitespace-pre-line" style={{ color: '#7A6538' }}>{viewing.revisionNote}</p>}
            {viewing.previousTotal != null && (
              <p className="text-xs mt-2" style={{ color: '#A8945E' }}>
                Ancien total : {money(viewing.previousTotal)} HT — nouveau : {money(viewing.total)} HT
              </p>
            )}
          </div>
        )}
        <InvoiceDoc company={company} number={viewing.number} partnerLabel={viewing.partnerLabel || viewing.clientName || 'Client'}
          partnerType={viewing.partnerType} status={viewing.status === 'accepte' ? 'paid' : 'pending'}
          from={viewing.createdAt?.slice(0, 10) ?? ''} to={viewing.validUntil ?? ''} lines={invLines} total={viewing.total}
          docLabel="DEVIS" validUntil={viewing.validUntil} totalLabel="Net à payer (TTC)" totalIsHT />
        <div className="flex flex-wrap gap-2 mt-4 print-hidden">
          <button onClick={() => downloadPdf(viewing)} disabled={pdfBusy} className="px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>{pdfBusy ? 'Génération…' : 'Télécharger le PDF'}</button>
          <button onClick={() => openEmail(viewing)} className="px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#5B6EF5', color: '#FFFFFF' }}>
            {viewing.revision > 1 ? 'Renvoyer par email' : 'Envoyer par email'}
          </button>
          {!viewing.invoiceId && (
            <button onClick={() => onEdit(viewing)} className="px-4 py-2.5 rounded-xl text-sm font-semibold border" style={{ borderColor: '#C9A84C', color: '#9A7B22' }}>
              {viewing.status === 'brouillon' ? 'Modifier' : 'Corriger ce devis'}
            </button>
          )}
          {typeof window !== 'undefined' && (
            <button onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/devis/${viewing.publicToken}`)}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold border" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>Copier le lien client</button>
          )}
          {viewing.status === 'accepte' && !viewing.invoiceId && (
            <button onClick={() => convert(viewing)} className="px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#5A8A6A', color: '#FFFFFF' }}>Convertir en facture</button>
          )}
        </div>

        {/* Composition de l'email (message pré-rempli, modifiable). Envoi via le compte
            mail de l'entreprise (SMTP). Le devis passe en « Envoyé » après l'envoi. */}
        {emailOpen && (
          <div className="rounded-2xl border p-5 mt-4 space-y-3 print-hidden" style={{ backgroundColor: '#FAFAF8', borderColor: '#E8E4DC' }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#7A7068' }}>Envoyer le devis par email</p>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: '#A8A09A' }}>À (email du client)</label>
              <input value={emailTo} onChange={e => setEmailTo(e.target.value)} placeholder="client@email.fr" className="w-full px-3 py-2.5 rounded-xl text-sm" style={{ ...inputStyle }} />
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: '#A8A09A' }}>Objet</label>
              <input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm" style={{ ...inputStyle }} />
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: '#A8A09A' }}>Message</label>
              <textarea value={emailBody} onChange={e => setEmailBody(e.target.value)} rows={9} className="w-full px-3 py-2.5 rounded-xl text-sm" style={{ ...inputStyle }} />
            </div>
            <div className="flex items-center gap-3">
              <button onClick={sendEmail} disabled={emailBusy || !emailTo.trim()} className="px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: '#5B6EF5', color: '#FFFFFF' }}>{emailBusy ? 'Envoi…' : 'Envoyer'}</button>
              <button onClick={() => setEmailOpen(false)} disabled={emailBusy} className="px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50" style={{ color: '#7A7068' }}>Annuler</button>
              {emailMsg && <span className="text-xs" style={{ color: emailMsg.includes('✓') ? '#5A8A6A' : '#B85A50' }}>{emailMsg}</span>}
            </div>
          </div>
        )}

        {convertMsg && <p className="text-sm mt-3" style={{ color: '#5A8A6A' }}>{convertMsg}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
      {convertMsg && <div className="px-5 py-3 text-sm" style={{ color: '#5A8A6A' }}>{convertMsg}</div>}
      {list.length === 0 && <div className="py-10 text-center text-sm" style={{ color: '#A8A09A' }}>Aucun devis</div>}
      {list.map((d, i) => {
        // Une demande en ligne encore en brouillon = « À traiter » (badge distinct).
        const badge = (d.source === 'public' && d.status === 'brouillon')
          ? { label: 'À traiter', color: '#C48A2A', bg: '#FBF4E2' }
          : (STATUT_BADGE[d.status] ?? STATUT_BADGE.brouillon);
        return (
          <div key={d.id} className={`px-5 py-4 flex items-center justify-between gap-3 ${i < list.length - 1 ? 'border-b' : ''}`} style={{ borderColor: '#F2EFE9' }}>
            <div className="min-w-0">
              <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{d.number} — {d.clientName || d.partnerLabel}</p>
              <p className="text-xs" style={{ color: '#A8A09A' }}>
                {money(d.total)}{d.source === 'public' ? ' · demande en ligne' : ''}
                {d.revision > 1 ? ` · corrigé (v${d.revision})` : ''}
              </p>
              {/* Numéro appelable sans ouvrir le devis : relancer un client tient
                  en un clic depuis la liste. */}
              {d.clientPhone && (
                <p className="text-xs mt-0.5">
                  <a href={`tel:${d.clientPhone.replace(/\s+/g, '')}`} onClick={e => e.stopPropagation()}
                    className="font-semibold hover:underline" style={{ color: '#C9A84C' }}>{d.clientPhone}</a>
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: badge.bg, color: badge.color }}>{badge.label}</span>
              {/* Brouillon → simple modification. Devis déjà chez le client → correction
                  versionnée avec un mot d'explication. Devis facturé → plus touchable. */}
              {!d.invoiceId && (
                <button onClick={() => onEdit(d)} className="px-3 py-1.5 rounded-xl text-xs font-semibold border" style={{ borderColor: '#C9A84C', color: '#9A7B22' }}>
                  {d.status === 'brouillon' ? 'Modifier' : 'Corriger'}
                </button>
              )}
              <button onClick={() => setViewing(d)} className="px-3 py-1.5 rounded-xl text-xs font-semibold border" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>Ouvrir</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── GRILLE TARIFAIRE (LOT 8A) + IMPORT CSV + FOURCHETTES (LOT 8C) ────────────────
const UNITES: TarifUnite[] = ['forfait', 'm2', 'heure', 'piece'];
function TarifsManager({ tarifs, onChanged }: { tarifs: Tarif[]; onChanged: () => void }) {
  const [form, setForm] = useState({ nom: '', unite: 'forfait' as TarifUnite, prix: 0 });
  const [importBusy, setImportBusy] = useState(false);
  const [importMsg, setImportMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function add() {
    if (!form.nom.trim()) return;
    await createTarifDB({ nom: form.nom.trim(), unite: form.unite, prix: Number(form.prix) || 0 });
    setForm({ nom: '', unite: 'forfait', prix: 0 }); onChanged();
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) { e.target.value = ''; await runImport(file); }
  }
  async function runImport(file: File) {
    setImportBusy(true); setImportMsg(null);
    try {
      const text = await file.text();
      const { rows, errors } = parseTarifsCsv(text);
      if (errors.length && rows.length === 0) { setImportMsg({ text: errors[0], ok: false }); setImportBusy(false); return; }
      const res = await importTarifsDB(rows);
      if (res.error) setImportMsg({ text: res.error, ok: false });
      else setImportMsg({ text: `Import réussi : ${res.inserted} ajoutée(s), ${res.updated} mise(s) à jour.`, ok: true });
      onChanged();
    } catch {
      setImportMsg({ text: 'Fichier illisible. Vérifie qu\'il s\'agit bien d\'un CSV.', ok: false });
    }
    setImportBusy(false);
  }
  function downloadTemplate() {
    const blob = new Blob(['﻿' + CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'modele-grille-tarifs.csv';
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      {/* Import CSV — la grille pilote l'agent d'estimation local ET l'assistant IA. */}
      <div className="rounded-2xl border p-5" style={{ backgroundColor: '#FAFAF8', borderColor: '#E8E4DC' }}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#7A7068' }}>Importer une grille (CSV)</p>
        <p className="text-[11px] mb-3" style={{ color: '#A8A09A' }}>
          Colonnes : <span style={{ color: '#7A7068' }}>Prestation ; Unité ; Prix ; Mots-clés ; Actif</span>. Le prix accepte une fourchette (« 40-70 »).
          Ré-importer met à jour les prestations existantes (par nom), sans doublon.
        </p>
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => fileRef.current?.click()} disabled={importBusy} className="px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
            {importBusy ? 'Import…' : 'Importer un fichier CSV'}
          </button>
          <button onClick={downloadTemplate} className="px-4 py-2.5 rounded-xl text-sm font-semibold border" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>Télécharger le modèle</button>
          {importMsg && <span className="text-xs" style={{ color: importMsg.ok ? '#5A8A6A' : '#B85A50' }}>{importMsg.text}</span>}
        </div>
      </div>

      <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
        {tarifs.length === 0 && <div className="py-8 text-center text-sm" style={{ color: '#A8A09A' }}>Aucun tarif — importe ta grille CSV ci-dessus ou ajoute une prestation.</div>}
        {tarifs.map((t, i) => (
          <div key={t.id} className={`px-5 py-3 ${i < tarifs.length - 1 ? 'border-b' : ''}`} style={{ borderColor: '#F2EFE9', opacity: t.actif ? 1 : 0.55 }}>
            <div className="flex items-center gap-2">
              <input defaultValue={t.nom} onBlur={e => e.target.value !== t.nom && updateTarifDB(t.id, { nom: e.target.value }).then(onChanged)} className="flex-1 px-2 py-1.5 rounded-lg text-sm" style={{ ...inputStyle }} />
              <select defaultValue={t.unite} onChange={e => updateTarifDB(t.id, { unite: e.target.value as TarifUnite }).then(onChanged)} className="px-2 py-1.5 rounded-lg text-sm" style={{ ...inputStyle }}>
                {UNITES.map(u => <option key={u} value={u}>{UNITE_LABEL[u]}</option>)}
              </select>
              {/* Fourchette : prix_min – prix_max. Laisser max vide = prix fixe. */}
              <input type="number" step="0.01" defaultValue={t.prixMin ?? t.prix} title="Prix mini"
                onBlur={e => { const v = e.target.value === '' ? null : Number(e.target.value); updateTarifDB(t.id, { prixMin: v, prix: v ?? t.prix }).then(onChanged); }}
                className="w-20 px-2 py-1.5 rounded-lg text-sm text-right" style={{ ...inputStyle }} />
              <span className="text-xs" style={{ color: '#A8A09A' }}>–</span>
              <input type="number" step="0.01" defaultValue={t.prixMax ?? ''} title="Prix maxi (vide = prix fixe)" placeholder="max"
                onBlur={e => { const v = e.target.value === '' ? null : Number(e.target.value); updateTarifDB(t.id, { prixMax: v }).then(onChanged); }}
                className="w-20 px-2 py-1.5 rounded-lg text-sm text-right" style={{ ...inputStyle }} />
              <button onClick={() => updateTarifDB(t.id, { actif: !t.actif }).then(onChanged)} className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: t.actif ? '#5A8A6A15' : '#F5F3EF', color: t.actif ? '#5A8A6A' : '#A8A09A' }}>{t.actif ? 'Actif' : 'Inactif'}</button>
              <button onClick={() => deleteTarifDB(t.id).then(onChanged)} style={{ color: '#B85A50' }}>✕</button>
            </div>
            {/* Mots-clés : synonymes que tape le client → précision de l'agent local. */}
            <input defaultValue={t.motsCles ?? ''} onBlur={e => (e.target.value !== (t.motsCles ?? '')) && updateTarifDB(t.id, { motsCles: e.target.value }).then(onChanged)}
              placeholder="Mots-clés (ex : vitres, fenêtres, baies)" className="w-full mt-1.5 px-2 py-1 rounded-lg text-xs" style={{ ...inputStyle, color: '#7A7068' }} />
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
