'use client';

// ════════════════════════════════════════════════════════════════════════════
//  Checklist de ménage — un seul composant, trois usages.
//    mode="edit"   → la conciergerie (ou l'admin) définit le standard DU LOGEMENT.
//    mode="run"    → le cleaner coche pendant le ménage (sur une mission).
//    mode="viewer" → la conciergerie lit la preuve : conformité + heure de chaque point.
//
//  Le standard vit sur le logement et sert à tous ses ménages ; l'exécution vit
//  sur la mission. Voir lib/checklists.ts.
// ════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef, type ChangeEvent } from 'react';
import {
  getChecklistForApartmentDB, getMissionChecklistDB, addChecklistItemDB,
  updateChecklistItemDB, archiveChecklistItemDB, reorderChecklistDB,
  checkChecklistItemDB, uncheckChecklistItemDB, seedStarterChecklistDB,
  uploadChecklistPhotoDB, checklistProgress, groupByRoom, STARTER_CHECKLIST,
} from '@/lib/checklists';
import Icon from '@/components/Icon';
import { useFeedback } from '@/contexts/FeedbackContext';
import type { MissionChecklistLine } from '@/lib/types';

interface Props {
  airbnbId: string;
  /** Requis en mode "run" et "viewer" : la mission sur laquelle on coche/lit. */
  missionId?: string;
  mode: 'edit' | 'run' | 'viewer';
  /** Nom enregistré à côté de chaque point coché (mode "run"). */
  authorName?: string;
  /** En mode "run", empêche de cocher (mission verrouillée/terminée côté admin). */
  readOnly?: boolean;
  /**
   * Affiche l'heure à laquelle chaque point a été coché. RÉSERVÉ À L'INTERNE
   * (admin, et l'intervenant sur sa propre mission) : la suite des horodatages
   * revient à donner la durée du ménage, qui ne regarde pas le client.
   */
  showTimes?: boolean;
  defaultOpen?: boolean;
}

const ROOM_SUGGESTIONS = ['Général', 'Cuisine', 'Salle de bain', 'Chambre', 'Salon', 'Extérieur', 'Finitions'];

