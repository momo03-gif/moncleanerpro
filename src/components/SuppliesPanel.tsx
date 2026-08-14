'use client';

// ════════════════════════════════════════════════════════════════════════════
//  Réapprovisionnement d'un logement — la liste de courses.
//
//  Les manques sont déjà signalés par l'intervenant en fin de ménage ; ce
//  panneau les rassemble et retient ce qui a été racheté, pour ne pas relire
//  trois fois la même alerte. Un article signalé sur plusieurs ménages de suite
//  passe en alerte : personne ne l'a racheté.
// ════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import { getSupplyNeedsDB, markRestockedDB, undoRestockDB, type SupplyNeed } from '@/lib/supplies';
import Icon from '@/components/Icon';
import { useFeedback } from '@/contexts/FeedbackContext';

export default function SuppliesPanel({ airbnbId, authorName, defaultOpen }: {
  airbnbId: string; authorName?: string; defaultOpen?: boolean;
}) {
  const { toast } = useFeedback();
  const [open, setOpen] = useState(!!defaultOpen);
  const [loaded, setLoaded] = useState(false);
  const [needs, setNeeds] = useState<SupplyNeed[]>([]);
  const [busy, setBusy] = useState(false);
  // Dernier article coché : permet un « annuler » immédiat sans recharger l'esprit.
  const [lastDone, setLastDone] = useState<string | null>(null);

  const load = useCallback(async () => {
    setNeeds(await getSupplyNeedsDB(airbnbId));
    setLoaded(true);
  }, [airbnbId]);

  useEffect(() => { if (open && !loaded) load(); }, [open, loaded, load]);

  async function restock(item: string) {
    setBusy(true);
    const res = await markRestockedDB(airbnbId, item, authorName);
    setBusy(false);
    if (res.error) { toast('Enregistrement impossible.', 'error'); return; }
    setLastDone(item);
    await load();
  }

  async function undo(item: string) {
    setBusy(true);
    await undoRestockDB(airbnbId, item);
    setBusy(false);
    setLastDone(null);
    await load();
  }

  const urgent = needs.filter(n => n.timesReported >= 2).length;

  return (
    <div className="rounded-xl border border-line bg-surface">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-2.5 text-left">
        <span className="text-xs font-semibold uppercase tracking-wide flex items-center gap-2 text-muted">
          À réapprovisionner
          {loaded && needs.length > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${urgent > 0 ? 'bg-danger-soft text-danger' : 'bg-warn-soft text-warn'}`}>
              {needs.length}
            </span>
          )}
        </span>
        <span className={`text-faint transition-transform ${open ? 'rotate-180' : ''}`}><Icon name="chevronDown" size={15} /></span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {!loaded ? (
            <p className="text-xs py-2 text-faint">Chargement…</p>
          ) : needs.length === 0 ? (
            <p className="text-xs text-faint">
              Rien à racheter — aucun manque signalé lors des derniers ménages.
            </p>
          ) : (
            <>
              {needs.map(need => (
                <div key={need.item}
                  className={`rounded-xl border px-3 py-2.5 flex items-center gap-3 ${need.timesReported >= 2 ? 'border-danger-line bg-danger-soft' : 'border-line bg-card'}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink">{need.item}</p>
                    <p className="text-[11px] text-muted">
                      {need.timesReported >= 2
                        ? `signalé ${need.timesReported} ménages de suite`
                        : `signalé le ${new Date(need.lastReportedOn + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`}
                    </p>
                    {need.notes.length > 0 && (
                      <p className="text-[11px] mt-0.5 italic text-muted">« {need.notes.join(' · ')} »</p>
                    )}
                  </div>
                  <button onClick={() => restock(need.item)} disabled={busy}
                    className="shrink-0 text-[11px] font-semibold px-3 py-2 rounded-lg border border-line text-muted disabled:opacity-50">
                    Racheté
                  </button>
                </div>
              ))}
            </>
          )}

          {lastDone && (
            <p className="text-[11px] flex items-center gap-2 text-success">
              <Icon name="check" size={12} /> {lastDone} marqué racheté.
              <button onClick={() => undo(lastDone)} disabled={busy} className="underline text-muted">annuler</button>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
