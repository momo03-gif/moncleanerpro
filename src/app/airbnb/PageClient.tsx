'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useFeedback } from '@/contexts/FeedbackContext';
import { getAirbnbsForPartner, getReservationsForPartner, createAirbnb, updateAirbnb, deleteAirbnb } from '@/lib/db';
import type { Apartment, Reservation } from '@/lib/types';
import Icon from '@/components/Icon';
import Loading from "@/components/Loading";

const inputStyle = { backgroundColor: '#FFFFFF', border: '1px solid #E8E4DC', color: '#1A1A1A', outline: 'none' } as const;

const emptyForm = {
  name: '', address: '', portalCode: '', keyboxCode: '',
  entryDirectives: '', bedrooms: '', beds: '', sofaBeds: '', clientPrice: '', notes: '',
};
type FormState = typeof emptyForm;

function aptToForm(a: Apartment): FormState {
  return {
    name: a.name ?? '',
    address: a.address ?? '',
    portalCode: a.portalCode ?? '',
    keyboxCode: a.keyboxCode ?? '',
    entryDirectives: a.entryDirectives ?? '',
    bedrooms: a.bedrooms != null ? String(a.bedrooms) : '',
    beds: a.beds != null ? String(a.beds) : '',
    sofaBeds: a.sofaBeds != null ? String(a.sofaBeds) : '',
    clientPrice: a.clientPrice != null ? String(a.clientPrice) : '',
    notes: a.notes ?? '',
  };
}

const TEXT_FIELDS: { label: string; key: keyof FormState; placeholder: string; required?: boolean }[] = [
  { label: "Nom de l'appartement", key: 'name', placeholder: 'Studio Bellecour', required: true },
  { label: 'Adresse complète', key: 'address', placeholder: '12 Rue de la Paix, Lyon', required: true },
  { label: 'Code portail — si besoin', key: 'portalCode', placeholder: '1234A' },
  { label: 'Boîte à clé — si besoin', key: 'keyboxCode', placeholder: 'B#4512' },
];

