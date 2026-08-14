'use client';

// Détail d'un ménage côté partenaire : récapitulatif + compte-rendu de fin de
// mission (consommables, dégâts, objets oubliés) + photos avant/après en lecture
// seule. C'est la « preuve de prestation » que la conciergerie peut montrer à son
// propre propriétaire. Sécurité : on ne charge que les missions du partenaire
// (getMissionsForPartnerDB) — une mission d'un autre partenaire = introuvable.

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useFeedback } from '@/contexts/FeedbackContext';
import { getMissionsForPartnerDB, rateMissionDB } from '@/lib/db';
import Icon from '@/components/Icon';
import { getMissionReportDB, reportHasContent } from '@/lib/missionReports';
import type { Mission, MissionReport } from '@/lib/types';
import { missionStatusCfg, missionStatusLabel, missionTypeLabel } from '@/lib/labels';
import { serviceParts } from '@/lib/service';
import { formatHour } from '@/lib/format';
import { missionReadiness, READINESS_STYLE } from '@/lib/readiness';
import MissionPhotos from '@/components/MissionPhotos';
import ChecklistPanel from '@/components/ChecklistPanel';
import Loading from '@/components/Loading';
import { Badge, Card, SectionTitle } from '@/components/ui';

// Construit un compte-rendu TEXTE que la conciergerie peut transférer à son
// propriétaire (les photos restent consultables dans l'app).
function buildRecapText(mission: Mission, report: MissionReport | null): string {
  const lines: string[] = [];
  lines.push(`Compte-rendu de ménage — ${mission.property || 'Logement'}`);
  lines.push(fmtDate(mission.date) + (mission.time ? ` · ${formatHour(mission.time)}` : ''));
  lines.push('Statut : Terminé ✓');
  if (mission.cleanerName) lines.push(`Intervenant : ${mission.cleanerName}`);
  lines.push('');
  const pts: string[] = [];
  if (report?.issues) pts.push(`⚠ Dégât / problème : ${report.issues}`);
  if (report?.consumables?.length || report?.consumablesNote) {
    const items = [report?.consumables?.join(', '), report?.consumablesNote].filter(Boolean).join(' — ');
    pts.push(`À réapprovisionner : ${items}`);
  }
  if (report?.lostFound) pts.push(`Objet oublié : ${report.lostFound}`);
  if (report?.note) pts.push(`Remarque : ${report.note}`);
  if (pts.length === 0) pts.push('Aucun point particulier signalé — logement propre et conforme.');
  lines.push(...pts);
  lines.push('');
  lines.push('Photos avant/après disponibles dans l’espace MonCleanerPro.');
  return lines.join('\n');
}

