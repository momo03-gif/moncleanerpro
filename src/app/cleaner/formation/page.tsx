'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getCleanerByUserId } from '@/lib/db';
import {
  getCategoriesDB, getFormationsDB, getAssignmentsForCleanerDB, completeAssignmentDB,
  type FormationCategory, type Formation, type FormationAssignment,
} from '@/lib/formation';
import Icon, { type IconName } from '@/components/Icon';
import Loading from "@/components/Loading";

// Convertit une URL YouTube/Vimeo en URL d'intégration (lecteur iframe).
function embedUrl(url?: string): string {
  if (!url) return '';
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return url;
}

const safeIcon = (s?: string): IconName => (s === 'book' || s === 'play' || s === 'today' || s === 'building' ? s : 'book');

export default function CleanerFormationPage() {
  const { user } = useAuth();
  const [cleanerId, setCleanerId] = useState<string | null>(null);
  const [categories, setCategories] = useState<FormationCategory[]>([]);
  const [formations, setFormations] = useState<Formation[]>([]);
  const [assignments, setAssignments] = useState<FormationAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [video, setVideo] = useState<Formation | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const cleaner = await getCleanerByUserId(user.id);
    const cid = cleaner?.id ?? null;
    setCleanerId(cid);
    const [cats, forms, assigns] = await Promise.all([
      getCategoriesDB(), getFormationsDB(),
      cid ? getAssignmentsForCleanerDB(cid) : Promise.resolve([]),
    ]);
    setCategories(cats); setFormations(forms); setAssignments(assigns);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function complete(a: FormationAssignment) {
    await completeAssignmentDB(a.id);
    await load();
  }

  if (!user) return null;
  if (loading) return <Loading className="p-5 pt-8 text-sm" />;

  const todo = assignments.filter(a => a.statut === 'a_faire');
  const formationsOf = (catId: string) => formations.filter(f => f.categorieId === catId);
  const labelForAssignment = (a: FormationAssignment) => {
    if (a.formationId) return formations.find(f => f.id === a.formationId)?.titre ?? 'Formation';
    return categories.find(c => c.id === a.categorieId)?.titre ?? 'Catégorie';
  };

  return (
    <div className="p-5">
      <div className="mb-5 pt-2">
        <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Formation</h1>
        <p className="text-sm mt-1" style={{ color: '#A8A09A' }}>Apprends les bons gestes, à ton rythme.</p>
      </div>

      {/* Formations imposées (en haut, avec badge) */}
      {todo.length > 0 && (
        <div className="rounded-2xl border mb-5 overflow-hidden" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          <div className="px-5 py-3 border-b" style={{ borderColor: '#F2EFE9', backgroundColor: '#FAFAF8' }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#C48A2A' }}>À faire</p>
          </div>
          {todo.map((a, i) => (
            <div key={a.id} className={`px-5 py-4 flex items-center justify-between gap-3 ${i < todo.length - 1 ? 'border-b' : ''}`} style={{ borderColor: '#F2EFE9' }}>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: '#1A1A1A' }}>{labelForAssignment(a)}</p>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: a.obligatoire ? '#B85A5015' : '#C9A84C15', color: a.obligatoire ? '#B85A50' : '#C48A2A' }}>
                  {a.obligatoire ? 'Obligatoire' : 'Recommandée'}
                </span>
              </div>
              <button onClick={() => complete(a)} className="shrink-0 px-4 py-2 rounded-xl text-xs font-semibold" style={{ backgroundColor: '#5A8A6A', color: '#FFFFFF' }}>
                J’ai terminé
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Catégories → vidéos */}
      <div className="space-y-3">
        {categories.length === 0 && (
          <div className="rounded-2xl p-10 text-center border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF', color: '#A8A09A' }}>
            <p className="text-sm">Aucune formation pour le moment</p>
          </div>
        )}
        {categories.map(cat => {
          const vids = formationsOf(cat.id);
          const isOpen = openCat === cat.id;
          return (
            <div key={cat.id} className="rounded-2xl border overflow-hidden" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
              <button onClick={() => setOpenCat(isOpen ? null : cat.id)} className="w-full px-5 py-4 flex items-center gap-3 text-left">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#C9A84C15', color: '#C9A84C' }}>
                  <Icon name={safeIcon(cat.icone)} size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold" style={{ color: '#1A1A1A' }}>{cat.titre}</p>
                  <p className="text-xs" style={{ color: '#A8A09A' }}>{vids.length} vidéo{vids.length > 1 ? 's' : ''}</p>
                </div>
                <Icon name={isOpen ? 'close' : 'plus'} size={16} />
              </button>
              {isOpen && (
                <div className="px-5 pb-4 space-y-2">
                  {vids.length === 0 && <p className="text-xs" style={{ color: '#A8A09A' }}>Aucune vidéo dans ce thème.</p>}
                  {vids.map(v => (
                    <button key={v.id} onClick={() => setVideo(v)} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all" style={{ backgroundColor: '#F8F6F2' }}>
                      <Icon name="play" size={16} />
                      <span className="flex-1 text-sm font-medium" style={{ color: '#1A1A1A' }}>{v.titre}</span>
                      {v.obligatoire && <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#B85A5015', color: '#B85A50' }}>Obligatoire</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Lecteur vidéo (modale) */}
      {video && (
        <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-4" style={{ backgroundColor: 'rgba(26,26,26,0.6)' }} onClick={() => setVideo(null)}>
          <div className="w-full max-w-lg rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF' }} onClick={e => e.stopPropagation()}>
            <div className="aspect-video bg-black">
              {embedUrl(video.videoUrl)
                ? <iframe src={embedUrl(video.videoUrl)} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen title={video.titre} />
                : <div className="w-full h-full flex items-center justify-center text-sm" style={{ color: '#FFFFFF' }}>Vidéo indisponible</div>}
            </div>
            <div className="p-5">
              <h3 className="font-semibold" style={{ color: '#1A1A1A' }}>{video.titre}</h3>
              {video.description && <p className="text-sm mt-1" style={{ color: '#7A7068' }}>{video.description}</p>}
              <button onClick={() => setVideo(null)} className="mt-4 w-full py-2.5 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#F5F3EF', color: '#7A7068' }}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