export default function AirbnbApartmentsPage() {
  const { user } = useAuth();
  const { confirm, toast } = useFeedback();
  const router = useRouter();
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    const [a, r] = await Promise.all([
      getAirbnbsForPartner(user.id),
      getReservationsForPartner(user.id),
    ]);
    setApartments(a);
    setReservations(r);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Deep-link ?edit=<id> (depuis la fiche logement) → ouvre directement l'édition.
  useEffect(() => {
    if (loading) return;
    const editId = new URLSearchParams(window.location.search).get('edit');
    if (!editId) return;
    const a = apartments.find(x => x.id === editId);
    if (a) openEdit(a);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(a: Apartment) {
    setEditingId(a.id);
    setForm(aptToForm(a));
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const payload = {
      name: form.name,
      address: form.address,
      portalCode: form.portalCode || undefined,
      keyboxCode: form.keyboxCode || undefined,
      entryDirectives: form.entryDirectives,
      bedrooms: form.bedrooms ? Number(form.bedrooms) : undefined,
      beds: form.beds ? Number(form.beds) : undefined,
      sofaBeds: form.sofaBeds ? Number(form.sofaBeds) : undefined,
      // Le PRIX facturé est fixé par l'admin : le partenaire ne l'envoie jamais
      // (clientPrice absent du payload → updateAirbnb ne le touche pas).
      notes: form.notes || undefined,
    };
    if (editingId) {
      await updateAirbnb(editingId, { ...payload, partnerName: user.name });
    } else {
      await createAirbnb({ ...payload, partnerId: user.id, partnerName: user.name });
    }
    await load();
    closeForm();
    setSaving(false);
  }

  async function handleDelete(id: string) {
    const ok = await confirm({ title: 'Supprimer cet appartement ?', message: 'Cette action est définitive.', confirmLabel: 'Supprimer', danger: true });
    if (!ok) return;
    await deleteAirbnb(id);
    await load();
    toast('Appartement supprimé.', 'success');
  }

  const visible = apartments.filter(a => {
    const q = search.toLowerCase();
    return !q || a.name.toLowerCase().includes(q) || a.address.toLowerCase().includes(q);
  });

  // Statut du jour par logement (occupé/libre + prochain départ) depuis les réservations.
  const todayStr = new Date().toLocaleDateString('en-CA');  // date LOCALE (pas UTC)
  const confirmedRes = reservations.filter(r => r.status === 'confirmed');
  function statusFor(aptId: string) {
    const occupied = confirmedRes.some(r => r.airbnbId === aptId && r.checkIn <= todayStr && r.checkOut >= todayStr);
    const nextDep = confirmedRes
      .filter(r => r.airbnbId === aptId && r.checkOut >= todayStr)
      .sort((a, b) => a.checkOut.localeCompare(b.checkOut))[0];
    return { occupied, nextDep };
  }

  if (loading) return <Loading className="p-5 pt-8" variant="skeleton" />;

  return (
    <div className="p-5 mcp-in">
      <div className="flex items-start justify-between gap-3 mb-5 pt-2">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1A1A1A' }}>Mes appartements</h1>
          <p className="text-sm mt-1" style={{ color: '#A8A09A' }}>{apartments.length} appartement{apartments.length > 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => (showForm ? closeForm() : openCreate())}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold shrink-0"
          style={{ backgroundColor: showForm ? '#F5F3EF' : '#C9A84C', color: showForm ? '#7A7068' : '#1A1A1A' }}>
          {showForm ? 'Annuler' : '+ Ajouter'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-2xl border p-5 mb-6" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          <h2 className="font-semibold mb-4" style={{ color: '#1A1A1A' }}>{editingId ? "Modifier l'appartement" : 'Nouvel appartement'}</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {TEXT_FIELDS.map(f => (
              <div key={f.key}>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#7A7068' }}>{f.label}</label>
                <input required={f.required} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder} className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
              </div>
            ))}

            <div className="md:col-span-2 grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#7A7068' }}>Chambres</label>
                <input type="number" min="0" value={form.bedrooms} onChange={e => setForm(p => ({ ...p, bedrooms: e.target.value }))}
                  placeholder="2" className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#7A7068' }}>Lits</label>
                <input type="number" min="0" value={form.beds} onChange={e => setForm(p => ({ ...p, beds: e.target.value }))}
                  placeholder="3" className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#7A7068' }}>Canapé-lit</label>
                <input type="number" min="0" value={form.sofaBeds} onChange={e => setForm(p => ({ ...p, sofaBeds: e.target.value }))}
                  placeholder="1" className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
              </div>
            </div>

            {/* Prix facturé : fixé par MonCleanerPro. Visible en transparence, mais
                NON modifiable par le partenaire (lecture seule). */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#7A7068' }}>Prix par ménage (€) — facturé</label>
              <div className="w-full px-4 py-3 rounded-xl text-sm border flex items-center justify-between"
                style={{ backgroundColor: '#F5F3EF', borderColor: '#E8E4DC', color: '#1A1A1A' }}>
                <span className="font-semibold">{form.clientPrice ? `${form.clientPrice} €` : 'À définir par MonCleanerPro'}</span>
                <span className="text-xs" style={{ color: '#A8A09A' }}>Fixé par MonCleanerPro</span>
              </div>
              <p className="text-xs mt-1.5" style={{ color: '#A8A09A' }}>
                Tarif convenu, appliqué à chaque ménage de cet appartement. Pour le modifier, contactez MonCleanerPro.
              </p>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#7A7068' }}>Instructions d'entrée</label>
              <textarea required value={form.entryDirectives} onChange={e => setForm(p => ({ ...p, entryDirectives: e.target.value }))} rows={2}
                placeholder="Comment accéder au logement..." className="w-full px-4 py-3 rounded-xl text-sm border resize-none" style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#7A7068' }}>Notes particulières — optionnel</label>
              <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2}
                placeholder="Animaux, parking, fragilités..." className="w-full px-4 py-3 rounded-xl text-sm border resize-none" style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
            </div>
          </div>

          <button type="submit" disabled={saving} className="w-full mt-4 py-3 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
            {saving ? 'Enregistrement...' : editingId ? 'Enregistrer les modifications' : "Ajouter l'appartement"}
          </button>
        </form>
      )}

      {apartments.length > 0 && (
        <div className="relative mb-5">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#A8A09A' }}>⌕</span>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border" style={inputStyle}
            onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
        </div>
      )}

      {visible.length === 0 ? (
        <div className="rounded-2xl p-10 flex flex-col items-center text-center border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
          <span className="mb-3" style={{ color: '#D4CEC4' }}><Icon name="building" size={30} /></span>
          <p className="font-medium text-sm" style={{ color: '#1A1A1A' }}>Aucun appartement</p>
          <p className="text-xs mt-1" style={{ color: '#A8A09A' }}>Ajoutez votre premier logement</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(apt => (
            <div key={apt.id} className="rounded-2xl border overflow-hidden" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
              <div className="px-5 py-4 border-b" style={{ borderColor: '#F2EFE9' }}>
                <div className="flex items-start justify-between gap-2">
                  <button onClick={() => router.push(`/airbnb/logement/${apt.id}`)} className="min-w-0 text-left flex-1">
                    <h3 className="font-semibold truncate flex items-center gap-1" style={{ color: '#1A1A1A' }}>
                      {apt.name}
                      <span className="text-xs shrink-0" style={{ color: '#C9A84C' }}>›</span>
                    </h3>
                    <p className="text-xs mt-0.5 flex items-center gap-1.5" style={{ color: '#A8A09A' }}><Icon name="pin" size={12} className="shrink-0" /> {apt.address}</p>
                  </button>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => openEdit(apt)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ backgroundColor: '#F5F3EF', color: '#7A7068' }}>Modifier</button>
                    <button onClick={() => handleDelete(apt.id)} className="text-xs px-2.5 py-1.5 rounded-lg" style={{ backgroundColor: '#B85A5010', color: '#B85A50' }}>✕</button>
                  </div>
                </div>
              </div>
              <div className="px-5 py-3 space-y-1.5 text-sm" style={{ color: '#7A7068' }}>
                {(() => {
                  const { occupied, nextDep } = statusFor(apt.id);
                  return (
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
                        style={{ backgroundColor: occupied ? '#5A8A6A15' : '#F1F1EE', color: occupied ? '#5A8A6A' : '#A8A09A' }}>
                        {occupied ? 'Occupé' : 'Libre'}
                      </span>
                      {nextDep && (
                        <span className="text-[11px]" style={{ color: '#A8A09A' }}>
                          Prochain départ : {new Date(nextDep.checkOut + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </div>
                  );
                })()}
                {apt.clientPrice != null && (
                  <p className="text-xs font-semibold" style={{ color: '#5A8A6A' }}>{apt.clientPrice}€ / ménage</p>
                )}
                {(apt.bedrooms != null || apt.beds != null || apt.sofaBeds != null) && (
                  <p className="text-xs">
                    {apt.bedrooms != null && <>{apt.bedrooms} chambre{apt.bedrooms > 1 ? 's' : ''}</>}
                    {apt.bedrooms != null && (apt.beds != null || apt.sofaBeds != null) && ' · '}
                    {apt.beds != null && <>{apt.beds} lit{apt.beds > 1 ? 's' : ''}</>}
                    {apt.beds != null && apt.sofaBeds != null && ' · '}
                    {apt.sofaBeds != null && <>{apt.sofaBeds} canapé-lit{apt.sofaBeds > 1 ? 's' : ''}</>}
                  </p>
                )}
                {apt.portalCode && <p className="text-xs"><span style={{ color: '#A8A09A' }}>Portail : </span><span className="font-mono font-semibold" style={{ color: '#1A1A1A' }}>{apt.portalCode}</span></p>}
                {apt.keyboxCode && <p className="text-xs"><span style={{ color: '#A8A09A' }}>Clé : </span><span className="font-mono font-semibold" style={{ color: '#1A1A1A' }}>{apt.keyboxCode}</span></p>}
                {apt.entryDirectives && <p className="text-xs">{apt.entryDirectives}</p>}
                {apt.notes && <p className="text-xs px-3 py-2 rounded-xl mt-1" style={{ backgroundColor: '#F8F6F2' }}>{apt.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
