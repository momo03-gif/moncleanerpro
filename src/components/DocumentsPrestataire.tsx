'use client';

import { useState, useEffect, useCallback } from 'react';
import { appelPrestataire, deposerDocument, type DocumentPrestataire, type Vigilance } from '@/lib/prestataireApi';
import { LIBELLE_DOCUMENT, type TypeDocument } from '@/lib/prestataireRegles';
import Icon from '@/components/Icon';

// Documents administratifs d'un prestataire (obligation de vigilance) :
// attestation URSSAF (tous les 6 mois), Kbis, assurance. Partagé par l'espace
// prestataire et la fiche admin (`prestataireId`).

const inputStyle = { backgroundColor: '#FFFFFF', border: '1px solid #E8E4DC', color: '#1A1A1A', outline: 'none' };
const fmt = (d?: string | null) => (d ? new Date(d.slice(0, 10) + 'T00:00:00').toLocaleDateString('fr-FR') : '');

export default function DocumentsPrestataire({ prestataireId }: { prestataireId?: string }) {
  const [docs, setDocs] = useState<DocumentPrestataire[] | null>(null);
  const [vigilance, setVigilance] = useState<Vigilance | null>(null);
  const [kind, setKind] = useState<TypeDocument>('urssaf');
  const [livre, setLivre] = useState('');
  const [fichier, setFichier] = useState<File | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState('');
  const cible = prestataireId ? { id: prestataireId } : {};

  const charger = useCallback(async () => {
    const r = await appelPrestataire<{ documents: DocumentPrestataire[]; vigilance: Vigilance }>('docs', prestataireId ? { id: prestataireId } : {});
    if (r.ok) { setDocs(r.documents); setVigilance(r.vigilance); }
    else { setDocs([]); setErreur(r.error); }
  }, [prestataireId]);

  useEffect(() => {
    let actif = true;
    (async () => { if (actif) await charger(); })();
    return () => { actif = false; };
  }, [charger]);

  async function envoyer(e: React.FormEvent) {
    e.preventDefault();
    if (!fichier) return;
    setEnvoi(true); setErreur('');
    const r = await deposerDocument(fichier, kind, livre, prestataireId);
    setEnvoi(false);
    if (!r.ok) { setErreur(r.error); return; }
    setFichier(null); setLivre('');
    (e.target as HTMLFormElement).reset();
    await charger();
  }

  async function supprimer(docId: string) {
    const r = await appelPrestataire('doc-delete', { ...cible, docId });
    if (!r.ok) { setErreur(r.error); return; }
    await charger();
  }

  return (
    <div className="space-y-4">
      {vigilance && (
        <div className="rounded-2xl border p-4" style={{ backgroundColor: vigilance.aJour ? '#5A8A6A0D' : '#C48A2A0D', borderColor: vigilance.aJour ? '#5A8A6A40' : '#C48A2A55' }}>
          <p className="text-sm font-semibold mb-2" style={{ color: '#1A1A1A' }}>
            {vigilance.aJour ? 'Documents à jour' : 'Documents à fournir'}
          </p>
          <div className="space-y-1">
            {vigilance.details.map(d => (
              <p key={d.kind} className="text-sm flex items-center gap-2" style={{ color: '#1A1A1A' }}>
                <span style={{ color: d.etat === 'ok' ? '#5A8A6A' : '#B85A50' }}><Icon name={d.etat === 'ok' ? 'check' : 'close'} size={14} /></span>
                {LIBELLE_DOCUMENT[d.kind]}
                <span className="text-xs" style={{ color: '#7A7068' }}>
                  {d.etat === 'manquant' ? '· manquant' : d.etat === 'expire' ? `· expiré depuis le ${fmt(d.jusqu)}` : `· valable jusqu’au ${fmt(d.jusqu)}`}
                </span>
              </p>
            ))}
          </div>
          <p className="text-xs mt-2" style={{ color: '#A8A09A' }}>L’attestation de vigilance URSSAF se renouvelle tous les 6 mois.</p>
        </div>
      )}

      <form onSubmit={envoyer} className="rounded-2xl border p-4 space-y-3" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
        <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>Ajouter un document</p>
        <select value={kind} onChange={e => setKind(e.target.value as TypeDocument)} className="w-full px-3 py-2.5 rounded-xl text-sm" style={inputStyle}>
          {(Object.keys(LIBELLE_DOCUMENT) as TypeDocument[]).map(k => <option key={k} value={k}>{LIBELLE_DOCUMENT[k]}</option>)}
        </select>
        <label className="block">
          <span className="block text-xs mb-1" style={{ color: '#A8A09A' }}>Date de délivrance (inscrite sur le document)</span>
          <input type="date" value={livre} onChange={e => setLivre(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm" style={inputStyle} />
        </label>
        <input type="file" accept="application/pdf,image/*" required onChange={e => setFichier(e.target.files?.[0] ?? null)}
          className="w-full text-sm" style={{ color: '#7A7068' }} />
        {erreur && <p className="text-xs" style={{ color: '#B85A50' }}>{erreur}</p>}
        <button type="submit" disabled={envoi || !fichier} className="px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
          {envoi ? 'Envoi…' : 'Envoyer'}
        </button>
      </form>

      {docs === null ? <p className="text-sm" style={{ color: '#A8A09A' }}>Chargement…</p> : docs.length > 0 && (
        <div className="rounded-2xl border divide-y" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          {docs.map(d => (
            <div key={d.id} className="flex items-center justify-between gap-3 px-4 py-3" style={{ borderColor: '#F2EFE9' }}>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: '#1A1A1A' }}>{LIBELLE_DOCUMENT[d.kind]}</p>
                <p className="text-xs truncate" style={{ color: '#A8A09A' }}>
                  {d.deliveredOn ? `Délivré le ${fmt(d.deliveredOn)}` : `Envoyé le ${fmt(d.uploadedAt)}`}{d.fileName ? ` · ${d.fileName}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {d.url && <a href={d.url} target="_blank" rel="noreferrer" className="text-xs font-semibold" style={{ color: '#7A7068' }}>Ouvrir</a>}
                <button onClick={() => supprimer(d.id)} aria-label="Supprimer" style={{ color: '#B85A50' }}><Icon name="trash" size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
