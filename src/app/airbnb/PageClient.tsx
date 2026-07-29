'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useFeedback } from '@/contexts/FeedbackContext';
import { getAirbnbsForPartner, getReservationsForPartner, createAirbnb, updateAirbnb, deleteAirbnb } from '@/lib/db';
import type { Apartment, Reservation } from '@/lib/types';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import { Badge, Button, Card, EmptyState, FIELD, IconButton, Label, PageTitle } from '@/components/ui';

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

const COUNT_FIELDS: { label: string; key: keyof FormState; placeholder: string }[] = [
  { label: 'Chambres', key: 'bedrooms', placeholder: '2' },
  { label: 'Lits', key: 'beds', placeholder: '3' },
  { label: 'Canapé-lit', key: 'sofaBeds', placeholder: '1' },
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
      <PageTitle
        title="Mes appartements"
        subtitle={`${apartments.length} appartement${apartments.length > 1 ? 's' : ''}`}
        action={
          <Button variant={showForm ? 'secondary' : 'primary'} onClick={() => (showForm ? closeForm() : openCreate())}>
            {showForm ? 'Annuler' : <><Icon name="plus" size={16} /> Ajouter</>}
          </Button>
        }
      />

      {showForm && (
        <Card as="section" className="p-5 mb-6">
          <form onSubmit={handleSubmit}>
            <h2 className="font-semibold mb-4 text-ink">{editingId ? "Modifier l'appartement" : 'Nouvel appartement'}</h2>
            <div className="grid md:grid-cols-2 gap-3">
              {TEXT_FIELDS.map(f => (
                <div key={f.key}>
                  <Label htmlFor={`apt-${f.key}`}>{f.label}</Label>
                  <input id={`apt-${f.key}`} required={f.required} value={form[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder} className={FIELD} />
                </div>
              ))}

              <div className="md:col-span-2 grid grid-cols-3 gap-3">
                {COUNT_FIELDS.map(f => (
                  <div key={f.key}>
                    <Label htmlFor={`apt-${f.key}`}>{f.label}</Label>
                    <input id={`apt-${f.key}`} type="number" min="0" value={form[f.key]}
                      onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                      placeholder={f.placeholder} className={FIELD} />
                  </div>
                ))}
              </div>

              {/* Prix facturé : fixé par MonCleanerPro. Visible en transparence, mais
                  NON modifiable par le partenaire (lecture seule). */}
              <div className="md:col-span-2">
                <Label>Prix par ménage (€) — facturé</Label>
                <div className="w-full px-4 py-3 rounded-xl text-sm border bg-surface border-line text-ink flex items-center justify-between gap-2">
                  <span className="font-semibold">{form.clientPrice ? `${form.clientPrice} €` : 'À définir par MonCleanerPro'}</span>
                  <span className="text-xs shrink-0 text-muted">Fixé par MonCleanerPro</span>
                </div>
                <p className="text-xs mt-1.5 text-muted">
                  Tarif convenu, appliqué à chaque ménage de cet appartement. Pour le modifier, contactez MonCleanerPro.
                </p>
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="apt-entry">Instructions d&apos;entrée</Label>
                <textarea id="apt-entry" required value={form.entryDirectives}
                  onChange={e => setForm(p => ({ ...p, entryDirectives: e.target.value }))} rows={2}
                  placeholder="Comment accéder au logement..." className={`${FIELD} resize-none`} />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="apt-notes">Notes particulières — optionnel</Label>
                <textarea id="apt-notes" value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2}
                  placeholder="Animaux, parking, fragilités..." className={`${FIELD} resize-none`} />
              </div>
            </div>

            <Button type="submit" size="lg" disabled={saving} className="mt-4">
              {saving ? 'Enregistrement...' : editingId ? 'Enregistrer les modifications' : "Ajouter l'appartement"}
            </Button>
          </form>
        </Card>
      )}

      {apartments.length > 0 && (
        <div className="relative mb-5">
          {/* Le glyphe « ⌕ » servait d'icône de recherche : absent de nombreuses
              polices et non aligné avec le jeu d'icônes maison. */}
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" aria-hidden="true">
            <Icon name="search" size={16} />
          </span>
          <input type="search" value={search} onChange={e => setSearch(e.target.value)}
            aria-label="Rechercher un appartement" placeholder="Rechercher..."
            className={`${FIELD} pl-10 pr-4 py-2.5`} />
        </div>
      )}

      {visible.length === 0 ? (
        apartments.length === 0
          ? <EmptyState icon="building" title="Aucun appartement" hint="Ajoutez votre premier logement" />
          : <EmptyState icon="search" title="Aucun résultat" hint={`Rien ne correspond à « ${search} »`} />
      ) : (
        <div className="space-y-3">
          {visible.map(apt => {
            const { occupied, nextDep } = statusFor(apt.id);
            return (
              <Card key={apt.id} className="overflow-hidden">
                <div className="px-5 py-4 border-b border-hairline">
                  <div className="flex items-start justify-between gap-2">
                    <button onClick={() => router.push(`/airbnb/logement/${apt.id}`)} className="min-w-0 text-left flex-1">
                      <h3 className="font-semibold truncate flex items-center gap-1 text-ink">
                        {apt.name}
                        <span className="shrink-0 text-gold-ink" aria-hidden="true"><Icon name="chevronRight" size={14} /></span>
                      </h3>
                      <p className="text-xs mt-0.5 flex items-center gap-1.5 text-muted">
                        <Icon name="pin" size={12} className="shrink-0" /> {apt.address}
                      </p>
                    </button>
                    <div className="flex gap-1.5 shrink-0">
                      <Button variant="secondary" size="sm" onClick={() => openEdit(apt)}>Modifier</Button>
                      {/* Le « ✕ » n'avait aucun nom accessible : un lecteur d'écran
                          annonçait « bouton » sans dire ce qu'il supprimait. */}
                      <IconButton icon="close" tone="danger" label={`Supprimer ${apt.name}`} onClick={() => handleDelete(apt.id)} />
                    </div>
                  </div>
                </div>
                <div className="px-5 py-3 space-y-1.5 text-sm text-muted">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <Badge tone={occupied ? 'success' : 'neutral'}>{occupied ? 'Occupé' : 'Libre'}</Badge>
                    {nextDep && (
                      <span className="text-[11px] text-muted">
                        Prochain départ : {new Date(nextDep.checkOut + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                  {apt.clientPrice != null && (
                    <p className="text-xs font-semibold text-success">{apt.clientPrice}€ / ménage</p>
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
                  {apt.portalCode && <p className="text-xs"><span className="text-muted">Portail : </span><span className="font-mono font-semibold text-ink">{apt.portalCode}</span></p>}
                  {apt.keyboxCode && <p className="text-xs"><span className="text-muted">Clé : </span><span className="font-mono font-semibold text-ink">{apt.keyboxCode}</span></p>}
                  {apt.entryDirectives && <p className="text-xs">{apt.entryDirectives}</p>}
                  {apt.notes && <p className="text-xs px-3 py-2 rounded-xl mt-1 bg-surface-2">{apt.notes}</p>}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