function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function PartnerMissionDetailClient() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id ?? '');
  const { user } = useAuth();
  const { toast } = useFeedback();

  const [mission, setMission] = useState<Mission | null>(null);
  const [report, setReport] = useState<MissionReport | null>(null);
  const [loading, setLoading] = useState(true);

  async function shareRecap() {
    if (!mission) return;
    const text = buildRecapText(mission, report);
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: `Compte-rendu — ${mission.property || 'Logement'}`, text });
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        toast('Compte-rendu copié — collez-le où vous voulez.', 'success');
      }
    } catch { /* partage annulé par l'utilisateur : silencieux */ }
  }

  const load = useCallback(async () => {
    if (!user) return;
    const missions = await getMissionsForPartnerDB(user.id);
    const m = missions.find(x => x.id === id) ?? null;
    setMission(m);
    if (m) setReport(await getMissionReportDB(id));
    setLoading(false);
  }, [user, id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Loading className="p-5 pt-8 text-sm" />;

  if (!mission) {
    return (
      <div className="p-5">
        <BackButton onClick={() => router.back()} />
        <Card className="p-10 text-center">
          <p className="text-sm text-muted">Ménage introuvable.</p>
        </Card>
      </div>
    );
  }

  const cfg = missionStatusCfg(mission.status);
  const isDelivery = serviceParts(mission.service).delivery;
  const hasReport = reportHasContent(report);
  const isDone = mission.status === 'completed';
  const readiness = missionReadiness(mission);

  return (
    <div className="p-5 mcp-in">
      <BackButton onClick={() => router.back()} />

      {/* Récapitulatif */}
      <Card className="p-5 mb-5">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h1 className="text-lg font-bold text-ink">{mission.property || 'Logement'}</h1>
          <Badge style={{ backgroundColor: cfg.bg, color: cfg.color }}>
            {missionStatusLabel(mission.status, mission.service)}
          </Badge>
        </div>
        {mission.address && (
          <p className="text-xs mb-3 flex items-center gap-1.5 text-muted">
            <Icon name="pin" size={12} className="shrink-0" /> {mission.address}
          </p>
        )}
        {/* Maison louée à la chambre : périmètre exact du ménage commandé. */}
        {mission.coveredUnits && (
          <div className={`mb-3 px-3 py-2 rounded-xl border ${mission.wholeProperty ? 'border-gold-line bg-gold-soft' : 'border-line bg-surface'}`}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">À faire</p>
            <p className="text-sm font-semibold mt-0.5 text-ink">{mission.coveredUnits}</p>
          </div>
        )}
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <div>
            <p className="text-[11px] text-muted">Date</p>
            <p className="font-semibold text-ink">{fmtDate(mission.date)}{mission.time ? ` · ${formatHour(mission.time)}` : ''}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted">Prestation</p>
            <p className="font-semibold text-ink">{isDelivery ? 'Livraison' : missionTypeLabel(mission.type)}</p>
          </div>
          <div>
            <p className="text-[11px] text-muted">Intervenant</p>
            <p className="font-semibold text-ink">{mission.cleanerName || 'Non assigné'}</p>
          </div>
        </div>
      </Card>

      {/* Préparation du logement : la vraie question de la conciergerie — le
          logement est-il prêt, et l'a-t-il été à temps pour le voyageur ? */}
      {readiness && (
        <div className={`rounded-2xl p-4 mb-4 flex items-center gap-3 border ${READINESS_STYLE[readiness.tone].box}`}>
          <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white ${READINESS_STYLE[readiness.tone].dot}`}>
            <Icon name={readiness.tone === 'ready' ? 'check' : readiness.tone === 'progress' ? 'sync' : 'clock'} size={18} />
          </span>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold ${READINESS_STYLE[readiness.tone].text}`}>{readiness.label}</p>
            <p className={`text-xs ${READINESS_STYLE[readiness.tone].text}`}>
              {readiness.detail ?? (isDone ? 'Photos et compte-rendu ci-dessous.' : 'Vous serez prévenu dès que le ménage sera terminé.')}
            </p>
          </div>
        </div>
      )}

      {/* Notation du ménage — le retour qualité, donné par le client lui-même. */}
      {isDone && user && (
        <div className="mb-5">
          <RatingCard mission={mission} partnerId={user.id} onRated={load} />
        </div>
      )}

      {/* Checklist : la preuve, point par point, que votre standard a été suivi. */}
      {mission.airbnbId && (
        <div className="mb-5">
          <ChecklistPanel airbnbId={mission.airbnbId} missionId={mission.id} mode="viewer" defaultOpen={isDone} />
        </div>
      )}

      {/* Compte-rendu de fin de ménage */}
      <SectionTitle aside={isDone ? (
        <button onClick={shareRecap}
          className="text-xs font-semibold px-3 py-2 rounded-lg border inline-flex items-center gap-1.5 border-gold text-gold-ink active:scale-95 transition-transform">
          <Icon name="link" size={13} /> Partager
        </button>
      ) : undefined}>
        Compte-rendu
      </SectionTitle>
      {!isDone && !hasReport ? (
        <Card className="p-6 text-center mb-5">
          <p className="text-xs text-muted">Le compte-rendu sera disponible une fois le ménage terminé.</p>
        </Card>
      ) : !hasReport ? (
        <Card className="p-6 text-center mb-5">
          <p className="text-xs text-muted">Aucun compte-rendu particulier pour ce ménage.</p>
        </Card>
      ) : (
        <div className="space-y-3 mb-5">
          {report!.issues && (
            <ReportBlock title="Dégâts / problèmes signalés" tone="alert">{report!.issues}</ReportBlock>
          )}
          {(report!.consumables?.length || report!.consumablesNote) && (
            <ReportBlock title="Consommables à remplacer">
              {report!.consumables && report!.consumables.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {report!.consumables.map(c => (
                    <span key={c} className="text-[11px] px-2 py-0.5 rounded-full bg-warn-soft text-warn">{c}</span>
                  ))}
                </div>
              )}
              {report!.consumablesNote}
            </ReportBlock>
          )}
          {report!.lostFound && <ReportBlock title="Objets oubliés">{report!.lostFound}</ReportBlock>}
          {report!.note && <ReportBlock title="Note du cleaner">{report!.note}</ReportBlock>}
        </div>
      )}

      {/* Photos avant / après (lecture seule) */}
      <SectionTitle>Photos</SectionTitle>
      <MissionPhotos missionId={mission.id} mode="viewer" defaultOpen />
    </div>
  );
}

