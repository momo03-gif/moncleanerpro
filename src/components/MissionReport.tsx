'use client';

import { useState, useEffect, useCallback } from 'react';
import { getMissionReportDB, saveMissionReportDB, reportHasContent } from '@/lib/missionReports';
import { CONSUMABLE_ITEMS, type MissionReport as Report } from '@/lib/types';
import Icon from '@/components/Icon';

// ════════════════════════════════════════════════════════════════════════════
//  Rapport d'état du logement — composant repliable réutilisable.
//    mode="cleaner" → formulaire (le cleaner remplit en fin de mission).
//    mode="viewer"  → lecture seule (admin + partenaire/hôte).
// ════════════════════════════════════════════════════════════════════════════

interface Props {
  missionId: string;
  mode: 'cleaner' | 'viewer';
  userId?: string;
  defaultOpen?: boolean;
  /** Chambres couvertes par le ménage (maison louée à la chambre). Quand elles
   *  sont fournies, le cleaner peut localiser un dégât ou un objet oublié —
   *  « robinet qui fuit » ne dit pas à l'hôte DANS QUELLE chambre. */
  units?: string[];
}

const COMMON_AREAS = 'Communs';

const labelStyle = { color: '#7A7068' };
const cardStyle = { borderColor: '#F2EFE9', backgroundColor: '#FCFBF8' };

