'use client';

import { useState, useEffect } from 'react';
import { inputStyle } from '@/lib/ui';
import { saveDevisDB, nextDevisNumberDB, getTarifsDB, estimateFromDescription, rangeForLines, UNITE_LABEL, type DevisLine, type Tarif } from '@/lib/devis';

function money(n: number) { return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'; }

// Page PUBLIQUE « Demander un devis ». Le client compose son estimation en
// choisissant des prestations dans la GRILLE TARIFS de l'entreprise (prix fixés
// par nous) → estimation instantanée, sans dépendre d'une IA. La demande est
// ensuite enregistrée en brouillon pour que l'admin établisse le devis officiel.
export default function DevisEnLignePage() {
  const [form, setForm] = useState({ name: '', email: '', address: '', bien: '', description: '' });
  const [tarifs, setTarifs] = useState<Tarif[]>([]);
  const [lines, setLines] = useState<DevisLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { getTarifsDB(true).then(setTarifs).catch(() => setTarifs([])); }, []);

  const total = lines.reduce((s, l) => s + l.total, 0);
  // Estimation en FOURCHETTE (prix_min / prix_max de la grille). Affichée au client ;
  // `total` (milieu) reste ce qu'on enregistre pour l'admin.
  const { low, high } = rangeForLines(lines, tarifs);

  function addTarif(t: Tarif) {
    setLines(ls => {
      const i = ls.findIndex(l => l.nom === t.nom && l.prix_unitaire === t.prix);
      if (i >= 0) {
        const next = [...ls];
        const q = next[i].quantite + 1;
        next[i] = { ...next[i], quantite: q, total: Math.round(q * next[i].prix_unitaire * 100) / 100 };
        return next;
      }
      return [...ls, { nom: t.nom, quantite: 1, prix_unitaire: t.prix, total: t.prix }];
    });
  }
  function setQty(i: number, q: number) {
    setLines(ls => ls.map((l, idx) => idx === i ? { ...l, quantite: Math.max(1, q), total: Math.round(Math.max(1, q) * l.prix_unitaire * 100) / 100 } : l));
  }
  function removeLine(i: number) { setLines(ls => ls.filter((_, idx) => idx !== i)); }

  // Estimation à partir de la description libre : agent LOCAL (aucune IA externe).
  function estimateFromText() {
    setMsg('');
    const found = estimateFromDescription(`${form.bien} ${form.description}`, tarifs);
    if (found.length === 0) { setMsg("Aucune prestation reconnue dans la description — choisissez-les ci-dessus, ou envoyez votre demande telle quelle."); return; }
    setLines(found);
  }

  async function submit() {
    if (!form.name.trim() || !form.email.trim()) {
      setMsg('Renseignez au moins votre nom et votre email.');
      return;
    }
    if (lines.length === 0 && !form.description.trim()) {
      setMsg('Choisissez au moins une prestation, ou décrivez votre besoin.');
      return;
    }
    setBusy(true);
    const number = await nextDevisNumberDB();
    await saveDevisDB({
      number, partnerLabel: form.name || 'Demande en ligne', partnerType: 'devis',
      clientName: form.name, clientEmail: form.email, clientAddress: form.address,
      description: [form.bien, form.description].filter(Boolean).join(' — '), lines, total,
      status: 'brouillon', source: 'public',
    });
    setBusy(false); setSent(true);
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5" style={{ backgroundColor: '#FAFAF8' }}>
        <div className="max-w-md text-center rounded-2xl border p-8" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          <h1 className="text-xl font-bold mb-2" style={{ color: '#1A1A1A' }}>Demande envoyée</h1>
          <p className="text-sm" style={{ color: '#7A7068' }}>Merci ! Nous établissons votre devis et revenons vers vous rapidement.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-10 px-5" style={{ backgroundColor: '#FAFAF8' }}>
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold mb-1" style={{ color: '#1A1A1A' }}>Demander un devis</h1>
        <p className="text-sm mb-6" style={{ color: '#A8A09A' }}>Choisissez vos prestations pour une estimation immédiate, ou décrivez simplement votre besoin.</p>

        {/* Coordonnées */}
        <div className="rounded-2xl border p-5 space-y-3 mb-4" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#7A7068' }}>Vos coordonnées</p>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nom *" className="w-full px-3 py-2.5 rounded-xl text-sm" style={{ ...inputStyle }} />
          <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Email *" className="w-full px-3 py-2.5 rounded-xl text-sm" style={{ ...inputStyle }} />
          <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Adresse" className="w-full px-3 py-2.5 rounded-xl text-sm" style={{ ...inputStyle }} />
          <input value={form.bien} onChange={e => setForm(f => ({ ...f, bien: e.target.value }))} placeholder="Type de bien (T2, maison, bureau…)" className="w-full px-3 py-2.5 rounded-xl text-sm" style={{ ...inputStyle }} />
        </div>

        {/* Prestations (grille tarifs) → estimation instantanée */}
        {tarifs.length > 0 && (
          <div className="rounded-2xl border p-5 mb-4" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#7A7068' }}>Choisissez vos prestations</p>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {tarifs.map(t => (
                <button key={t.id} onClick={() => addTarif(t)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>
                  + {t.nom}{t.unite !== 'forfait' ? <span style={{ color: '#A8A09A' }}> {UNITE_LABEL[t.unite]}</span> : null}
                </button>
              ))}
            </div>

            {lines.length === 0 ? (
              <p className="text-sm py-2 text-center" style={{ color: '#A8A09A' }}>Ajoutez des prestations pour voir votre estimation.</p>
            ) : (
              <div className="space-y-2">
                {/* On N'AFFICHE PAS le prix de chaque prestation (grille interne) :
                    seulement le nom + la quantité, et une estimation GLOBALE en bas. */}
                {lines.map((l, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="flex-1 text-sm min-w-0" style={{ color: '#1A1A1A' }}>{l.nom}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => setQty(i, l.quantite - 1)} className="w-7 h-7 rounded-lg text-sm font-bold" style={{ backgroundColor: '#F5F3EF', color: '#7A7068' }}>−</button>
                      <span className="w-7 text-center text-sm">{l.quantite}</span>
                      <button onClick={() => setQty(i, l.quantite + 1)} className="w-7 h-7 rounded-lg text-sm font-bold" style={{ backgroundColor: '#F5F3EF', color: '#7A7068' }}>+</button>
                    </div>
                    <button onClick={() => removeLine(i)} className="shrink-0" style={{ color: '#B85A50' }}>✕</button>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-3 border-t mt-1" style={{ borderColor: '#F2EFE9' }}>
                  <span className="text-sm font-bold" style={{ color: '#1A1A1A' }}>Estimation</span>
                  <span className="text-lg font-bold" style={{ color: '#C9A84C' }}>{low === high ? money(low) : `${money(low)} – ${money(high)}`}</span>
                </div>
                <p className="text-[11px]" style={{ color: '#A8A09A' }}>Fourchette indicative : le tarif final est ajusté selon la taille du logement, son état et son accessibilité. À confirmer par nos équipes après visite ou photos.</p>
              </div>
            )}
          </div>
        )}

        {/* Précisions libres */}
        <div className="rounded-2xl border p-5 mb-4" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Précisions {tarifs.length > 0 ? '(facultatif)' : ''}</p>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3}
            placeholder="Décrivez votre besoin (ex. « nettoyage des vitres de 6 fenêtres et 2 baies vitrées »)…"
            className="w-full px-3 py-2.5 rounded-xl text-sm" style={{ ...inputStyle }} />
          {tarifs.length > 0 && (
            <button onClick={estimateFromText} disabled={!form.description.trim()} className="w-full mt-2 py-2.5 rounded-xl text-sm font-semibold border disabled:opacity-50" style={{ borderColor: '#C9A84C', color: '#9A7B22' }}>
              Estimer d'après ma description
            </button>
          )}
        </div>

        <p className="text-[11px] text-center mb-3" style={{ color: '#A8A09A' }}>
          L'estimation est indicative : le tarif final est ajustable selon la taille du logement, son état et son accessibilité.
        </p>
        {msg && <p className="text-xs text-center mb-3" style={{ color: '#B85A50' }}>{msg}</p>}
        <button onClick={submit} disabled={busy} className="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: '#5A8A6A', color: '#FFFFFF' }}>
          {busy ? 'Envoi…' : 'Envoyer ma demande'}
        </button>
      </div>
    </div>
  );
}
