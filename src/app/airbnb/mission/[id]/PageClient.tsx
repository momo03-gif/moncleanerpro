'use client';

// Détail d'un ménage côté partenaire : récapitulatif + compte-rendu de fin de
// mission (consommables, dégâts, objets oubliés) + photos avant/après en lecture
// seule. C'est la « preuve de prestation » que la conciergerie peut montrer à son
// propre propriétaire. Sécurité : on ne charge que les missions du partenaire
// (getMissionsForPartnerDB) — une mission d'un autre partenaire = introuvable.

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getMissionsForPartnerDB } from '@/lib/db';
import Icon from '@/components/Icon';
import { getMissionReportDB, reportHasContent } from '@/lib/missionReports';
import type { Mission, MissionReport } from '@/lib/types';
import { missionStatusCfg, missionStatusLabel, missionTypeLabel } from '@/lib/labels';
import { serviceParts } from '@/lib/service';
import { formatHour } from '@/lib/format';
import MissionPhotos from '@/components/MissionPhotos';
import Loading from '@/components/Loading';

function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function PartnerMissionDetailClient() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id ?? '');
  const { user } = useAuth();

  const [mission, setMission] = useState<Mission | null>(null);
  const [report, setReport] = useState<MissionReport | null>(null);
  const [loading, setLoading] = useState(true);

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
        <button onClick={() => router.back()} className="text-sm mb-4" style={{ color: '#C9A84C' }}>← Retour</button>
        <div className="rounded-2xl p-10 text-center border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
          <p className="text-sm" style={{ color: '#A8A09A' }}>Ménage introuvable.</p>
        </div>
      </div>
    );
  }

  const cfg = missionStatusCfg(mission.status);
  const isDelivery = serviceParts(mission.service).delivery;
  const hasReport = reportHasContent(report);
  const isDone = mission.status === 'completed';

  return (
    <div className="p-5">
      <button onClick={() => router.back()} className="text-sm mb-4 inline-flex items-center gap-1" style={{ color: '#C9A84C' }}>← Retour</button>

      {/* Récapitulatif */}
      <div className="rounded-2xl border p-5 mb-5" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
        <div className="flex items-start justify-between gap-2 mb-2">
          <h1 className="text-lg font-bold" style={{ color: '#1A1A1A' }}>{mission.property || 'Logement'}</h1>
          <span className="text-[11px] px-2.5 py-1 rounded-full font-semibold shrink-0" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
            {missionStatusLabel(mission.status, mission.service)}
          </span>
        </div>
        {mission.address && <p className="text-xs mb-3 flex items-center gap-1.5" style={{ color: '#A8A09A' }}><Icon name="pin" size={12} className="shrink-0" /> {mission.address}</p>}
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <div>
            <p className="text-[11px]" style={{ color: '#A8A09A' }}>Date</p>
            <p className="font-semibold" style={{ color: '#1A1A1A' }}>{fmtDate(mission.date)}{mission.time ? ` · ${formatHour(mission.time)}` : ''}</p>
          </div>
          <div>
            <p className="text-[11px]" style={{ color: '#A8A09A' }}>Prestation</p>
            <p className="font-semibold" style={{ color: '#1A1A1A' }}>{isDelivery ? 'Livraison' : missionTypeLabel(mission.type)}</p>
          </div>
          <div>
            <p className="text-[11px]" style={{ color: '#A8A09A' }}>Intervenant</p>
            <p className="font-semibold" style={{ color: '#1A1A1A' }}>{mission.cleanerName || 'Non assigné'}</p>
          </div>
        </div>
      </div>

      {/* Compte-rendu de fin de ménage */}
      <h2 className="text-sm font-bold mb-3" style={{ color: '#1A1A1A' }}>Compte-rendu</h2>
      {!isDone && !hasReport ? (
        <div className="rounded-2xl p-6 text-center border mb-5" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
          <p className="text-xs" style={{ color: '#A8A09A' }}>Le compte-rendu sera disponible une fois le ménage terminé.</p>
        </div>
      ) : !hasReport ? (
        <div className="rounded-2xl p-6 text-center border mb-5" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
          <p className="text-xs" style={{ color: '#A8A09A' }}>Aucun compte-rendu particulier pour ce ménage.</p>
        </div>
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
                    <span key={c} className="text-[11px] px-2 py-0.5 rounded-full" style={{ backgroundColor: '#C9A84C15', color: '#A87B1E' }}>{c}</span>
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
      <h2 className="text-sm font-bold mb-3" style={{ color: '#1A1A1A' }}>Photos</h2>
      <MissionPhotos missionId={mission.id} mode="viewer" defaultOpen />
    </div>
  );
}

function ReportBlock({ title, tone = 'plain', children }: { title: string; tone?: 'plain' | 'alert'; children: React.ReactNode }) {
  const border = tone === 'alert' ? '#EAC4BE' : '#E8E4DC';
  const bg = tone === 'alert' ? '#FBECEA' : '#FFFFFF';
  const titleColor = tone === 'alert' ? '#B85A50' : '#7A7068';
  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: border, backgroundColor: bg }}>
      <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: titleColor }}>{title}</p>
      <div className="text-sm leading-snug" style={{ color: '#1A1A1A' }}>{children}</div>
    </div>
  );
}
