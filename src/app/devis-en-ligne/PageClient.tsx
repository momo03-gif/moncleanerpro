'use client';

import { useState } from 'react';
import { inputStyle } from '@/lib/ui';
import { saveDevisDB, nextDevisNumberDB, type DevisLine } from '@/lib/devis';

function money(n: number) { return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'; }

// Page PUBLIQUE « Demander un devis » (LOT 8B C). L'IA produit une ESTIMATION
// indicative à partir de la grille tarifs ; la demande est enregistrée pour l'admin.
export default function DevisEnLignePage() {
  const [form, setForm] = useState({ name: '', email: '', address: '', bien: '', description: '' });
  const [lines, setLines] = useState<DevisLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [msg, setMsg] = useState('');

  const total = lines.reduce((s, l) => s + l.total, 0);

  async function estimate() {
    setBusy(true); setMsg('');
    try {
      const description = `${form.bien ? `Type de bien : ${form.bien}. ` : ''}${form.description}`;
      const res = await fetch('/api/devis-ai', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ description }),
      });
      const data = await res.json();
      if (data.error) setMsg(data.error);
      else if (Array.isArray(data.lignes)) setLines(data.lignes);
    } catch { setMsg('Service indisponible, réessayez plus tard.'); }
    setBusy(false);
  }

  async function submit() {
    if (lines.length === 0) { setMsg('Générez d’abord une estimation.'); return; }
    setBusy(true);
    const number = await nextDevisNumberDB();
    await saveDevisDB({
      number, partnerLabel: form.name || 'Demande en ligne', partnerType: 'devis',
      clientName: form.name, clientEmail: form.email, clientAddress: form.address,
      description: `${form.bien} — ${form.description}`, lines, total,
      status: 'brouillon', source: 'public',
    });
    setBusy(false); setSent(true);
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5" style={{ backgroundColor: '#FAFAF8' }}>
        <div className="max-w-md text-center rounded-2xl border p-8" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          <h1 className="text-xl font-bold mb-2" style={{ color: '#1A1A1A' }}>Demande envoyée</h1>
          <p className="text-sm" style={{ color: '#7A7068' }}>Merci ! Nous révisons votre estimation et revenons vers vous avec un devis officiel.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-10 px-5" style={{ backgroundColor: '#FAFAF8' }}>
      <div className="max-w-lg mx-auto">
        <h1 className="text-2xl font-bold mb-1" style={{ color: '#1A1A1A' }}>Demander un devis</h1>
        <p className="text-sm mb-6" style={{ color: '#A8A09A' }}>Recevez une estimation indicative en quelques secondes.</p>

        <div className="rounded-2xl border p-5 space-y-3 mb-4" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nom" className="w-full px-3 py-2.5 rounded-xl text-sm" style={{ ...inputStyle }} />
          <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Email" className="w-full px-3 py-2.5 rounded-xl text-sm" style={{ ...inputStyle }} />
          <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Adresse" className="w-full px-3 py-2.5 rounded-xl text-sm" style={{ ...inputStyle }} />
          <input value={form.bien} onChange={e => setForm(f => ({ ...f, bien: e.target.value }))} placeholder="Type de bien (T2, maison, bureau…)" className="w-full px-3 py-2.5 rounded-xl text-sm" style={{ ...inputStyle }} />
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="Décrivez la prestation souhaitée" className="w-full px-3 py-2.5 rounded-xl text-sm" style={{ ...inputStyle }} />
          <button onClick={estimate} disabled={busy || !form.description.trim()} className="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
            {busy ? '...' : 'Obtenir mon estimation'}
          </button>
          {msg && <p className="text-xs text-center" style={{ color: '#B85A50' }}>{msg}</p>}
        </div>

        {lines.length > 0 && (
          <div className="rounded-2xl border p-5" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#7A7068' }}>Estimation indicative</p>
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: '#7A7068' }}>{l.nom}{l.quantite > 1 ? ` × ${l.quantite}` : ''}</span>
                  <span className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{money(l.total)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-3 border-t mt-2" style={{ borderColor: '#F2EFE9' }}>
                <span className="text-sm font-bold" style={{ color: '#1A1A1A' }}>Total estimé</span>
                <span className="text-lg font-bold" style={{ color: '#C9A84C' }}>{money(total)}</span>
              </div>
            </div>
            <p className="text-[11px] mt-3" style={{ color: '#A8A09A' }}>Estimation indicative, à confirmer par nos équipes.</p>
            <button onClick={submit} disabled={busy} className="w-full mt-4 py-3 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: '#5A8A6A', color: '#FFFFFF' }}>
              Envoyer ma demande
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
