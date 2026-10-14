'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getMissionPhotosDB, uploadMissionPhotoDB, deleteMissionPhotoDB, PHOTO_RETENTION_DAYS } from '@/lib/missionPhotos';
import { maxPhotos } from '@/lib/photosRegles';
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
  /** Le cleaner a voulu terminer sans photo « après » : on l'invite à en prendre. */
  exigeApres?: boolean;
  /** Ménage non terminé : le cleaner peut retirer une photo ratée. */
  modifiable?: boolean;
}

export default function MissionPhotos({ missionId, mode, userId, defaultOpen, exigeApres, modifiable }: Props) {
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
    <div className="rounded-xl border" style={{ borderColor: exigeApres && after.length === 0 ? '#B85A50' : '#F2EFE9', backgroundColor: '#FCFBF8' }}>
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
              {mode === 'cleaner' && exigeApres && after.length === 0 && (
                <p className="text-xs px-3 py-2 rounded-lg font-semibold" style={{ backgroundColor: '#B85A5012', color: '#B85A50' }}>
                  Prenez au moins une photo « après » pour terminer le ménage : c’est la preuve du travail rendu.
                </p>
              )}
              <PhotoSection
                title="Après" kind="after" photos={after} mode={mode}
                missionId={missionId} userId={userId}
                onUploaded={load} onZoom={setLightbox} enAvant={!!exigeApres && after.length === 0} modifiable={modifiable}
              />
              <PhotoSection
                title="Avant" kind="before" photos={before} mode={mode}
                missionId={missionId} userId={userId}
                onUploaded={load} onZoom={setLightbox} modifiable={modifiable}
              />
              {mode === 'cleaner' && (
                <p className="text-[11px]" style={{ color: '#B8B0A8' }}>
                  Photo « après » obligatoire pour terminer · conservées {PHOTO_RETENTION_DAYS} jours.
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
//
// Prise de photo pensée pour le terrain :
//   · deux gestes clairs — « Appareil photo » (ouvre la caméra arrière) et
//     « Galerie » (plusieurs photos déjà prises d'un coup) ; l'ancien bouton
//     forçait la caméra et empêchait de choisir une photo existante ;
//   · aperçu IMMÉDIAT de chaque photo, avec sa progression, sans attendre la fin
//     de l'envoi ; deux envois à la fois ;
//   · un envoi raté reste affiché avec « Réessayer » — rien ne se perd en silence ;
//   · une photo ratée se supprime tant que le ménage n'est pas terminé.
type Envoi = { cle: string; apercu: string; fichier: File; etat: 'envoi' | 'erreur'; message?: string };

function PhotoSection({ title, kind, photos, mode, missionId, userId, onUploaded, onZoom, enAvant, modifiable }: {
  title: string; kind: MissionPhotoKind; photos: MissionPhoto[];
  mode: 'cleaner' | 'viewer'; missionId: string; userId?: string;
  onUploaded: () => void; onZoom: (p: MissionPhoto) => void;
  /** Mise en avant quand la photo est exigée et absente. */
  enAvant?: boolean;
  /** Le cleaner peut encore retirer une photo ratée (ménage non terminé). */
  modifiable?: boolean;
}) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galerieRef = useRef<HTMLInputElement>(null);
  const [envois, setEnvois] = useState<Envoi[]>([]);
  const [error, setError] = useState('');
  const [suppression, setSuppression] = useState<string | null>(null);
  const apercus = useRef<string[]>([]);
  const limite = maxPhotos(kind);
  const enCours = envois.filter(x => x.etat === 'envoi').length;
  const place = limite - photos.length - envois.length;

  // Libère les aperçus locaux au démontage.
  useEffect(() => () => { apercus.current.forEach(u => URL.revokeObjectURL(u)); }, []);

  async function envoyer(x: Envoi) {
    const res = await uploadMissionPhotoDB({ missionId, kind, file: x.fichier, userId });
    if (res.error) {
      setEnvois(l => l.map(y => (y.cle === x.cle ? { ...y, etat: 'erreur', message: res.error ?? undefined } : y)));
      return;
    }
    setEnvois(l => l.filter(y => y.cle !== x.cle));
    onUploaded();
  }

  async function ajouter(e: React.ChangeEvent<HTMLInputElement>) {
    const fichiers = Array.from(e.target.files ?? []).filter(f => f.type.startsWith('image/'));
    e.target.value = ''; // permet de reprendre le même fichier
    if (fichiers.length === 0 || !userId) return;
    setError('');
    const retenus = fichiers.slice(0, Math.max(0, place));
    if (fichiers.length > retenus.length) {
      setError(`Limite de ${limite} photos « ${title.toLowerCase()} » : ${fichiers.length - retenus.length} non ajoutée(s).`);
    }
    const nouveaux: Envoi[] = retenus.map((f, i) => {
      const apercu = URL.createObjectURL(f);
      apercus.current.push(apercu);
      return { cle: `${Date.now()}-${i}-${f.name}`, apercu, fichier: f, etat: 'envoi' };
    });
    setEnvois(l => [...l, ...nouveaux]);
    // Deux envois à la fois : plus rapide, sans saturer un réseau mobile faible.
    const attente = [...nouveaux];
    await Promise.all([0, 1].map(async () => {
      for (let x = attente.shift(); x; x = attente.shift()) await envoyer(x);
    }));
  }

  function reessayer(x: Envoi) {
    setEnvois(l => l.map(y => (y.cle === x.cle ? { ...y, etat: 'envoi', message: undefined } : y)));
    envoyer({ ...x, etat: 'envoi' });
  }

  function abandonner(x: Envoi) {
    setEnvois(l => l.filter(y => y.cle !== x.cle));
  }

  async function supprimer(p: MissionPhoto) {
    setSuppression(p.id); setError('');
    const res = await deleteMissionPhotoDB(p.id);
    setSuppression(null);
    if (res.error) { setError(res.error); return; }
    onUploaded();
  }

  const peutAjouter = mode === 'cleaner' && place > 0;
  const rien = photos.length === 0 && envois.length === 0;
  const echec = envois.find(x => x.etat === 'erreur');

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: enAvant ? '#B85A50' : '#A8A09A' }}>
        {title} · {photos.length}/{limite}{enCours > 0 ? ` · envoi de ${enCours}…` : ''}
      </p>

      {rien && mode === 'viewer' && (
        <p className="text-[11px]" style={{ color: '#C2BBB2' }}>Aucune photo {title.toLowerCase()}.</p>
      )}

      {!rien && (
        <div className="grid grid-cols-3 gap-2 mb-2">
          {photos.map(p => (
            <div key={p.id} className="relative aspect-square rounded-xl overflow-hidden border" style={{ borderColor: '#E8E4DC' }}>
              <button onClick={() => onZoom(p)} className="w-full h-full" aria-label={`Agrandir la photo ${title.toLowerCase()}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={title} className="w-full h-full object-cover" loading="lazy" />
              </button>
              {mode === 'cleaner' && modifiable && (
                <button onClick={() => supprimer(p)} disabled={suppression === p.id} aria-label="Supprimer cette photo"
                  className="absolute top-1 right-1 w-7 h-7 rounded-full flex items-center justify-center disabled:opacity-50"
                  style={{ backgroundColor: 'rgba(20,18,16,0.6)', color: '#FFFFFF' }}>
                  <Icon name="trash" size={14} />
                </button>
              )}
            </div>
          ))}
          {envois.map(x => (
            <div key={x.cle} className="relative aspect-square rounded-xl overflow-hidden border"
              style={{ borderColor: x.etat === 'erreur' ? '#B85A50' : '#E8E4DC' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={x.apercu} alt="" className="w-full h-full object-cover" style={{ opacity: 0.55 }} />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-1 text-center">
                {x.etat === 'envoi' ? (
                  <span className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: '#FFFFFF', borderTopColor: 'transparent' }} />
                ) : (
                  <>
                    <button onClick={() => reessayer(x)} className="text-[11px] font-semibold px-2 py-1 rounded-lg"
                      style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>Réessayer</button>
                    <button onClick={() => abandonner(x)} className="text-[10px] font-medium" style={{ color: '#FFFFFF' }}>Retirer</button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {peutAjouter && (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => cameraRef.current?.click()}
            className={`rounded-xl text-sm font-semibold flex items-center justify-center gap-2 ${enAvant || rien ? 'py-3' : 'py-2'}`}
            style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
            <Icon name="camera" size={16} /> Appareil photo
          </button>
          <button onClick={() => galerieRef.current?.click()}
            className={`rounded-xl text-sm font-semibold flex items-center justify-center gap-2 border ${enAvant || rien ? 'py-3' : 'py-2'}`}
            style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC', color: '#1A1A1A' }}>
            <Icon name="image" size={16} /> Galerie
          </button>
        </div>
      )}

      {error && <p className="text-[11px] mt-1.5" style={{ color: '#B85A50' }}>{error}</p>}
      {echec && (
        <p className="text-[11px] mt-1.5" style={{ color: '#B85A50' }}>
          {echec.message ?? 'Envoi impossible.'} Vérifiez le réseau puis « Réessayer ».
        </p>
      )}

      {mode === 'cleaner' && (
        <>
          {/* Caméra arrière directement. */}
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={ajouter} className="hidden" />
          {/* Galerie : sans « capture », plusieurs photos d'un coup. */}
          <input ref={galerieRef} type="file" accept="image/*" multiple onChange={ajouter} className="hidden" />
        </>
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
