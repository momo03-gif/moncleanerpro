'use client';

import { useState, useRef } from 'react';
import { uploadSiteVideoDB, removeSiteVideoDB, MAX_VIDEO_MB } from '@/lib/siteVideos';
import { useFeedback } from '@/contexts/FeedbackContext';
import Icon from '@/components/Icon';

// ════════════════════════════════════════════════════════════════════════════
//  Vidéo d'accès d'un logement — composant réutilisable.
//   mode="manage" (admin / partenaire) : ajouter, remplacer, supprimer, aperçu.
//   mode="view"   (cleaner) : lecture SEULE, chargée À LA DEMANDE (le fichier
//                 n'est téléchargé que si l'utilisateur clique « Voir la vidéo »)
//                 → aucune bande passante consommée tant qu'on ne la regarde pas.
// ════════════════════════════════════════════════════════════════════════════

interface Props {
  airbnbId: string;
  videoUrl?: string | null;
  mode: 'manage' | 'view';
  onChange?: (url: string | null) => void;   // notifie le parent (rafraîchir l'état)
}

export default function SiteAccessVideo({ airbnbId, videoUrl, mode, onChange }: Props) {
  const { confirm, toast } = useFeedback();
  const [url, setUrl] = useState<string | null>(videoUrl ?? null);
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);  // vue cleaner : monte le lecteur au clic
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';  // permet de re-sélectionner le même fichier plus tard
    if (!file) return;
    setBusy(true);
    const res = await uploadSiteVideoDB(airbnbId, file);
    setBusy(false);
    if (res.error) { toast(res.error, 'error'); return; }
    setUrl(res.url ?? null);
    onChange?.(res.url ?? null);
    toast('Vidéo d’accès enregistrée.', 'success');
  }

  async function remove() {
    const ok = await confirm({ title: 'Supprimer la vidéo d’accès ?', message: 'Le cleaner ne la verra plus. Vous pourrez en remettre une à tout moment.', confirmLabel: 'Supprimer', danger: true });
    if (!ok) return;
    setBusy(true);
    const res = await removeSiteVideoDB(airbnbId);
    setBusy(false);
    if (res.error) { toast(res.error, 'error'); return; }
    setUrl(null); setPlaying(false);
    onChange?.(null);
    toast('Vidéo supprimée.', 'success');
  }

  // ── Vue cleaner : lecture à la demande ──
  if (mode === 'view') {
    if (!url) return null;
    return (
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#5B6EF530', backgroundColor: '#5B6EF508' }}>
        {!playing ? (
          <button onClick={() => setPlaying(true)}
            className="w-full flex items-center gap-2.5 px-4 py-3 text-left"
            style={{ color: '#3E63DD' }}>
            <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#5B6EF518' }}>
              <Icon name="play" size={15} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold">Voir la vidéo d’accès</span>
              <span className="block text-xs" style={{ color: '#7A7068' }}>Comment s’y rendre, où trouver la clé</span>
            </span>
          </button>
        ) : (
          <div className="p-2">
            {/* preload="none" + montage au clic : rien n'est téléchargé avant. */}
            <video src={url} controls autoPlay playsInline preload="none"
              className="w-full rounded-lg" style={{ maxHeight: 340, backgroundColor: '#000' }} />
          </div>
        )}
      </div>
    );
  }

  // ── Vue gestion (admin / partenaire) ──
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: '#F2EFE9', backgroundColor: '#FCFBF8' }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5" style={{ color: '#7A7068' }}>
          <Icon name="play" size={13} /> Vidéo d’accès
          {url && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: '#5A8A6A15', color: '#5A8A6A' }}>ajoutée</span>}
        </p>
      </div>

      {url ? (
        <div className="space-y-2">
          <video src={url} controls playsInline preload="none"
            className="w-full rounded-lg" style={{ maxHeight: 260, backgroundColor: '#000' }} />
          <div className="flex gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
              className="flex-1 py-2 rounded-lg text-xs font-semibold border disabled:opacity-50"
              style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>
              {busy ? '…' : 'Remplacer'}
            </button>
            <button type="button" onClick={remove} disabled={busy}
              className="px-4 py-2 rounded-lg text-xs font-semibold border disabled:opacity-50"
              style={{ borderColor: '#E8E4DC', color: '#B85A50' }}>
              Supprimer
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
          className="w-full py-2.5 rounded-lg text-xs font-semibold border disabled:opacity-50"
          style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>
          {busy ? 'Envoi…' : '+ Ajouter une vidéo d’accès'}
        </button>
      )}

      <p className="text-[11px] mt-2" style={{ color: '#A8A09A' }}>
        Filmez court (max {MAX_VIDEO_MB} Mo) : l’accès au logement, où trouver la clé, comment entrer.
      </p>

      <input ref={fileRef} type="file" accept="video/*" onChange={onPick} className="hidden" />
    </div>
  );
}
