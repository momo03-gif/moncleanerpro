'use client';

import { useState, useEffect, useCallback } from 'react';
import { getCleaners } from '@/lib/db';
import {
  getCategoriesDB, createCategoryDB, updateCategoryDB, deleteCategoryDB,
  getFormationsDB, createFormationDB, updateFormationDB, deleteFormationDB,
  getAssignmentsForCleanerDB, assignFormationDB, deleteAssignmentDB,
  type FormationCategory, type Formation, type FormationAssignment,
} from '@/lib/formation';
import { inputStyle } from '@/lib/ui';
import Icon from '@/components/Icon';
import Loading from "@/components/Loading";

export default function AdminFormationPage() {
  const [tab, setTab] = useState<'contenu' | 'assignations'>('contenu');
  const [categories, setCategories] = useState<FormationCategory[]>([]);
  const [formations, setFormations] = useState<Formation[]>([]);
  const [cleaners, setCleaners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [cats, forms, cl] = await Promise.all([getCategoriesDB(), getFormationsDB(), getCleaners()]);
    setCategories(cats); setFormations(forms); setCleaners(cl as any[]);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) return <Loading className="p-4 md:p-6 text-sm" />;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Formation</h1>
        <p className="text-sm mt-1" style={{ color: '#A8A09A' }}>Thèmes, vidéos et assignations aux cleaners.</p>
      </div>

      <div className="flex gap-1 mb-6 p-1 rounded-2xl w-fit" style={{ backgroundColor: '#F5F3EF' }}>
        {([['contenu', 'Contenu'], ['assignations', 'Assignations']] as const).map(([v, label]) => (
          <button key={v} onClick={() => setTab(v)} className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{ backgroundColor: tab === v ? '#FFFFFF' : 'transparent', color: tab === v ? '#1A1A1A' : '#A8A09A', boxShadow: tab === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'contenu'
        ? <ContentPanel categories={categories} formations={formations} onChanged={load} />
        : <AssignPanel categories={categories} formations={formations} cleaners={cleaners} />}
    </div>
  );
}

// ── CONTENU : catégories + vidéos ───────────────────────────────────────────────
function ContentPanel({ categories, formations, onChanged }: { categories: FormationCategory[]; formations: Formation[]; onChanged: () => void }) {
  const [newCat, setNewCat] = useState('');
  const [openCat, setOpenCat] = useState<string | null>(null);

  async function addCat() {
    if (!newCat.trim()) return;
    await createCategoryDB({ titre: newCat.trim(), ordre: categories.length });
    setNewCat(''); onChanged();
  }

  return (
    <>
      <div className="flex gap-2 mb-5">
        <input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="Nouvelle catégorie (ex : Vitres)"
          className="flex-1 px-3 py-2.5 rounded-xl text-sm" style={{ ...inputStyle }} />
        <button onClick={addCat} className="px-4 py-2.5 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>Ajouter</button>
      </div>

      <div className="space-y-3">
        {categories.map(cat => {
          const vids = formations.filter(f => f.categorieId === cat.id);
          const isOpen = openCat === cat.id;
          return (
            <div key={cat.id} className="rounded-2xl border overflow-hidden" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
              <div className="px-5 py-4 flex items-center gap-3">
                <button onClick={() => setOpenCat(isOpen ? null : cat.id)} className="flex-1 flex items-center gap-3 text-left">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: '#C9A84C15', color: '#C9A84C' }}><Icon name="book" size={18} /></div>
                  <div>
                    <p className="font-semibold" style={{ color: '#1A1A1A' }}>{cat.titre}</p>
                    <p className="text-xs" style={{ color: '#A8A09A' }}>{vids.length} vidéo{vids.length > 1 ? 's' : ''}</p>
                  </div>
                </button>
                <button onClick={async () => { if (confirm(`Supprimer la catégorie « ${cat.titre} » et ses vidéos ?`)) { await deleteCategoryDB(cat.id); onChanged(); } }} style={{ color: '#B85A50' }}><Icon name="close" size={16} /></button>
              </div>
              {isOpen && <VideoEditor category={cat} videos={vids} onChanged={onChanged} />}
            </div>
          );
        })}
      </div>
    </>
  );
}