export default function MissionReport({ missionId, mode, userId, defaultOpen, units }: Props) {
  const [open, setOpen] = useState(!!defaultOpen);
  const [loaded, setLoaded] = useState(false);
  const [report, setReport] = useState<Report | null>(null);

  // Formulaire (mode cleaner)
  const [consumables, setConsumables] = useState<string[]>([]);
  const [consumablesNote, setConsumablesNote] = useState('');
  const [issues, setIssues] = useState('');
  const [issuesUnit, setIssuesUnit] = useState('');
  const [lostFound, setLostFound] = useState('');
  const [lostFoundUnit, setLostFoundUnit] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  const hydrate = useCallback((r: Report | null) => {
    setReport(r);
    setConsumables(r?.consumables ?? []);
    setConsumablesNote(r?.consumablesNote ?? '');
    setIssues(r?.issues ?? '');
    setIssuesUnit(r?.issuesUnit ?? '');
    setLostFound(r?.lostFound ?? '');
    setLostFoundUnit(r?.lostFoundUnit ?? '');
    setNote(r?.note ?? '');
  }, []);

  useEffect(() => {
    if (!open || loaded) return;
    let active = true;
    (async () => {
      const r = await getMissionReportDB(missionId);
      if (!active) return;
      hydrate(r);
      setLoaded(true);
    })();
    return () => { active = false; };
  }, [open, loaded, missionId, hydrate]);

  function toggleItem(item: string) {
    setConsumables(prev => prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]);
  }

  async function save() {
    setSaving(true);
    setSavedMsg('');
    const r: Report = {
      missionId,
      consumables,
      consumablesNote: consumablesNote.trim() || undefined,
      issues: issues.trim() || undefined,
      issuesUnit: issuesUnit || undefined,
      lostFound: lostFound.trim() || undefined,
      lostFoundUnit: lostFoundUnit || undefined,
      note: note.trim() || undefined,
      submittedBy: userId,
    };
    const res = await saveMissionReportDB(r);
    setSaving(false);
    if (res.error) { setSavedMsg('Erreur : ' + res.error); return; }
    setReport(r);
    setSavedMsg('Rapport enregistré ✓');
    setTimeout(() => setSavedMsg(''), 3000);
  }

  const filled = reportHasContent(report);

  return (
    <div className="rounded-xl border" style={cardStyle}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-2.5 text-left">
        <span className="text-xs font-semibold uppercase tracking-wide flex items-center gap-2" style={labelStyle}>
          Rapport d'état du logement
          {filled && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: '#5A8A6A15', color: '#5A8A6A' }}>rempli</span>}
        </span>
        <span className="transition-transform" style={{ color: '#B0A795', transform: open ? 'rotate(180deg)' : 'none' }}><Icon name="chevronDown" size={15} /></span>
      </button>

      {open && (
        <div className="px-4 pb-4">
          {!loaded ? (
            <p className="text-xs py-2" style={{ color: '#A8A09A' }}>Chargement…</p>
          ) : mode === 'viewer' ? (
            <ViewerBody report={report} />
          ) : (
            <div className="space-y-4">
              {/* Consommables à réapprovisionner */}
              <div>
                <p className="text-xs font-semibold mb-2" style={labelStyle}>À réapprovisionner</p>
                <div className="flex flex-wrap gap-1.5">
                  {CONSUMABLE_ITEMS.map(item => {
                    const on = consumables.includes(item);
                    return (
                      <button key={item} type="button" onClick={() => toggleItem(item)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors"
                        style={{
                          borderColor: on ? '#C9A84C' : '#E8E4DC',
                          backgroundColor: on ? '#C9A84C18' : '#FFFFFF',
                          color: on ? '#9A7B22' : '#7A7068',
                        }}>
                        {item}
                      </button>
                    );
                  })}
                </div>
                <input value={consumablesNote} onChange={e => setConsumablesNote(e.target.value)}
                  placeholder="Autre à réapprovisionner (facultatif)"
                  className="mt-2 w-full px-3 py-2 rounded-lg text-sm border" style={{ borderColor: '#E8E4DC', color: '#1A1A1A' }} />
              </div>

              <FieldArea label="Problème / dégât constaté" value={issues} onChange={setIssues}
                placeholder="Ex. robinet qui fuit, store cassé… (facultatif)">
                <UnitPicker units={units} value={issuesUnit} onChange={setIssuesUnit} show={!!issues.trim()} />
              </FieldArea>
              <FieldArea label="Objet oublié par le client" value={lostFound} onChange={setLostFound}
                placeholder="Ex. chargeur, vêtement… (facultatif)">
                <UnitPicker units={units} value={lostFoundUnit} onChange={setLostFoundUnit} show={!!lostFound.trim()} />
              </FieldArea>
              <FieldArea label="Remarque générale" value={note} onChange={setNote}
                placeholder="Tout ce que l'hôte devrait savoir (facultatif)" />

              <div className="flex items-center gap-3">
                <button onClick={save} disabled={saving}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                  style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
                  {saving ? 'Enregistrement…' : 'Enregistrer le rapport'}
                </button>
                {savedMsg && <span className="text-xs font-medium" style={{ color: savedMsg.startsWith('Erreur') ? '#B85A50' : '#5A8A6A' }}>{savedMsg}</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FieldArea({ label, value, onChange, placeholder, children }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; children?: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold mb-1.5" style={labelStyle}>{label}</p>
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={2}
        className="w-full px-3 py-2 rounded-lg text-sm border resize-none" style={{ borderColor: '#E8E4DC', color: '#1A1A1A' }} />
      {children}
    </div>
  );
}

// Localisation d'un constat, en lecture (admin / hôte).
function UnitTag({ unit }: { unit: string }) {
  return (
    <span className="inline-block mt-1.5 px-2 py-0.5 rounded-md text-xs font-semibold"
      style={{ backgroundColor: '#F5F3EF', color: '#7A7068' }}>
      {unit}
    </span>
  );
}

// Sélecteur « Où ? » — n'apparaît que sur une maison louée à la chambre, ET une
// fois le constat écrit : demander la pièce d'un problème inexistant n'a pas de
// sens et alourdirait le formulaire des logements classiques.
function UnitPicker({ units, value, onChange, show }: { units?: string[]; value: string; onChange: (v: string) => void; show: boolean }) {
  if (!units || units.length === 0 || !show) return null;
  const choices = [...units, COMMON_AREAS];
  return (
    <div className="mt-2">
      <p className="text-[11px] mb-1.5" style={{ color: '#A8A09A' }}>Où ?</p>
      <div className="flex flex-wrap gap-1.5">
        {choices.map(u => {
          const on = value === u;
          return (
            <button key={u} type="button" onClick={() => onChange(on ? '' : u)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors"
              style={{
                borderColor: on ? '#C9A84C' : '#E8E4DC',
                backgroundColor: on ? '#C9A84C18' : '#FFFFFF',
                color: on ? '#9A7B22' : '#7A7068',
              }}>
              {u}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ViewerBody({ report }: { report: Report | null }) {
  if (!reportHasContent(report) || !report) {
    return <p className="text-xs py-2" style={{ color: '#A8A09A' }}>Aucun rapport pour cette mission.</p>;
  }
  return (
    <div className="space-y-3 text-sm" style={{ color: '#4A443D' }}>
      {report.consumables.length > 0 && (
        <Block title="À réapprovisionner" accent="#9A7B22">
          <div className="flex flex-wrap gap-1.5 mt-1">
            {report.consumables.map(c => (
              <span key={c} className="px-2 py-0.5 rounded-md text-xs font-medium" style={{ backgroundColor: '#C9A84C18', color: '#9A7B22' }}>{c}</span>
            ))}
          </div>
          {report.consumablesNote && <p className="mt-1.5">{report.consumablesNote}</p>}
        </Block>
      )}
      {report.issues && <Block title="Problème / dégât" accent="#B85A50"><p>{report.issues}</p>{report.issuesUnit && <UnitTag unit={report.issuesUnit} />}</Block>}
      {report.lostFound && <Block title="Objet oublié" accent="#3E63DD"><p>{report.lostFound}</p>{report.lostFoundUnit && <UnitTag unit={report.lostFoundUnit} />}</Block>}
      {report.note && <Block title="Remarque" accent="#7A7068"><p>{report.note}</p></Block>}
    </div>
  );
}

function Block({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide mb-0.5" style={{ color: accent }}>{title}</p>
      {children}
    </div>
  );
}
