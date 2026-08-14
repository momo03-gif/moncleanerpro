'use client';

// ── Relevé propriétaire (mensuel) ─────────────────────────────────────────────
//
// L'équivalent des « owner statements » de Hostify/Hostaway et des rapports
// propriétaire de Breezeway, à notre échelle : la conciergerie n'a pas besoin
// d'un portail à donner à chaque propriétaire, elle a besoin d'UN document
// propre à transmettre sous son nom.
//
// Contenu : les ménages du mois (avec l'heure à laquelle le logement était prêt
// et la note donnée), les incidents et réparations, les consommables signalés,
// et les photos encore disponibles. Export PDF et partage texte.

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useFeedback } from '@/contexts/FeedbackContext';
import { getAirbnbsForPartner, getMissionsForPartnerDB } from '@/lib/db';
import { getMissionPhotosForMissionsDB, PHOTO_RETENTION_DAYS } from '@/lib/missionPhotos';
import { getRepairsForApartmentDB } from '@/lib/repairs';
import { downloadElementPdf } from '@/lib/pdf';
import { missionReadiness } from '@/lib/readiness';
import { formatHour } from '@/lib/format';
import type { Apartment, Mission, MissionPhoto, Repair } from '@/lib/types';
import Loading from '@/components/Loading';
import Icon from '@/components/Icon';
import { Card } from '@/components/ui';

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = (key: string) =>
  new Date(key + '-01T00:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
const shiftMonth = (key: string, delta: number) => {
  const d = new Date(key + '-01T00:00:00');
  d.setMonth(d.getMonth() + delta);
  return monthKey(d);
};

export default function OwnerReportClient() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id ?? '');
  const { user } = useAuth();
  const { toast } = useFeedback();

  const [apt, setApt] = useState<Apartment | null>(null);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [photos, setPhotos] = useState<Map<string, MissionPhoto[]>>(new Map());
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const [apartments, all, reps] = await Promise.all([
      getAirbnbsForPartner(user.id),
      getMissionsForPartnerDB(user.id),
      getRepairsForApartmentDB(id),
    ]);
    setApt(apartments.find(a => a.id === id) ?? null);
    setMissions(all.filter(m => m.airbnbId === id));
    setRepairs(reps);
    setLoading(false);
  }, [user, id]);

  useEffect(() => { load(); }, [load]);

  // Ménages du mois sélectionné, terminés, du plus ancien au plus récent.
  const monthMissions = missions
    .filter(m => m.date.startsWith(month) && m.status === 'completed')
    .sort((a, b) => a.date.localeCompare(b.date));

  // Les photos ne sont chargées que pour le mois affiché (et sont purgées après
  // PHOTO_RETENTION_DAYS jours : un mois ancien n'en aura plus).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const found = await getMissionPhotosForMissionsDB(monthMissions.map(m => m.id));
      if (!cancelled) setPhotos(found);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, missions.length]);

  if (loading) return <Loading className="p-5 pt-8 text-sm" />;

  if (!apt) {
    return (
      <div className="p-5">
        <button onClick={() => router.back()} className="text-sm mb-4 min-h-[44px] text-gold-ink font-medium">← Retour</button>
        <Card className="p-10 text-center"><p className="text-sm text-muted">Logement introuvable.</p></Card>
      </div>
    );
  }

  const total = monthMissions.reduce((s, m) => s + (m.price || 0), 0);
  const rated = monthMissions.filter(m => m.partnerRating != null);
  const avgRating = rated.length
    ? (rated.reduce((s, m) => s + (m.partnerRating ?? 0), 0) / rated.length).toFixed(1)
    : null;
  const monthRepairs = repairs.filter(r => (r.createdAt ?? '').startsWith(month));
  const afterPhotos = monthMissions.flatMap(m => (photos.get(m.id) ?? []).filter(p => p.kind === 'after'));

  async function exportPdf() {
    if (!sheetRef.current) return;
    setExporting(true);
    try {
      await downloadElementPdf(sheetRef.current, `releve-${apt!.name.replace(/\s+/g, '-').toLowerCase()}-${month}.pdf`);
    } catch {
      toast('Export PDF impossible sur cet appareil.', 'error');
    }
    setExporting(false);
  }

  async function share() {
    const lines = [
      `Relevé d'entretien — ${apt!.name}`,
      monthLabel(month),
      '',
      `${monthMissions.length} ménage${monthMissions.length > 1 ? 's' : ''} réalisé${monthMissions.length > 1 ? 's' : ''}`,
      ...monthMissions.map(m => {
        const when = new Date(m.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
        return `· ${when}${m.partnerRating != null ? ` — ${m.partnerRating}/5` : ''}`;
      }),
      '',
      monthRepairs.length > 0
        ? `Points signalés : ${monthRepairs.map(r => r.description).join(' · ')}`
        : 'Aucun dégât signalé ce mois-ci.',
    ];
    const text = lines.join('\n');
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: `Relevé — ${apt!.name}`, text });
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        toast('Relevé copié — collez-le où vous voulez.', 'success');
      }
    } catch { /* partage annulé : silencieux */ }
  }

  return (
    <div className="p-5 mcp-in">
      <button onClick={() => router.back()} className="text-sm mb-4 inline-flex items-center gap-1 min-h-[44px] text-gold-ink font-medium">
        ← Retour
      </button>

      {/* Choix du mois */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <button onClick={() => setMonth(m => shiftMonth(m, -1))} aria-label="Mois précédent"
          className="w-9 h-9 rounded-xl border border-line flex items-center justify-center text-muted">‹</button>
        <p className="text-sm font-semibold capitalize text-ink">{monthLabel(month)}</p>
        <button onClick={() => setMonth(m => shiftMonth(m, 1))} aria-label="Mois suivant"
          className="w-9 h-9 rounded-xl border border-line flex items-center justify-center text-muted">›</button>
      </div>

      {/* La feuille : c'est exactement ce qui part en PDF. */}
      <div ref={sheetRef} className="rounded-2xl border border-line bg-card p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Relevé d&apos;entretien</p>
        <h1 className="text-lg font-bold mt-0.5 text-ink">{apt.name}</h1>
        <p className="text-xs text-muted">{apt.address}</p>
        <p className="text-xs mt-1 capitalize text-muted">{monthLabel(month)}</p>

        {/* Chiffres du mois */}
        <div className="grid grid-cols-3 gap-2 my-4">
          <Figure label="Ménages" value={String(monthMissions.length)} />
          <Figure label="Coût total" value={`${Math.round(total)} €`} />
          <Figure label="Satisfaction" value={avgRating ? `${avgRating}/5` : '—'} />
        </div>

        {/* Détail des ménages */}
        <Section title="Ménages réalisés" />
        {monthMissions.length === 0 ? (
          <p className="text-xs text-muted">Aucun ménage terminé sur ce mois.</p>
        ) : (
          <div className="space-y-1.5">
            {monthMissions.map(m => {
              const r = missionReadiness(m);
              return (
                <div key={m.id} className="flex items-baseline justify-between gap-3 border-b border-hairline pb-1.5">
                  <div className="min-w-0">
                    <p className="text-sm text-ink">
                      {new Date(m.date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                      {m.time ? ` · ${formatHour(m.time)}` : ''}
                    </p>
                    {r?.tone === 'ready' && (
                      <p className="text-[11px] text-success">Logement prêt</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {m.partnerRating != null && (
                      <span className="text-[11px] font-semibold text-gold-ink">{m.partnerRating}/5</span>
                    )}
                    {m.price ? <p className="text-xs font-semibold text-ink">{Math.round(m.price)} €</p> : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Points signalés */}
        <Section title="Points signalés" />
        {monthRepairs.length === 0 ? (
          <p className="text-xs text-muted">Aucun dégât ni anomalie signalé ce mois-ci.</p>
        ) : (
          <ul className="space-y-1">
            {monthRepairs.map(r => (
              <li key={r.id} className="text-sm flex items-start gap-2 text-ink">
                <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${r.status === 'open' ? 'bg-danger' : 'bg-success'}`} />
                <span>
                  {r.description}
                  <span className="text-[11px] text-muted"> — {r.status === 'open' ? 'à traiter' : 'réglé'}</span>
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* Photos encore disponibles */}
        {afterPhotos.length > 0 && (
          <>
            <Section title="Photos après ménage" />
            <div className="grid grid-cols-3 gap-2">
              {afterPhotos.slice(0, 9).map(p => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={p.id} src={p.url} alt="" crossOrigin="anonymous"
                  className="w-full aspect-square object-cover rounded-lg border border-line" />
              ))}
            </div>
            <p className="text-[10px] mt-1.5 text-faint">
              Les photos sont conservées {PHOTO_RETENTION_DAYS} jours : un relevé plus ancien n&apos;en contient plus.
            </p>
          </>
        )}

        <p className="text-[10px] mt-5 pt-3 border-t border-hairline text-faint">
          Document établi le {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}.
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-4">
        <button onClick={exportPdf} disabled={exporting}
          className="flex-1 py-3 rounded-xl text-sm font-semibold bg-ink text-white disabled:opacity-50 active:scale-95 transition-transform">
          {exporting ? 'Préparation…' : 'Télécharger en PDF'}
        </button>
        <button onClick={share}
          className="px-4 py-3 rounded-xl text-sm font-semibold border border-gold text-gold-ink inline-flex items-center gap-1.5 active:scale-95 transition-transform">
          <Icon name="link" size={14} /> Partager
        </button>
      </div>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-center">
      <p className="text-lg font-bold text-ink">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}

function Section({ title }: { title: string }) {
  return <p className="text-[11px] font-semibold uppercase tracking-wider mt-4 mb-1.5 text-muted">{title}</p>;
}
