'use client';

import { useEffect, useState } from 'react';
import { vueFacture, resteADevoir } from '@/lib/factureStatut';
import { Card, SectionTitle } from '@/components/ui';
import Icon from '@/components/Icon';

// ── Les factures du client, dans son espace ──────────────────────────────────
//
// Ce qu'il doit comprendre sans lire : ce qui est réglé (vert), ce qui ne l'est
// pas (rouge). Et pour ce qui ne l'est pas, la nuance qui évite de braquer
// quelqu'un qui est dans les temps : une facture non échue affiche sa date
// limite, une facture en retard dit depuis combien de jours.
//
// Le document n'est jamais servi directement : on demande au serveur un lien
// signé au moment du clic. Voir /api/factures.

interface FactureLigne {
  id: string;
  number?: string | null;
  period_from?: string | null;
  period_to?: string | null;
  total?: number | null;
  status?: string | null;
  due_date?: string | null;
  paid_at?: string | null;
  created_at?: string | null;
  hasFile?: boolean;
}

const euros = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);

const jour = (d?: string | null) =>
  d ? new Date(d.slice(0, 10) + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export default function PartnerInvoices() {
  const [factures, setFactures] = useState<FactureLigne[]>([]);
  const [chargement, setChargement] = useState(true);
  const [ouverture, setOuverture] = useState<string | null>(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    // `annule` évite d'écrire dans un composant démonté si le client quitte la
    // page pendant la requête.
    let annule = false;
    (async () => {
      try {
        const res = await fetch('/api/factures');
        if (res.ok && !annule) setFactures((await res.json()).factures ?? []);
      } catch { /* liste vide : l'écran le dit */ }
      if (!annule) setChargement(false);
    })();
    return () => { annule = true; };
  }, []);

  async function telecharger(id: string) {
    setOuverture(id); setErreur('');
    try {
      const res = await fetch('/api/factures', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'lien', id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) { setErreur(data.error ?? 'Document indisponible.'); return; }
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch {
      setErreur('Téléchargement impossible pour le moment.');
    } finally {
      setOuverture(null);
    }
  }

  if (chargement) return null;

  const du = resteADevoir(factures.map(f => ({ status: f.status, paidAt: f.paid_at, total: f.total })));

  return (
    <Card className="p-5">
      <SectionTitle>Mes factures</SectionTitle>

      {factures.length === 0 ? (
        <p className="-mt-1 text-xs text-muted">
          Aucune facture pour l’instant. Elles apparaîtront ici dès leur émission,
          et vous pourrez les télécharger.
        </p>
      ) : (
        <>
          <p className="-mt-1 mb-4 text-xs text-muted">
            {du > 0
              ? <>Solde en attente de règlement : <strong className="text-danger">{euros(du)}</strong></>
              : <>Tout est réglé. Merci.</>}
          </p>

          <div className="space-y-2">
            {factures.map(f => {
              const v = vueFacture({ status: f.status, dueDate: f.due_date, paidAt: f.paid_at });
              const rouge = v.couleur === 'rouge';
              return (
                <div key={f.id} className="rounded-xl border p-3 border-hairline">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate text-ink">
                        {f.number ?? 'Facture'}
                        <span className="ml-2 font-normal text-muted">{euros(Number(f.total) || 0)}</span>
                      </p>
                      <p className="text-[11px] text-muted">
                        {f.period_from && f.period_to
                          ? <>Période du {jour(f.period_from)} au {jour(f.period_to)}</>
                          : <>Émise le {jour(f.created_at)}</>}
                      </p>
                    </div>

                    {/* Vert = réglé, rouge = dû. Rien d'autre à décoder. */}
                    <span className="shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full"
                      style={rouge
                        ? { backgroundColor: '#B85A5015', color: '#B85A50' }
                        : { backgroundColor: '#5A8A6A15', color: '#5A8A6A' }}>
                      {v.libelle}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-2">
                    <span className="text-[11px] text-muted">
                      {v.etat === 'a_payer' && f.due_date && <>À régler avant le {jour(f.due_date)}</>}
                      {v.etat === 'payee' && f.paid_at && <>Réglée le {jour(f.paid_at)}</>}
                      {v.etat === 'en_retard' && <>Échéance dépassée le {jour(f.due_date)}</>}
                    </span>

                    {f.hasFile ? (
                      <button onClick={() => telecharger(f.id)} disabled={ouverture === f.id}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-line text-ink disabled:opacity-50">
                        <Icon name="invoice" size={13} />
                        {ouverture === f.id ? 'Ouverture…' : 'Télécharger'}
                      </button>
                    ) : (
                      <span className="text-[11px] text-faint">Document en préparation</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {erreur && <p role="alert" className="mt-3 text-xs text-danger">{erreur}</p>}
    </Card>
  );
}
