'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getMissionPhotosDB, uploadMissionPhotoDB,
  MAX_PHOTOS_PER_MISSION, PHOTO_RETENTION_DAYS,
} from '@/lib/missionPhotos';
import type { MissionPhoto, MissionPhotoKind } from '@/lib/types';
import Icon from '@/components/Icon';

// ════════════════════════════════════════════════════════════════════════════
//  Photos avant/après d'une mission — composant réutilisable.
//    mode="cleaner" → ajout (avant/après) + consultation, PAS de suppression.
//    mode="viewer"  → consultation seule (admin) : zoom + téléchargement.
//  Les partenaires (hôtel/Airbnb) n'affichent pas ce composant pour l'instant ;
//  le mode "viewer" est prêt à être réutilisé pour eux plus tard.
// ════════════════════════════════════════════════════════════════════════════

interface Props {
  missionId: string;
  mode: 'cleaner' | 'viewer';
  userId?: string;            // requis pour l'upload (cleaner)
  defaultOpen?: boolean;
}

export default function MissionPhotos({ missionId, mode, userId, defaultOpen }: Props) {
  const [photos, setPhotos] = useState<MissionPhoto[]>([]);
  const [open, setOpen] = useState(!!defaultOpen);
  const [loaded, setLoaded] = useState(false);
  const [lightbox, setLightbox] = useState<MissionPhoto | null>(null);

  const load = useCallback(async () => {
    const p = await getMissionPhotosDB(missionId);
    setPhotos(p);
    setLoaded(true);
  }, [missionId]);

  // Chargement paresseux à la première ouverture (setState après await → non synchrone).
  useEffect(() => {
    if (!open || loaded) return;
    let active = true;
    (async () => {
      const p = await getMissionPhotosDB(missionId);
      if (!active) return;
      setPhotos(p);
      setLoaded(true);
    })();
    return () => { active = false; };
  }, [open, loaded, missionId]);

  const before = photos.filter(p => p.kind === 'before');
  const after = photos.filter(p => p.kind === 'after');
  const total = photos.length;

  return (
    <div className="rounded-xl border" style={{ borderColor: '#F2EFE9', backgroundColor: '#FCFBF8' }}>
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left">
        <span className="text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5" style={{ color: '#7A7068' }}>
          <Icon name="camera" size={14} /> Photos {loaded || total ? `(${total})` : ''}
        </span>
        <span className="transition-transform" style={{ color: '#A8A09A', transform: open ? 'rotate(180deg)' : 'none' }}><Icon name="chevronDown" size={15} /></span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {!loaded ? (
            <p className="text-xs" style={{ color: '#A8A09A' }}>Chargement...</p>
          ) : (
            <>
              <PhotoSection
                title="Avant" kind="before" photos={before} mode={mode}
                missionId={missionId} userId={userId} total={total}
                onUploaded={load} onZoom={setLightbox}
              />
              <PhotoSection
                title="Après" kind="after" photos={after} mode={mode}
                missionId={missionId} userId={userId} total={total}
                onUploaded={load} onZoom={setLightbox}
              />
              {mode === 'cleaner' && (
                <p className="text-[11px]" style={{ color: '#B8B0A8' }}>
                  {total}/{MAX_PHOTOS_PER_MISSION} photos · supprimées automatiquement après {PHOTO_RETENTION_DAYS} jours.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {lightbox && <Lightbox photo={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  );
}

// ── Section avant / après ───────────────────────────────────────────────────────
function PhotoSection({ title, kind, photos, mode, missionId, userId, total, onUploaded, onZoom }: {
  title: string; kind: MissionPhotoKind; photos: MissionPhoto[];
  mode: 'cleaner' | 'viewer'; missionId: string; userId?: string; total: number;
  onUploaded: () => void; onZoom: (p: MissionPhoto) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const full = total >= MAX_PHOTOS_PER_MISSION;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = ''; // permet de re-sélectionner le même fichier
    if (files.length === 0 || !userId) return;
    setBusy(true); setError('');
    let remaining = MAX_PHOTOS_PER_MISSION - total;
    for (const file of files) {
      if (remaining <= 0) { setError(`Limite de ${MAX_PHOTOS_PER_MISSION} photos atteinte.`); break; }
      const res = await uploadMissionPhotoDB({ missionId, kind, file, userId });
      if (res.error) { setError(res.error); break; }
      remaining--;
    }
    setBusy(false);
    onUploaded();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#A8A09A' }}>
          {title} {photos.length > 0 && `· ${photos.length}`}
        </p>
        {mode === 'cleaner' && (
          <button onClick={() => inputRef.current?.click()} disabled={busy || full}
            className="text-[11px] font-semibold px-2.5 py-1 rounded-lg disabled:opacity-40"
            style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
            {busy ? '...' : '+ Ajouter'}
          </button>
        )}
      </div>

      {photos.length === 0 ? (
        <p className="text-[11px]" style={{ color: '#C2BBB2' }}>Aucune photo {title.toLowerCase()}.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {photos.map(p => (
            <button key={p.id} onClick={() => onZoom(p)}
              className="relative w-16 h-16 rounded-lg overflow-hidden border"
              style={{ borderColor: '#E8E4DC' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={title} className="w-full h-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-[11px] mt-1" style={{ color: '#B85A50' }}>{error}</p>}

      {mode === 'cleaner' && (
        <input ref={inputRef} type="file" accept="image/*" capture="environment" multiple
          onChange={onPick} className="hidden" />
      )}
    </div>
  );
}

// ── Lightbox : zoom + téléchargement ────────────────────────────────────────────
function Lightbox({ photo, onClose }: { photo: MissionPhoto; onClose: () => void }) {
  const [zoom, setZoom] = useState(false);
  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ backgroundColor: 'rgba(20,18,16,0.92)' }}
      onClick={onClose}>
      <div className="flex items-center justify-between px-4 py-3" onClick={e => e.stopPropagation()}>
        <span className="text-xs font-medium px-2.5 py-1 rounded-full"
          style={{ backgroundColor: photo.kind === 'before' ? '#B85A5030' : '#5A8A6A30', color: '#FFFFFF' }}>
          {photo.kind === 'before' ? 'Avant' : 'Après'}
        </span>
        <div className="flex items-center gap-2">
          <a href={photo.url} download target="_blank" rel="noopener noreferrer"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg"
            style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
            ⤓ Télécharger
          </a>
          <button onClick={onClose} className="text-xs font-semibold px-3 py-1.5 rounded-lg"
            style={{ backgroundColor: '#FFFFFF20', color: '#FFFFFF' }}>✕ Fermer</button>
        </div>
      </div>
      <div className="flex-1 overflow-auto flex items-center justify-center p-4"
        onClick={e => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.url} alt={photo.kind}
          onClick={() => setZoom(z => !z)}
          className="rounded-lg transition-transform origin-center"
          style={{
            maxWidth: zoom ? 'none' : '100%',
            maxHeight: zoom ? 'none' : '100%',
            width: zoom ? '200%' : 'auto',
            cursor: zoom ? 'zoom-out' : 'zoom-in',
          }} />
      </div>
    </div>
  );
}
