'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getBillingProfileDB, saveBillingProfileDB } from '@/lib/db/partners';
import { Card, PageTitle, SectionTitle } from '@/components/ui';
import Loading from '@/components/Loading';

// ══════════════════════════════════════════════════════════════════════════════
//  Profil partenaire — informations de FACTURATION.
//
//  Ces trois champs sont ceux qui s'impriment en tête de facture. L'adresse du
//  client est une mention obligatoire (art. L.441-9 du code de commerce), et
//  elle n'était jusqu'ici collectée QUE pour les comptes hôtels : une facture
//  émise à une conciergerie partait sans adresse.
//
//  Le partenaire les tient à jour lui-même. C'est aussi le bon endroit : c'est
//  lui qui sait quand sa structure change de nom ou de siège, pas nous.
// ══════════════════════════════════════════════════════════════════════════════

const FIELD = 'w-full px-3 py-2.5 rounded-xl text-sm border border-line bg-white text-ink placeholder:text-muted focus:outline-none focus:border-gold';
const LABEL = 'block text-xs font-semibold text-muted mb-1.5';

export default function PartnerProfileClient() {
  const { user } = useAuth();
  const [f, setF] = useState({ name: '', email: '', phone: '', address: '' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!user) return;
    (async () => {
      const p = await getBillingProfileDB();
      if (p) setF({ name: p.name, email: p.email, phone: p.phone, address: p.address });
      setLoading(false);
    })();
  }, [user]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF(s => ({ ...s, [k]: e.target.value }));

  async function save() {
    setErr(''); setMsg('');
    if (!f.name.trim()) { setErr('Le nom de la structure est requis : c’est lui qui figure sur la facture.'); return; }
    setBusy(true);
    const { error, addressSkipped } = await saveBillingProfileDB(f);
    setBusy(false);
    if (error) { setErr(error); return; }
    setMsg(addressSkipped
      ? 'Enregistré, sauf l’adresse postale : une mise à jour technique est encore en attente de notre côté. Nous la reprendrons.'
      : 'Informations enregistrées. Elles figureront sur vos prochaines factures.');
  }

  if (loading) return <Loading className="p-5 pt-8 text-sm" />;

  return (
    <div className="p-5 pb-24">
      <PageTitle
        title="Mon profil"
        subtitle="Les informations qui figurent sur vos factures et vos devis."
      />

      <Card className="p-5">
        <SectionTitle>Informations de facturation</SectionTitle>
        <p className="-mt-1 mb-4 text-xs text-muted">
          Ces informations concernent <strong>votre société</strong> et figurent sur les factures
          que nous vous adressons. Elles n’ont rien à voir avec les logements que vous gérez.
        </p>
        <div className="grid gap-4">
          <div>
            <label className={LABEL} htmlFor="pf-name">Nom de la structure</label>
            <input id="pf-name" value={f.name} onChange={set('name')} className={FIELD}
              placeholder="Ex. Hosting Services Lyon" autoComplete="organization" />
            <p className="mt-1.5 text-xs text-muted">Le nom exact de votre société, tel qu’il doit apparaître sur la facture.</p>
          </div>

          <div>
            <label className={LABEL} htmlFor="pf-email">Adresse e-mail de facturation</label>
            <input id="pf-email" type="email" value={f.email} onChange={set('email')} className={FIELD}
              placeholder="comptabilite@votre-structure.fr" autoComplete="email" />
            <p className="mt-1.5 text-xs text-muted">C’est à cette adresse que partent vos factures. Elle peut être différente de celle de votre connexion.</p>
          </div>

          <div>
            <label className={LABEL} htmlFor="pf-address">Adresse de facturation</label>
            <textarea id="pf-address" value={f.address} onChange={set('address')} rows={3}
              className={FIELD} placeholder={'12 rue de la République\n69002 Lyon'} />
            <p className="mt-1.5 text-xs text-muted">Le siège de votre société — c’est cette adresse qui s’imprime sur la facture, et non celle d’un logement. Mention obligatoire sur une facture.</p>
          </div>

          <div>
            <label className={LABEL} htmlFor="pf-phone">Téléphone</label>
            <input id="pf-phone" value={f.phone} onChange={set('phone')} className={FIELD}
              placeholder="06 12 34 56 78" autoComplete="tel" />
            <p className="mt-1.5 text-xs text-muted">Pour vous joindre rapidement en cas d’imprévu sur une intervention.</p>
          </div>
        </div>

        {err && <p className="mt-4 text-sm text-danger">{err}</p>}
        {msg && <p className="mt-4 text-sm text-success">{msg}</p>}

        <button onClick={save} disabled={busy}
          className="mt-5 w-full sm:w-auto px-6 py-2.5 rounded-xl text-sm font-semibold bg-ink text-white disabled:opacity-60">
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </Card>
    </div>
  );
}