export default function ChecklistPanel({ airbnbId, missionId, mode, authorName, readOnly, showTimes, defaultOpen }: Props) {
  const { toast, confirm } = useFeedback();
  const [open, setOpen] = useState(!!defaultOpen);
  const [loaded, setLoaded] = useState(false);
  const [lines, setLines] = useState<MissionChecklistLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [room, setRoom] = useState('Général');
  const [required, setRequired] = useState(true);
  // Point visé par le sélecteur de fichier (un seul input pour toute la liste).
  const photoTargetRef = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (mode === 'edit' || !missionId) {
      const items = await getChecklistForApartmentDB(airbnbId);
      setLines(items.map(item => ({ item })));
    } else {
      setLines(await getMissionChecklistDB(missionId, airbnbId));
    }
    setLoaded(true);
  }, [airbnbId, missionId, mode]);

  useEffect(() => { if (open && !loaded) load(); }, [open, loaded, load]);

  const progress = checklistProgress(lines);
  const groups = groupByRoom(lines);

  // ── Édition du standard ────────────────────────────────────────────────────

  async function add() {
    if (!label.trim()) return;
    setBusy(true);
    const res = await addChecklistItemDB(airbnbId, { label, room, required, createdBy: authorName });
    setBusy(false);
    if (res.error) { toast(res.error, 'error'); return; }
    setLabel(''); setAdding(false);
    await load();
  }

  async function seed() {
    setBusy(true);
    const res = await seedStarterChecklistDB(airbnbId, authorName);
    setBusy(false);
    if (res.error) { toast(res.error, 'error'); return; }
    toast('Checklist de départ installée — ajustez-la à votre standard.', 'success');
    await load();
  }

  async function remove(itemId: string, itemLabel: string) {
    const ok = await confirm({
      title: 'Retirer ce point ?',
      message: `« ${itemLabel} » ne sera plus demandé aux prochains ménages. Les ménages déjà faits gardent leur historique.`,
      confirmLabel: 'Retirer', danger: true,
    });
    if (!ok) return;
    setBusy(true);
    await archiveChecklistItemDB(itemId);
    setBusy(false);
    await load();
  }

  async function toggleRequired(itemId: string, next: boolean) {
    setBusy(true);
    await updateChecklistItemDB(itemId, { required: next });
    setBusy(false);
    await load();
  }

  // Photo modèle d'un point : « voilà à quoi ça doit ressembler ». C'est ce que
  // Properly et Breezeway font de mieux — une photo remplace trois consignes.
  async function pickPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const itemId = photoTargetRef.current;
    e.target.value = '';
    if (!file || !itemId) return;
    setBusy(true);
    const res = await uploadChecklistPhotoDB(airbnbId, itemId, file);
    setBusy(false);
    if (res.error) { toast('Envoi de la photo impossible.', 'error'); return; }
    await load();
  }

  async function removePhoto(itemId: string) {
    setBusy(true);
    await updateChecklistItemDB(itemId, { referencePhotoUrl: null });
    setBusy(false);
    await load();
  }

  async function move(index: number, delta: number) {
    const ordered = [...lines].sort((a, b) => a.item.position - b.item.position);
    const target = index + delta;
    if (target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    setLines(ordered.map((l, i) => ({ ...l, item: { ...l.item, position: i } })));
    setBusy(true);
    await reorderChecklistDB(ordered.map(l => l.item.id));
    setBusy(false);
    await load();
  }

  // ── Exécution (cleaner) ────────────────────────────────────────────────────

  async function toggleCheck(line: MissionChecklistLine) {
    if (!missionId || readOnly) return;
    const wasChecked = !!line.check;
    // Optimiste : cocher doit répondre au doigt, pas au réseau.
    setLines(ls => ls.map(l => l.item.id === line.item.id
      ? { ...l, check: wasChecked ? undefined : { missionId, itemId: l.item.id, labelSnapshot: l.item.label, checkedAt: new Date().toISOString(), checkedBy: authorName } }
      : l));
    const res = wasChecked
      ? await uncheckChecklistItemDB(missionId, line.item.id)
      : await checkChecklistItemDB(missionId, line.item, authorName);
    if (res.error) { toast('Enregistrement impossible — vérifiez votre connexion.', 'error'); await load(); }
  }

  // ── Rendu ──────────────────────────────────────────────────────────────────

  const title = mode === 'edit' ? 'Standard de ménage' : 'Checklist';
  const ordered = [...lines].sort((a, b) => a.item.position - b.item.position);

  return (
    <div className="rounded-xl border border-line bg-surface">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-2.5 text-left">
        <span className="text-xs font-semibold uppercase tracking-wide flex items-center gap-2 text-muted">
          {title}
          {loaded && lines.length > 0 && mode !== 'edit' && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${progress.complete ? 'bg-success-soft text-success' : 'bg-warn-soft text-warn'}`}>
              {progress.done}/{progress.total}
            </span>
          )}
          {loaded && mode === 'edit' && lines.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gold-soft text-gold-ink">
              {lines.length} point{lines.length > 1 ? 's' : ''}
            </span>
          )}
        </span>
        <span className={`text-faint transition-transform ${open ? 'rotate-180' : ''}`}><Icon name="chevronDown" size={15} /></span>
      </button>

      {/* Un seul sélecteur de fichier pour toute la liste (mode édition). */}
      <input ref={fileRef} type="file" accept="image/*" onChange={pickPhoto} className="hidden" />

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {!loaded ? (
            <p className="text-xs py-2 text-faint">Chargement…</p>
          ) : lines.length === 0 ? (
            <EmptyChecklist mode={mode} busy={busy} onSeed={seed} />
          ) : (
            <>
              {/* Barre de conformité (exécution et preuve) */}
              {mode !== 'edit' && (
                <div>
                  <div className="h-1.5 rounded-full overflow-hidden bg-surface-2">
                    <div className={`h-full transition-all ${progress.complete ? 'bg-success' : 'bg-gold'}`} style={{ width: `${progress.percent}%` }} />
                  </div>
                  <p className="text-[11px] mt-1.5 text-muted">
                    {progress.complete
                      ? `Standard respecté — ${progress.total} point${progress.total > 1 ? 's' : ''} sur ${progress.total}`
                      : `${progress.done} point${progress.done > 1 ? 's' : ''} sur ${progress.total}`}
                    {progress.extras > 0 ? ` · ${progress.extras} point${progress.extras > 1 ? 's' : ''} facultatif${progress.extras > 1 ? 's' : ''} en plus` : ''}
                  </p>
                </div>
              )}

              {groups.map(group => (
                <div key={group.room}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 text-faint">{group.room}</p>
                  <div className="space-y-1.5">
                    {group.lines.map(line => (
                      <ChecklistRow
                        key={line.item.id}
                        line={line}
                        mode={mode}
                        busy={busy}
                        readOnly={readOnly}
                        showTimes={showTimes}
                        onToggle={() => toggleCheck(line)}
                        onRemove={() => remove(line.item.id, line.item.label)}
                        onToggleRequired={() => toggleRequired(line.item.id, !line.item.required)}
                        onUp={() => move(ordered.findIndex(l => l.item.id === line.item.id), -1)}
                        onDown={() => move(ordered.findIndex(l => l.item.id === line.item.id), 1)}
                        onPickPhoto={() => { photoTargetRef.current = line.item.id; fileRef.current?.click(); }}
                        onRemovePhoto={() => removePhoto(line.item.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Ajout d'un point au standard */}
          {mode === 'edit' && (adding ? (
            <div className="rounded-xl p-3 space-y-2.5 bg-surface-2">
              <input value={label} onChange={e => setLabel(e.target.value)} autoFocus
                placeholder="Ex. Détartrer le rideau de douche"
                className="w-full px-3 py-2 rounded-lg text-sm border border-line bg-card text-ink" />
              <div className="flex flex-wrap gap-1.5">
                {ROOM_SUGGESTIONS.map(r => (
                  <button key={r} type="button" onClick={() => setRoom(r)}
                    className={`text-[11px] px-2.5 py-1 rounded-full border ${room === r ? 'border-gold bg-gold-soft text-gold-ink font-semibold' : 'border-line text-muted'}`}>
                    {r}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-[11px] text-muted">
                <input type="checkbox" checked={required} onChange={e => setRequired(e.target.checked)} />
                Point essentiel (compte dans la conformité)
              </label>
              <div className="flex gap-2">
                <button onClick={add} disabled={busy || !label.trim()}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-gold text-ink disabled:opacity-50">
                  {busy ? '…' : 'Ajouter au standard'}
                </button>
                <button onClick={() => { setAdding(false); setLabel(''); }} disabled={busy}
                  className="px-4 py-2.5 rounded-xl text-xs border border-line text-muted">Annuler</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAdding(true)}
              className="w-full py-2.5 rounded-xl text-xs font-semibold border border-line text-muted">
              + Ajouter un point
            </button>
          ))}

          {mode === 'edit' && lines.length > 0 && (
            <p className="text-[11px] text-faint">
              Ce standard est demandé à chaque ménage de ce logement. L&apos;intervenant coche au fur et à mesure ; vous voyez le détail sur la fiche du ménage.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyChecklist({ mode, busy, onSeed }: { mode: Props['mode']; busy: boolean; onSeed: () => void }) {
  if (mode === 'edit') {
    return (
      <div className="rounded-xl p-3 bg-surface-2">
        <p className="text-xs mb-2 text-muted">
          Aucun standard défini. Vous pouvez partir d&apos;une base de {STARTER_CHECKLIST.length} points (ménage de location courte durée) et l&apos;ajuster.
        </p>
        <button onClick={onSeed} disabled={busy}
          className="w-full py-2.5 rounded-xl text-xs font-semibold bg-gold text-ink disabled:opacity-50">
          {busy ? '…' : 'Partir du modèle type'}
        </button>
      </div>
    );
  }
  return <p className="text-xs text-faint">Aucun standard de ménage défini pour ce logement.</p>;
}

function ChecklistRow({ line, mode, busy, readOnly, showTimes, onToggle, onRemove, onToggleRequired, onUp, onDown, onPickPhoto, onRemovePhoto }: {
  line: MissionChecklistLine;
  mode: Props['mode'];
  busy: boolean;
  readOnly?: boolean;
  showTimes?: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onToggleRequired: () => void;
  onUp: () => void;
  onDown: () => void;
  onPickPhoto: () => void;
  onRemovePhoto: () => void;
}) {
  const checked = !!line.check;
  // L'horodatage n'est affiché qu'en interne : enchaînés, les horaires des points
  // donneraient la durée du ménage, qui ne regarde pas le client.
  const checkedTime = showTimes && line.check?.checkedAt
    ? new Date(line.check.checkedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : null;

  // ── Standard (édition) ──────────────────────────────────────────────────────
  if (mode === 'edit') {
    return (
      <div className="rounded-xl border border-line bg-card px-3 py-2 flex items-center gap-2">
        {/* Photo modèle : ajouter, remplacer, retirer. */}
        <button onClick={onPickPhoto} disabled={busy} aria-label={line.item.referencePhotoUrl ? 'Remplacer la photo modèle' : 'Ajouter une photo modèle'}
          className="shrink-0">
          {line.item.referencePhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={line.item.referencePhotoUrl} alt="" className="w-9 h-9 rounded-lg object-cover border border-line" />
          ) : (
            <span className="w-9 h-9 rounded-lg border border-dashed border-line flex items-center justify-center text-faint">
              <Icon name="camera" size={14} />
            </span>
          )}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm leading-snug text-ink">{line.item.label}</p>
          <p className="text-[10px] text-faint">
            {!line.item.required && 'facultatif'}
            {!line.item.required && line.item.referencePhotoUrl && ' · '}
            {line.item.referencePhotoUrl && (
              <button onClick={onRemovePhoto} disabled={busy} className="underline">retirer la photo</button>
            )}
          </p>
        </div>
        <button onClick={onToggleRequired} disabled={busy} aria-label={line.item.required ? 'Rendre facultatif' : 'Rendre essentiel'}
          className={`text-[10px] px-2 py-1 rounded-full font-bold shrink-0 ${line.item.required ? 'bg-gold-soft text-gold-ink' : 'bg-surface-2 text-faint'}`}>
          {line.item.required ? 'essentiel' : 'option'}
        </button>
        <div className="flex flex-col shrink-0">
          <button onClick={onUp} disabled={busy} aria-label="Monter" className="text-faint px-1"><Icon name="arrowUp" size={12} /></button>
          <button onClick={onDown} disabled={busy} aria-label="Descendre" className="text-faint px-1"><Icon name="arrowDown" size={12} /></button>
        </div>
        <button onClick={onRemove} disabled={busy} aria-label="Retirer ce point" className="text-danger px-1 shrink-0">
          <Icon name="close" size={14} />
        </button>
      </div>
    );
  }

  // ── Exécution / preuve ──────────────────────────────────────────────────────
  // La ligne est un conteneur neutre : la case à cocher et la photo modèle sont
  // deux commandes distinctes (un lien imbriqué dans un bouton serait invalide).
  const interactive = mode === 'run' && !readOnly;
  return (
    <div className={`w-full rounded-xl border px-3 py-2.5 flex items-center gap-3 ${checked ? 'border-success-line bg-success-soft' : 'border-line bg-card'}`}>
      <button type="button" onClick={onToggle} disabled={!interactive}
        aria-pressed={checked}
        className={`flex-1 min-w-0 flex items-center gap-3 text-left ${interactive ? 'active:scale-[0.99] transition-transform' : ''}`}>
        <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${checked ? 'bg-success border-success text-white' : 'border-line text-transparent'}`}>
          <Icon name="check" size={12} />
        </span>
        <span className="flex-1 min-w-0">
          <span className={`block text-sm leading-snug ${checked ? 'text-muted line-through' : 'text-ink'}`}>{line.item.label}</span>
          {checked && (
            <span className="block text-[10px] text-success">
              {checkedTime ? `fait à ${checkedTime}` : 'fait'}
              {line.check?.checkedBy ? ` · ${line.check.checkedBy}` : ''}
            </span>
          )}
          {!checked && !line.item.required && <span className="block text-[10px] text-faint">facultatif</span>}
        </span>
      </button>

      {/* Photo modèle : ce que le résultat doit donner. Ouverte en grand au tap. */}
      {line.item.referencePhotoUrl && (
        <a href={line.item.referencePhotoUrl} target="_blank" rel="noopener noreferrer"
          className="shrink-0" aria-label="Voir la photo modèle">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={line.item.referencePhotoUrl} alt="" className="w-9 h-9 rounded-lg object-cover border border-line" />
        </a>
      )}
    </div>
  );
}
