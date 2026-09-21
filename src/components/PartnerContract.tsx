'use client';

import { useEffect, useState } from 'react';
import { Badge, Card, SectionTitle, Button } from '@/components/ui';
import Icon from '@/components/Icon';

// ── Le contrat du client, lisible et acceptable depuis son espace ────────────
//
// Ce que le client doit pouvoir faire ici, sans nous écrire : lire ses
// conditions particulières en entier, et les accepter. L'acceptation est un
// clic horodaté, tracé côté serveur — pas une case à cocher décorative : on le
// lui dit, parce qu'un engagement qu'on prend sans le savoir n'en est pas un.
//
// Le texte affiché vient de la base, figé au moment où le contrat a été établi.
// On ne le recalcule jamais ici : ce serait afficher autre chose que ce qui a
// été accepté.

interface Article { titre: string; paragraphes: string[] }

interface Contrat {
  id: string;
  version: number;
  reference: string;
  date_effet: string;
  articles: Article[] | null;
  statut: 'brouillon' | 'propose' | 'accepte' | 'remplace' | 'resilie';
  accepte_le: string | null;
  accepte_par: string | null;
}

const jour = (d?: string | null) =>
  d ? new Date(d.length > 10 ? d : d + 'T00:00:00')
    .toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';

export default function PartnerContract() {
  const [contrat, setContrat] = useState<Contrat | null>(null);
  const [chargement, setChargement] = useState(true);
  const [ouvert, setOuvert] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const res = await fetch('/api/contrats');
        if (res.ok && !annule) {
          const { contrats } = await res.json();
          // Le plus récent d'abord : c'est celui qui fait foi.
          setContrat((contrats ?? [])[0] ?? null);
        }
      } catch { /* l'écran dit « aucun contrat » */ }
      if (!annule) setChargement(false);
    })();
    return () => { annule = true; };
  }, []);

  async function accepter() {
    if (!contrat) return;
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/contrats', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accepter', id: contrat.id }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(d.error ?? 'Enregistrement impossible.'); return; }
      setContrat({ ...contrat, statut: 'accepte', accepte_le: new Date().toISOString() });
    } catch {
      setErr('Enregistrement impossible pour le moment.');
    } finally { setBusy(false); }
  }

  if (chargement) return null;

  // ── Aucun contrat : on ne laisse pas une carte vide sans explication ──────
  if (!contrat) {
    return (
      <Card className="p-5">
        <SectionTitle>Contrat de prestation</SectionTitle>
        <p className="-mt-1 text-xs text-muted">
          Aucun contrat n’est encore établi pour votre compte. Vos interventions
          restent régies par nos conditions générales de vente. Dès que nous
          formaliserons vos conditions particulières — logements, prix, préavis —
          elles apparaîtront ici, à lire et à accepter.
        </p>
      </Card>
    );
  }

  const aAccepter = contrat.statut === 'propose';
  const accepte = contrat.statut === 'accepte';

  return (
    <Card className="p-5" tone={aAccepter ? 'alert' : 'plain'}>
      <SectionTitle
        aside={
          <Badge tone={accepte ? 'success' : aAccepter ? 'danger' : 'neutral'}>
            {accepte ? 'Accepté' : aAccepter ? 'À accepter' : contrat.statut === 'resilie' ? 'Résilié' : 'Remplacé'}
          </Badge>
        }
      >
        Contrat de prestation
      </SectionTitle>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div>
          <dt className="text-muted">Référence</dt>
          <dd className="font-semibold text-ink">
            {contrat.reference}{contrat.version > 1 && <span className="font-normal text-muted"> · v{contrat.version}</span>}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Prise d’effet</dt>
          <dd className="font-semibold text-ink">{jour(contrat.date_effet)}</dd>
        </div>
        {accepte && (
          <div className="col-span-2">
            <dt className="text-muted">Accepté</dt>
            <dd className="font-semibold text-ink">
              le {jour(contrat.accepte_le)}{contrat.accepte_par ? ` par ${contrat.accepte_par}` : ''}
            </dd>
          </div>
        )}
      </dl>

      {aAccepter && (
        <p className="mt-3 text-xs text-muted">
          Prenez le temps de lire ces conditions : elles fixent vos prix, le
          préavis et les cas de facturation d’un déplacement. Votre acceptation
          est enregistrée avec sa date et son auteur.
        </p>
      )}

      <button
        onClick={() => setOuvert(o => !o)}
        aria-expanded={ouvert}
        className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-ink"
      >
        <Icon name={ouvert ? 'chevronDown' : 'chevronRight'} size={14} />
        {ouvert ? 'Replier le contrat' : 'Lire le contrat en entier'}
      </button>

      {ouvert && (
        <div className="mt-4 rounded-xl border border-hairline p-4 max-h-[26rem] overflow-y-auto">
          {(contrat.articles ?? []).map(a => (
            <section key={a.titre} className="mb-4 last:mb-0">
              <h3 className="text-xs font-bold text-ink mb-1">{a.titre}</h3>
              {a.paragraphes.map((p, i) => (
                <p key={i} className="text-xs leading-relaxed text-muted mb-1 last:mb-0">{p}</p>
              ))}
            </section>
          ))}
          <p className="pt-3 mt-3 border-t border-hairline text-[11px] text-faint">
            Nos conditions générales de vente complètent ce document.
          </p>
        </div>
      )}

      {err && <p role="alert" className="mt-3 text-xs text-danger">{err}</p>}

      {aAccepter && (
        <div className="mt-4">
          <Button onClick={accepter} disabled={busy} size="md">
            {busy ? 'Enregistrement…' : 'J’accepte ces conditions'}
          </Button>
        </div>
      )}
    </Card>
  );
}
