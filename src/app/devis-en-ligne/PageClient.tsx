'use client';

import { useState, useEffect, useMemo } from 'react';
import { inputStyle } from '@/lib/ui';
import { saveDevisDB, nextDevisNumberDB, getTarifsDB, estimateFromDescription, rangeForLines, type DevisLine, type Tarif } from '@/lib/devis';

function money(n: number) { return n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €'; }

// Petit chevron (icône ligne sobre, pas d'emoji) qui pivote à l'ouverture.
function Chevron({ open }: { open: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transition: 'transform 0.18s', transform: open ? 'rotate(180deg)' : 'none' }}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// Page PUBLIQUE « Demander un devis ». Deux chemins complémentaires :
//  1) Décrire son besoin en langage libre → estimation par l'agent LOCAL.
//  2) Parcourir les prestations, rangées par CATÉGORIE (sections repliables).
// L'estimation s'affiche en FOURCHETTE ; la demande part en brouillon pour l'admin.
export default function DevisEnLignePage() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', bien: '', description: '' });
  const [tarifs, setTarifs] = useState<Tarif[]>([]);
  const [lines, setLines] = useState<DevisLine[]>([]);
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { getTarifsDB(true).then(setTarifs).catch(() => setTarifs([])); }, []);

  const total = lines.reduce((s, l) => s + l.total, 0);
  const { low, high } = rangeForLines(lines, tarifs);

  // Regroupe les tarifs par catégorie, en préservant l'ordre d'apparition.
  const groups = useMemo(() => {
    const map = new Map<string, Tarif[]>();
    for (const t of tarifs) {
      const cat = t.categorie?.trim() || 'Autres prestations';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(t);
    }
    return [...map.entries()];
  }, [tarifs]);

  const qtyOf = (t: Tarif) => lines.find(l => l.nom === t.nom)?.quantite ?? 0;

  function addTarif(t: Tarif) {
    setLines(ls => {
      const i = ls.findIndex(l => l.nom === t.nom);
      if (i >= 0) {
        const next = [...ls]; const q = next[i].quantite + 1;
        next[i] = { ...next[i], quantite: q, total: Math.round(q * next[i].prix_unitaire * 100) / 100 };
        return next;
      }
      return [...ls, { nom: t.nom, quantite: 1, prix_unitaire: t.prix, total: t.prix }];
    });
  }
  function setQty(nom: string, q: number) {
    setLines(ls => q <= 0
      ? ls.filter(l => l.nom !== nom)
      : ls.map(l => l.nom === nom ? { ...l, quantite: q, total: Math.round(q * l.prix_unitaire * 100) / 100 } : l));
  }

  // Estimation depuis la description libre : agent LOCAL (aucune IA externe).
  function estimateFromText() {
    setMsg('');
    const found = estimateFromDescription(`${form.bien} ${form.description}`, tarifs);
    if (found.length === 0) { setMsg("Nous n'avons pas reconnu de prestation précise — choisissez ci-dessous, ou envoyez votre demande telle quelle, nous vous rappelons."); return; }
    // Fusionne avec la sélection existante (sans écraser ce qui est déjà choisi).
    setLines(prev => {
      const byName = new Map(prev.map(l => [l.nom, l]));
      for (const f of found) if (!byName.has(f.nom)) byName.set(f.nom, f);
      return [...byName.values()];
    });
    setMsg('Prestations proposées d\'après votre description — ajustez les quantités si besoin.');
  }

  async function submit() {
    if (!form.name.trim() || !form.email.trim()) { setMsg('Renseignez au moins votre nom et votre email.'); return; }
    if (lines.length === 0 && !form.description.trim()) { setMsg('Décrivez votre besoin ou choisissez au moins une prestation.'); return; }
    setBusy(true);
    const number = await nextDevisNumberDB();
    await saveDevisDB({
      number, partnerLabel: form.name || 'Demande en ligne', partnerType: 'devis',
      clientName: form.name, clientEmail: form.email,
      clientAddress: [form.address, form.phone && `Tél : ${form.phone}`].filter(Boolean).join(' — '),
      description: [form.bien && `Bien : ${form.bien}`, form.description].filter(Boolean).join(' — '), lines, total,
      status: 'brouillon', source: 'public',
    });
    setBusy(false); setSent(true);
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5" style={{ backgroundColor: '#FAFAF8' }}>
        <div className="max-w-md text-center rounded-2xl border p-8" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          <div className="w-12 h-12 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: '#EAF3EC' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4E7D5E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <h1 className="text-xl font-bold mb-2" style={{ color: '#1A1A1A' }}>Demande envoyée</h1>
          <p className="text-sm" style={{ color: '#7A7068' }}>Merci ! Nous préparons votre devis et revenons vers vous très vite.</p>
        </div>
      </div>
    );
  }

  const labelStyle = { color: '#7A7068' } as const;
  const cardStyle = { backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' } as const;

  return (
    <div className="min-h-screen py-10 px-5" style={{ backgroundColor: '#FAFAF8' }}>
      <div className="max-w-lg mx-auto pb-28">
        <h1 className="text-2xl font-bold mb-1" style={{ color: '#1A1A1A' }}>Demander un devis</h1>
        <p className="text-sm mb-6" style={{ color: '#A8A09A' }}>Décrivez votre besoin en quelques mots, ou choisissez vos prestations. Estimation immédiate, sans engagement.</p>

        {/* 1. Coordonnées */}
        <div className="rounded-2xl border p-5 space-y-3 mb-4" style={cardStyle}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={labelStyle}>Vos coordonnées</p>
          <div className="grid grid-cols-2 gap-3">
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nom *" className="px-3 py-2.5 rounded-xl text-sm" style={{ ...inputStyle }} />
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Téléphone" className="px-3 py-2.5 rounded-xl text-sm" style={{ ...inputStyle }} />
          </div>
          <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Email *" className="w-full px-3 py-2.5 rounded-xl text-sm" style={{ ...inputStyle }} />
          <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Adresse du bien" className="w-full px-3 py-2.5 rounded-xl text-sm" style={{ ...inputStyle }} />
        </div>

        {/* 2. Décrire son besoin — chemin principal, mis en avant */}
        <div className="rounded-2xl border p-5 mb-4" style={{ backgroundColor: '#FBF8F0', borderColor: '#EBD9A8' }}>
          <p className="text-sm font-bold mb-1" style={{ color: '#1A1A1A' }}>Décrivez votre besoin</p>
          <p className="text-xs mb-3" style={{ color: '#A8A09A' }}>En langage courant — nous reconnaissons les prestations automatiquement.</p>
          <input value={form.bien} onChange={e => setForm(f => ({ ...f, bien: e.target.value }))} placeholder="Type de bien (studio, T2, maison, bureau…)" className="w-full px-3 py-2.5 rounded-xl text-sm mb-2" style={{ ...inputStyle }} />
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3}
            placeholder="Ex : grand ménage de fin de bail pour un T3, avec les vitres de 6 fenêtres et le four."
            className="w-full px-3 py-2.5 rounded-xl text-sm" style={{ ...inputStyle }} />
          {tarifs.length > 0 && (
            <button onClick={estimateFromText} disabled={!form.description.trim() && !form.bien.trim()}
              className="w-full mt-2 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
              Estimer d&apos;après ma description
            </button>
          )}
        </div>

        {/* 3. Prestations par catégorie (repliables) */}
        {groups.length > 0 && (
          <div className="rounded-2xl border overflow-hidden mb-4" style={cardStyle}>
            <p className="text-xs font-semibold uppercase tracking-wider px-5 pt-5 pb-2" style={labelStyle}>Ou choisissez vos prestations</p>
            {groups.map(([cat, list], gi) => {
              const open = !!openCats[cat];
              const selectedInCat = list.reduce((n, t) => n + (qtyOf(t) > 0 ? 1 : 0), 0);
              return (
                <div key={cat} className={gi < groups.length - 1 ? 'border-b' : ''} style={{ borderColor: '#F2EFE9' }}>
                  <button onClick={() => setOpenCats(o => ({ ...o, [cat]: !o[cat] }))}
                    className="w-full flex items-center justify-between px-5 py-3.5 text-left">
                    <span className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{cat}</span>
                    <span className="flex items-center gap-2 shrink-0">
                      {selectedInCat > 0 && <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>{selectedInCat}</span>}
                      <span style={{ color: '#A8A09A' }}><Chevron open={open} /></span>
                    </span>
                  </button>
                  {open && (
                    <div className="px-3 pb-3 space-y-1">
                      {list.map(t => {
                        const q = qtyOf(t);
                        return (
                          <div key={t.id} className="flex items-center gap-2 px-2 py-1.5 rounded-xl" style={{ backgroundColor: q > 0 ? '#FBF7EC' : 'transparent' }}>
                            <span className="flex-1 text-sm min-w-0" style={{ color: '#1A1A1A' }}>{t.nom}</span>
                            {q > 0 ? (
                              <div className="flex items-center gap-1 shrink-0">
                                <button onClick={() => setQty(t.nom, q - 1)} className="w-7 h-7 rounded-lg text-sm font-bold" style={{ backgroundColor: '#F5F3EF', color: '#7A7068' }}>−</button>
                                <span className="w-6 text-center text-sm font-semibold">{q}</span>
                                <button onClick={() => addTarif(t)} className="w-7 h-7 rounded-lg text-sm font-bold" style={{ backgroundColor: '#F5F3EF', color: '#7A7068' }}>+</button>
                              </div>
                            ) : (
                              <button onClick={() => addTarif(t)} className="shrink-0 px-3 py-1 rounded-lg text-xs font-semibold border" style={{ borderColor: '#E8E4DC', color: '#9A7B22' }}>Ajouter</button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Récap sélection */}
        {lines.length > 0 && (
          <div className="rounded-2xl border p-5 mb-4" style={cardStyle}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={labelStyle}>Votre sélection</p>
            <div className="space-y-2">
              {lines.map(l => (
                <div key={l.nom} className="flex items-center gap-2">
                  <span className="flex-1 text-sm min-w-0" style={{ color: '#1A1A1A' }}>{l.nom}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setQty(l.nom, l.quantite - 1)} className="w-7 h-7 rounded-lg text-sm font-bold" style={{ backgroundColor: '#F5F3EF', color: '#7A7068' }}>−</button>
                    <span className="w-6 text-center text-sm">{l.quantite}</span>
                    <button onClick={() => setQty(l.nom, l.quantite + 1)} className="w-7 h-7 rounded-lg text-sm font-bold" style={{ backgroundColor: '#F5F3EF', color: '#7A7068' }}>+</button>
                  </div>
                  <button onClick={() => setQty(l.nom, 0)} className="shrink-0" style={{ color: '#B85A50' }} aria-label="Retirer">✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {msg && <p className="text-xs text-center mb-3" style={{ color: msg.startsWith('Prestations') ? '#5A8A6A' : '#B85A50' }}>{msg}</p>}
      </div>

      {/* Barre d'estimation + envoi, fixée en bas (toujours visible). */}
      <div className="fixed bottom-0 left-0 right-0 border-t px-5 py-3" style={{ backgroundColor: '#FFFFFFF2', borderColor: '#E8E4DC', backdropFilter: 'blur(8px)' }}>
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="flex-1 min-w-0">
            {lines.length > 0 ? (
              <>
                <p className="text-[11px]" style={{ color: '#A8A09A' }}>Estimation indicative</p>
                <p className="text-lg font-bold leading-tight" style={{ color: '#C9A84C' }}>{low === high ? money(low) : `${money(low)} – ${money(high)}`}</p>
              </>
            ) : (
              <p className="text-xs" style={{ color: '#A8A09A' }}>Choisissez vos prestations pour voir l&apos;estimation.</p>
            )}
          </div>
          <button onClick={submit} disabled={busy} className="shrink-0 px-5 py-3 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: '#5A8A6A', color: '#FFFFFF' }}>
            {busy ? 'Envoi…' : 'Envoyer ma demande'}
          </button>
        </div>
      </div>
    </div>
  );
}