function VideoEditor({ category, videos, onChanged }: { category: FormationCategory; videos: Formation[]; onChanged: () => void }) {
  const empty = { titre: '', description: '', videoUrl: '', obligatoire: false };
  const [form, setForm] = useState(empty);

  async function add() {
    if (!form.titre.trim()) return;
    await createFormationDB({ categorieId: category.id, titre: form.titre.trim(), description: form.description, videoUrl: form.videoUrl, ordre: videos.length, obligatoire: form.obligatoire });
    setForm(empty); onChanged();
  }

  return (
    <div className="px-5 pb-5 border-t pt-4 space-y-3" style={{ borderColor: '#F2EFE9' }}>
      {videos.map(v => (
        <div key={v.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl" style={{ backgroundColor: '#F8F6F2' }}>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: '#1A1A1A' }}>{v.titre}</p>
            <p className="text-xs truncate" style={{ color: '#A8A09A' }}>{v.videoUrl || 'Sans URL'}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => updateFormationDB(v.id, { obligatoire: !v.obligatoire }).then(onChanged)}
              className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: v.obligatoire ? '#B85A5015' : '#F5F3EF', color: v.obligatoire ? '#B85A50' : '#A8A09A' }}>
              {v.obligatoire ? 'Obligatoire' : 'Facultative'}
            </button>
            <button onClick={() => deleteFormationDB(v.id).then(onChanged)} style={{ color: '#B85A50' }}><Icon name="close" size={14} /></button>
          </div>
        </div>
      ))}

      <div className="rounded-xl p-3 space-y-2" style={{ backgroundColor: '#FAFAF8' }}>
        <input value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))} placeholder="Titre de la vidéo"
          className="w-full px-3 py-2 rounded-lg text-sm" style={{ ...inputStyle }} />
        <input value={form.videoUrl} onChange={e => setForm(f => ({ ...f, videoUrl: e.target.value }))} placeholder="URL vidéo (YouTube non listé / Vimeo)"
          className="w-full px-3 py-2 rounded-lg text-sm" style={{ ...inputStyle }} />
        <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description (facultatif)"
          className="w-full px-3 py-2 rounded-lg text-sm" style={{ ...inputStyle }} />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm" style={{ color: '#7A7068' }}>
            <input type="checkbox" checked={form.obligatoire} onChange={e => setForm(f => ({ ...f, obligatoire: e.target.checked }))} />
            Obligatoire
          </label>
          <button onClick={add} className="px-4 py-2 rounded-lg text-xs font-semibold" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>Ajouter la vidéo</button>
        </div>
      </div>
    </div>
  );
}