// Ce que veut dire chaque note — un chiffre seul se lit mal d'un client à l'autre.
const RATING_LABELS: Record<number, string> = {
  1: 'À refaire', 2: 'Insuffisant', 3: 'Correct', 4: 'Très bien', 5: 'Impeccable',
};

// ── Notation du ménage ────────────────────────────────────────────────────────
// Une note de 1 à 5 et un mot, donnés par la conciergerie sur un ménage terminé.
// Modifiable : un avis peut changer une fois le logement revisité.
function RatingCard({ mission, partnerId, onRated }: {
  mission: Mission; partnerId: string; onRated: () => void;
}) {
  const { toast } = useFeedback();
  const [rating, setRating] = useState(mission.partnerRating ?? 0);
  const [comment, setComment] = useState(mission.partnerRatingComment ?? '');
  const [editing, setEditing] = useState(!mission.partnerRating);
  const [busy, setBusy] = useState(false);

  async function save(value: number) {
    setBusy(true);
    const res = await rateMissionDB(mission.id, partnerId, value, comment);
    setBusy(false);
    if (res.error) { toast('Enregistrement de la note impossible.', 'error'); return; }
    setEditing(false);
    toast('Merci — votre retour est transmis à l’équipe.', 'success');
    onRated();
  }

  return (
    <Card className="p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide mb-2 text-muted">
        {mission.partnerRating ? 'Votre évaluation' : 'Ce ménage vous convient ?'}
      </p>

      <div className="flex items-center gap-1.5 mb-1">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} type="button" disabled={busy || !editing}
            onClick={() => setRating(n)}
            aria-label={`${n} étoile${n > 1 ? 's' : ''} sur 5`}
            className={`w-9 h-9 rounded-lg flex items-center justify-center ${n <= rating ? 'text-gold-ink bg-gold-soft' : 'text-faint bg-surface'} ${editing ? 'active:scale-90 transition-transform' : ''}`}>
            <Icon name="star" size={17} filled={n <= rating} />
          </button>
        ))}
        {mission.partnerRating != null && !editing && (
          <button onClick={() => setEditing(true)} className="ml-auto text-[11px] font-medium text-gold-ink">Modifier</button>
        )}
      </div>
      {/* Le mot vaut mieux que le chiffre : on dit ce que la note signifie. */}
      <p className="text-[11px] mb-2 h-4 text-muted">{RATING_LABELS[rating] ?? 'Touchez une étoile pour noter'}</p>

      {editing ? (
        <>
          <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2}
            placeholder="Un mot pour l’équipe (facultatif)"
            className="w-full px-3 py-2 rounded-lg text-sm border border-line bg-card text-ink resize-none" />
          <button onClick={() => save(rating)} disabled={busy || rating === 0}
            className="mt-2 w-full py-2.5 rounded-xl text-xs font-semibold bg-gold text-ink disabled:opacity-50">
            {busy ? '…' : 'Envoyer mon évaluation'}
          </button>
        </>
      ) : (
        mission.partnerRatingComment && <p className="text-sm text-ink">{mission.partnerRatingComment}</p>
      )}
    </Card>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-sm mb-4 inline-flex items-center gap-1 min-h-[44px] text-gold-ink font-medium">
      ← Retour
    </button>
  );
}

function ReportBlock({ title, tone = 'plain', children }: { title: string; tone?: 'plain' | 'alert'; children: React.ReactNode }) {
  return (
    <div className={`rounded-2xl border p-4 ${tone === 'alert' ? 'bg-danger-soft border-danger-line' : 'bg-card border-line'}`}>
      <p className={`text-[11px] font-semibold uppercase tracking-wide mb-1.5 ${tone === 'alert' ? 'text-danger' : 'text-muted'}`}>{title}</p>
      <div className="text-sm leading-snug text-ink">{children}</div>
    </div>
  );
}