// ── ASSIGNATIONS ────────────────────────────────────────────────────────────────
function AssignPanel({ categories, formations, cleaners }: { categories: FormationCategory[]; formations: Formation[]; cleaners: any[] }) {
  const [target, setTarget] = useState('');           // « cat:<id> » ou « form:<id> »
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [obligatoire, setObligatoire] = useState(true);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, FormationAssignment[]>>({});

  const loadStatuses = useCallback(async () => {
    const entries = await Promise.all(cleaners.map(async c => [c.id, await getAssignmentsForCleanerDB(c.id)] as const));
    setStatuses(Object.fromEntries(entries));
  }, [cleaners]);
  useEffect(() => { loadStatuses(); }, [loadStatuses]);

  function toggle(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function selectAll() { setSelected(new Set(cleaners.map(c => c.id))); }

  async function assign() {
    if (!target || selected.size === 0) { setMsg('Choisir une cible et au moins un cleaner.'); return; }
    setBusy(true); setMsg('');
    const [kind, id] = target.split(':');
    const res = await assignFormationDB({
      cleanerIds: Array.from(selected),
      formationId: kind === 'form' ? id : undefined,
      categorieId: kind === 'cat' ? id : undefined,
      obligatoire,
    });
    setBusy(false);
    if (res.error) { setMsg(res.error); return; }
    setMsg(`Assigné à ${res.count} cleaner(s).`);
    setSelected(new Set());
    await loadStatuses();
  }

  const labelFor = (a: FormationAssignment) =>
    a.formationId ? (formations.find(f => f.id === a.formationId)?.titre ?? 'Vidéo')
                  : (categories.find(c => c.id === a.categorieId)?.titre ?? 'Catégorie');

  return (
    <>
      <div className="rounded-2xl border p-5 mb-6 space-y-4" style={{ backgroundColor: '#FAFAF8', borderColor: '#E8E4DC' }}>
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#7A7068' }}>Nouvelle assignation</p>

        <div>
          <label className="block text-xs mb-1.5" style={{ color: '#A8A09A' }}>Formation à imposer</label>
          <select value={target} onChange={e => setTarget(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm" style={{ ...inputStyle }}>
            <option value="">— Choisir —</option>
            <optgroup label="Catégories entières">
              {categories.map(c => <option key={c.id} value={`cat:${c.id}`}>{c.titre} (catégorie)</option>)}
            </optgroup>
            <optgroup label="Vidéos">
              {formations.map(f => <option key={f.id} value={`form:${f.id}`}>{f.titre}</option>)}
            </optgroup>
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs" style={{ color: '#A8A09A' }}>Cleaners ({selected.size})</label>
            <button onClick={selectAll} className="text-xs font-semibold" style={{ color: '#C9A84C' }}>Tout sélectionner</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {cleaners.map(c => {
              const on = selected.has(c.id);
              return (
                <button key={c.id} onClick={() => toggle(c.id)} className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{ backgroundColor: on ? '#C9A84C' : '#FFFFFF', color: on ? '#1A1A1A' : '#7A7068', border: '1px solid #E8E4DC' }}>
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm" style={{ color: '#7A7068' }}>
            <input type="checkbox" checked={obligatoire} onChange={e => setObligatoire(e.target.checked)} />
            Obligatoire (bloque les missions tant que non terminée)
          </label>
          <button onClick={assign} disabled={busy} className="px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
            {busy ? '...' : 'Assigner'}
          </button>
        </div>
        {msg && <p className="text-xs" style={{ color: msg.startsWith('Assigné') ? '#5A8A6A' : '#B85A50' }}>{msg}</p>}
      </div>

      {/* Suivi par cleaner */}
      <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#7A7068' }}>Suivi des assignations</p>
      <div className="space-y-3">
        {cleaners.map(c => {
          const list = statuses[c.id] ?? [];
          return (
            <div key={c.id} className="rounded-2xl border p-4" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
              <p className="text-sm font-semibold mb-2" style={{ color: '#1A1A1A' }}>{c.name}</p>
              {list.length === 0 ? (
                <p className="text-xs" style={{ color: '#A8A09A' }}>Aucune formation assignée.</p>
              ) : (
                <div className="space-y-1.5">
                  {list.map(a => (
                    <div key={a.id} className="flex items-center justify-between gap-2">
                      <span className="text-xs truncate" style={{ color: '#7A7068' }}>{labelFor(a)}{a.obligatoire ? ' · obligatoire' : ''}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: a.statut === 'terminee' ? '#5A8A6A15' : '#C48A2A15', color: a.statut === 'terminee' ? '#5A8A6A' : '#C48A2A' }}>
                          {a.statut === 'terminee' ? 'Terminée' : 'À faire'}
                        </span>
                        <button onClick={() => deleteAssignmentDB(a.id).then(loadStatuses)} style={{ color: '#A8A09A' }}><Icon name="close" size={13} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
