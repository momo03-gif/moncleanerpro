'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { getTarifsDB, estimateFromDescription, type Tarif } from '@/lib/devis';

// ════════════════════════════════════════════════════════════════════════════
//  Page publique « Demander un devis » — sélecteur structuré (catégories →
//  sections → cases) inspiré d'une maquette client, adapté à la charte de l'app.
//  Les PRIX viennent de la grille Supabase (`tarifs`, éditable/importable) ; la
//  présentation (sections, unités, sélection unique) est configurée ici.
//  Un raccourci « décrivez votre besoin » utilise l'agent local pour cocher les
//  prestations automatiquement. À l'envoi : route serveur /api/devis-request
//  (enregistrement en brouillon + notification admin).
// ════════════════════════════════════════════════════════════════════════════

type Mode = 'forfait' | 'm2' | 'unit' | 'quote';
interface Item { tarif: Tarif; name: string; detail: string | null; unitLabel: string | null; mode: Mode; min: number | null; max: number | null; }
interface Section { title: string; single: boolean; items: Item[]; }
interface Macro { id: string; title: string; tagline: string; sections: Section[] }

// ── 5 macro-catégories (ordre + libellés, comme la maquette) ────────────────────
const MACRO_DEF: { id: string; title: string; tagline: string }[] = [
  { id: 'residentiel', title: 'Résidentiel & Airbnb', tagline: 'Ménage régulier, grand nettoyage, locations courte durée, colocation' },
  { id: 'pro', title: 'Locaux professionnels', tagline: 'Bureaux, commerces, santé, éducation et copropriétés' },
  { id: 'remise', title: 'Remise en état & Chantier', tagline: 'Fin de chantier, sinistres, états des lieux' },
  { id: 'vst', title: 'Vitres · Sols · Textiles', tagline: 'Vitrerie, traitement des sols et textiles d’ameublement' },
  { id: 'ext', title: 'Extérieurs & Spécifiques', tagline: 'Extérieurs, situations particulières et prestations à la carte' },
];
// Ordre des sections dans chaque macro-catégorie.
const SECTION_ORDER: Record<string, string[]> = {
  residentiel: ['Entretien classique du logement', 'Nettoyage ponctuel', 'Airbnb & Conciergerie', 'Coliving / Colocation'],
  pro: ['Bureaux, commerces & industrie', 'Santé, petite enfance & éducation', 'Autres établissements'],
  remise: ['Fin de chantier', 'États des lieux', 'Remise en état & sinistres'],
  vst: ['Vitrerie', 'Sols', 'Textile'],
  ext: ['Extérieurs & façades', 'Cuisine, sanitaires & désinfection', 'Situations spécifiques', 'Espaces communs & techniques', 'Traitement de l’air & odeurs', 'Finitions & détails'],
};
const SINGLE_SECTIONS = new Set(['Entretien classique du logement', 'Coliving / Colocation']);

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Classe une prestation dans une macro-catégorie + section d'après son NOM
// (indépendant de la colonne `categorie` en base → marche sans ré-import).
function classify(t: Tarif): { macro: string; section: string } {
  const n = norm(t.nom);
  // Résidentiel & Airbnb
  if (/entretien classique/.test(n)) return { macro: 'residentiel', section: 'Entretien classique du logement' };
  if (/ponctuel|grand menage|grand nettoyage/.test(n)) return { macro: 'residentiel', section: 'Nettoyage ponctuel' };
  if (/coliving|colocation/.test(n)) return { macro: 'residentiel', section: 'Coliving / Colocation' };
  if (/hebergement|airbnb|linge|consommable|\bkit\b/.test(n)) return { macro: 'residentiel', section: 'Airbnb & Conciergerie' };
  // Vitres · Sols · Textiles (avant "pro" pour capter vitrine/vitrerie)
  if (/canape|fauteuil|matelas|moquette|chaise|tapis|tete de lit/.test(n)) return { macro: 'vst', section: 'Textile' };
  if (/tous.*sols|traitement.*sol|\bsols?\b|parquet|prestations techniques|decapage|lustrage|cristallisation|monobrosse/.test(n)) return { macro: 'vst', section: 'Sols' };
  if (/fenetre|baie|velux|vitrine|veranda|vitre|vitrage|carreau/.test(n)) return { macro: 'vst', section: 'Vitrerie' };
  // Remise en état & chantier
  if (/fin de chantier/.test(n)) return { macro: 'remise', section: 'Fin de chantier' };
  if (/etat des lieux/.test(n)) return { macro: 'remise', section: 'États des lieux' };
  if (/remise en etat|apres squat|apres sinistre|apres travaux|insalubre|succession/.test(n)) return { macro: 'remise', section: 'Remise en état & sinistres' };
  // Locaux professionnels
  if (/bureau|boutique|commerce|entrepot|hangar|usine|industrie|atelier/.test(n)) return { macro: 'pro', section: 'Bureaux, commerces & industrie' };
  if (/cabinet|medical|dentaire|creche|ecole|college/.test(n)) return { macro: 'pro', section: 'Santé, petite enfance & éducation' };
  if (/sport|restaurant|hotel|copropriete|immeuble/.test(n)) return { macro: 'pro', section: 'Autres établissements' };
  // Extérieurs & Spécifiques (sous-sections)
  if (/exterieur|terrasse|balcon|facade|haute pression|karcher|panneaux solaires|enseigne|toiture|gouttiere/.test(n)) return { macro: 'ext', section: 'Extérieurs & façades' };
  if (/cuisine|salle de bain|sanitaire|desinfection|degraissage|four|hotte/.test(n)) return { macro: 'ext', section: 'Cuisine, sanitaires & désinfection' };
  if (/debarras|encombrant|tag|graffiti|moisissure|deces|diogene/.test(n)) return { macro: 'ext', section: 'Situations spécifiques' };
  if (/parking|ascenseur|local poubelle|\bvmc\b|climatiseur|ventilation/.test(n)) return { macro: 'ext', section: 'Espaces communs & techniques' };
  if (/desodorisation|odeur|air/.test(n)) return { macro: 'ext', section: 'Traitement de l’air & odeurs' };
  return { macro: 'ext', section: 'Finitions & détails' };
}

// Détails / descriptions par prestation (améliore la lisibilité côté client).
const DETAILS: Record<string, string> = {
  'Nettoyage ponctuel': 'Nettoyage complet : printemps, après travaux, avant/après vente ou location',
  'Nettoyage Hébergement': 'Ménage entre deux locations, du studio au T5',
  'Gestion du linge': 'Lit, serviettes : lavage, séchage, repassage, mise en place',
  'Kit consommables': 'Papier toilette, savon, shampoing, café, thé, liquide vaisselle, sacs, éponge',
  'Bureaux (Quotidien, Hebdo, Mensuel)': 'Fréquence quotidienne, hebdomadaire ou mensuelle',
  'Bureaux (Taux horaire)': 'Facturation à la durée d’intervention',
  'Copropriétés': 'Hall, escaliers, ascenseur, local poubelle, parking',
  'Nettoyage Fin de Chantier': 'Appartement, maison, commerce, local, bureau, immeuble',
  'Remise en état globale': 'Après travaux, sinistre, squat, succession, déménagement, dégât des eaux',
  'Nettoyage État des lieux': 'Cuisine, salle de bain, vitres, plinthes, portes, sols inclus',
  'Traitements tous sols': 'Carrelage, parquet, PVC, moquette, marbre, pierre, béton ciré, résine',
  'Cuisine (Détail)': 'Placards, hotte, four, micro-ondes, frigo, congélateur, lave-vaisselle',
  'Salle de bain (Détail)': 'Détartrage, paroi de douche, robinetterie, joints, WC',
  'Nettoyage extérieur global': 'Terrasse, balcon, cour, garage, allée, façade, toiture, gouttières',
  'Débarras complet': 'Appartement, maison, garage, cave, grenier',
  'Coliving - 1 chambre + communs': 'Chambre + parties communes (cuisine, salon, sanitaires)',
  'Coliving - 2 chambres + communs': '2 chambres + parties communes',
  'Coliving - 3 chambres (maison complete)': 'Maison entière en colocation',
};

// Libellé d'unité par mots-clés du nom (pour le stepper « 6 fenêtre(s) »).
function unitLabelFor(t: Tarif): string | null {
  const n = t.nom.toLowerCase();
  if (t.unite === 'heure') return 'heure(s)';
  const map: [RegExp, string][] = [
    [/fenetre|fenêtre/, 'fenêtre(s)'], [/baie/, 'baie(s)'], [/velux/, 'Velux'], [/porte-|porte /, 'porte(s)'],
    [/volet/, 'volet(s)'], [/store/, 'store(s)'], [/moustiquaire/, 'moustiquaire(s)'], [/canape|canapé/, 'canapé(s)'],
    [/fauteuil/, 'fauteuil(s)'], [/matelas/, 'matelas'], [/cuisine/, 'cuisine(s)'], [/salle de bain/, 'salle(s) de bain'],
    [/sanitaire/, 'bloc(s)'], [/hébergement|hebergement/, 'logement(s)'], [/linge/, 'kit(s)'], [/consommable|kit/, 'kit(s)'],
    [/copropriete|copropriété|ascenseur|passage/, 'passage(s)'], [/escalier/, 'volée(s)'], [/luminaire/, 'luminaire(s)'],
    [/poignee|poignée/, 'poignée(s)'], [/vmc/, 'grille(s)'], [/climatiseur/, 'unité(s)'], [/plinthe/, 'ml'],
    [/enseigne/, 'enseigne(s)'], [/local poubelle/, 'local/locaux'],
  ];
  for (const [re, label] of map) if (re.test(n)) return label;
  if (t.unite === 'piece') return 'unité(s)';
  return null;
}

function modeFor(t: Tarif): Mode {
  const hasPrice = t.prixMin != null || t.prixMax != null || t.prix > 0;
  if (!hasPrice) return 'quote';
  if (t.unite === 'm2') return 'm2';
  if (t.unite === 'forfait') return 'forfait';
  return 'unit';
}
function displayName(t: Tarif): string {
  return t.nom.replace(/^Entretien classique\s*-\s*/i, '').replace(/^Coliving\s*-\s*/i, '');
}
function toItem(t: Tarif): Item {
  return { tarif: t, name: displayName(t), detail: DETAILS[t.nom] ?? null, unitLabel: unitLabelFor(t), mode: modeFor(t), min: t.prixMin ?? (t.prix > 0 ? t.prix : null), max: t.prixMax ?? (t.prix > 0 ? t.prix : null) };
}

// Prestations trop sensibles pour la page grand public (restent dispo côté admin).
function isHiddenPublic(t: Tarif): boolean {
  const n = t.nom.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return /(deces|diogene|sinistre|squat)/.test(n);
}

// Construit les 5 macro-catégories → sections → items en classant CHAQUE
// prestation par son nom (pas la colonne `categorie`) → identique à la maquette
// et fonctionne même sans ré-import de la grille.
function buildCatalog(tarifs: Tarif[]): Macro[] {
  const buckets = new Map<string, Map<string, Item[]>>();
  for (const t of tarifs) {
    if (isHiddenPublic(t)) continue;
    const { macro, section } = classify(t);
    const secMap = buckets.get(macro) ?? buckets.set(macro, new Map()).get(macro)!;
    (secMap.get(section) ?? secMap.set(section, []).get(section)!).push(toItem(t));
  }
  const out: Macro[] = [];
  for (const m of MACRO_DEF) {
    const secMap = buckets.get(m.id);
    if (!secMap) continue;
    const order = SECTION_ORDER[m.id] ?? [...secMap.keys()];
    const titles = [...order.filter(tt => secMap.has(tt)), ...[...secMap.keys()].filter(tt => !order.includes(tt))];
    const sections: Section[] = titles.map(title => ({ title, single: SINGLE_SECTIONS.has(title), items: secMap.get(title)! }));
    if (sections.length) out.push({ id: m.id, title: m.title, tagline: m.tagline, sections });
  }
  return out;
}

const money = (n: number) => Math.round(n).toLocaleString('fr-FR') + ' €';
const num = (n: number) => n.toLocaleString('fr-FR');

// ── Icônes (trait sobre) ────────────────────────────────────────────────────────
const S = (p: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const ICON: Record<string, string> = {
  residentiel: S('<path d="M4 11.5L12 4.5L20 11.5"/><path d="M6.5 9.5V19c0 .55.45 1 1 1h9c.55 0 1-.45 1-1V9.5"/><path d="M10 20v-5c0-.55.45-1 1-1h2c.55 0 1 .45 1 1v5"/>'),
  pro: S('<rect x="5" y="3" width="14" height="18" rx="1"/><line x1="5" y1="9" x2="19" y2="9"/><line x1="5" y1="15" x2="19" y2="15"/>'),
  remise: S('<rect x="4" y="5" width="13" height="5" rx="1.4"/><line x1="10.5" y1="10" x2="10.5" y2="13.5"/><path d="M10.5 13.5H15c.83 0 1.5.67 1.5 1.5v3.7"/>'),
  vst: S('<rect x="4" y="4" width="12" height="13" rx="1"/><line x1="10" y1="4" x2="10" y2="17"/><line x1="4" y1="10.5" x2="16" y2="10.5"/><path d="M19.3 12.8c1.3 1.6 1.5 2.5 1.5 3.1a1.5 1.5 0 0 1-3 0c0-.6.2-1.5 1.5-3.1z"/>'),
  ext: S('<circle cx="12" cy="12" r="4"/><line x1="12" y1="3" x2="12" y2="5.2"/><line x1="12" y1="18.8" x2="12" y2="21"/><line x1="3" y1="12" x2="5.2" y2="12"/><line x1="18.8" y1="12" x2="21" y2="12"/><line x1="5.6" y1="5.6" x2="7.1" y2="7.1"/><line x1="16.9" y1="16.9" x2="18.4" y2="18.4"/><line x1="5.6" y1="18.4" x2="7.1" y2="16.9"/><line x1="16.9" y1="7.1" x2="18.4" y2="5.6"/>'),
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  left: S('<polyline points="15 18 9 12 15 6"/>'), down: S('<polyline points="6 9 12 15 18 9"/>'),
  right: S('<line x1="4" y1="12" x2="17" y2="12"/><polyline points="12 6 18 12 12 18"/>'),
  spark: S('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18"/>'),
};

type Sel = Record<string, { qty: number }>;

export default function DevisEnLignePage() {
  const [tarifs, setTarifs] = useState<Tarif[]>([]);
  const [view, setView] = useState<'home' | 'category' | 'recap'>('home');
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [sel, setSel] = useState<Sel>({});
  const [expanded, setExpanded] = useState(false);
  const [desc, setDesc] = useState('');
  const [aiMsg, setAiMsg] = useState('');
  const [form, setForm] = useState({ nom: '', tel: '', email: '', adresse: '', message: '' });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [sentNumber, setSentNumber] = useState('');
  const [err, setErr] = useState('');
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => { getTarifsDB(true).then(setTarifs).catch(() => setTarifs([])); }, []);
  const catalog = useMemo(() => buildCatalog(tarifs), [tarifs]);
  const byName = useMemo(() => new Map(tarifs.map(t => [t.nom, t])), [tarifs]);

  useEffect(() => { topRef.current?.scrollIntoView({ block: 'start' }); }, [view]);

  // ── Totaux ──
  const totals = useMemo(() => {
    let min = 0, max = 0; const quote: string[] = []; const incomplete: string[] = [];
    for (const nom of Object.keys(sel)) {
      const t = byName.get(nom); if (!t) continue;
      const m = modeFor(t);
      if (m === 'quote') { quote.push(nom); continue; }
      const q = sel[nom].qty;
      if (m === 'm2' && q <= 0) { incomplete.push(nom); continue; }
      if (q <= 0) continue;
      min += (t.prixMin ?? t.prix) * q; max += (t.prixMax ?? t.prix) * q;
    }
    return { min, max, quote, incomplete, count: Object.keys(sel).length };
  }, [sel, byName]);

  // ── Sélection ──
  function itemMode(nom: string): Mode { const t = byName.get(nom); return t ? modeFor(t) : 'forfait'; }
  function toggle(nom: string, single: boolean, siblings: string[]) {
    setSel(s => {
      const n = { ...s };
      if (n[nom]) { delete n[nom]; return n; }
      if (single) siblings.forEach(k => { delete n[k]; });
      n[nom] = { qty: itemMode(nom) === 'm2' ? 0 : 1 };
      return n;
    });
  }
  function setQty(nom: string, q: number) { setSel(s => s[nom] ? { ...s, [nom]: { qty: Math.max(itemMode(nom) === 'm2' ? 0 : 1, q) } } : s); }
  function remove(nom: string) { setSel(s => { const n = { ...s }; delete n[nom]; return n; }); }

  // ── Agent texte → coche les prestations ──
  function runAgent() {
    setAiMsg('');
    const found = estimateFromDescription(desc, tarifs);
    if (found.length === 0) { setAiMsg('Aucune prestation reconnue — parcourez les catégories ci-dessous.'); return; }
    setSel(s => {
      const n = { ...s };
      for (const l of found) { const m = itemMode(l.nom); n[l.nom] = { qty: m === 'm2' ? (l.quantite > 1 ? l.quantite : 0) : l.quantite }; }
      return n;
    });
    setExpanded(true);
    setAiMsg(`${found.length} prestation(s) ajoutée(s) d’après votre description — ajustez si besoin.`);
  }

  // ── Envoi ──
  async function submit() {
    setErr('');
    if (!form.nom.trim() || !form.email.trim() || !form.tel.trim()) { setErr('Renseignez votre nom, téléphone et email.'); return; }
    const lines = Object.keys(sel).map(nom => {
      const t = byName.get(nom)!; const m = modeFor(t); const q = sel[nom].qty || (m === 'm2' ? 0 : 1);
      const pu = t.prix > 0 ? t.prix : 0;
      return { nom: displayName(t) + (m === 'm2' && q > 0 ? ` (${num(q)} m²)` : ''), quantite: Math.max(1, q || 1), prix_unitaire: pu, total: Math.round(pu * (q || 1) * 100) / 100 };
    });
    const total = lines.reduce((s, l) => s + l.total, 0);
    setBusy(true);
    try {
      const res = await fetch('/api/devis-request', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          clientName: form.nom, clientEmail: form.email,
          clientAddress: [form.adresse, form.tel && `Tél : ${form.tel}`].filter(Boolean).join(' — '),
          description: [desc, form.message, `Fourchette estimée : ${money(totals.min)} – ${money(totals.max)}`].filter(Boolean).join(' — '),
          lines, total,
        }),
      });
      const data = await res.json().catch(() => ({}));
      setBusy(false);
      if (!res.ok || data.error) { setErr(data.error || 'Envoi impossible, réessayez.'); return; }
      setSentNumber(data.number || '');
      setSent(true);
    } catch { setBusy(false); setErr('Envoi impossible (connexion). Réessayez.'); }
  }

  if (sent) {
    const rdvUrl = '/rendez-vous?' + new URLSearchParams({
      ...(sentNumber ? { devis: sentNumber } : {}),
      ...(form.nom ? { nom: form.nom } : {}),
      ...(form.email ? { email: form.email } : {}),
    }).toString();
    return (
      <div className="dv-root"><style>{CSS}</style>
        <div className="dv-done">
          <div className="dv-done-ic" dangerouslySetInnerHTML={{ __html: ICON.check }} />
          <h1>Devis enregistré{sentNumber ? ` · ${sentNumber}` : ''}</h1>
          <p>Merci ! Prochaine étape : choisissez le créneau de votre intervention. Nous confirmons ensuite votre devis.</p>
          <a href={rdvUrl} className="dv-btn dv-btn-primary dv-block" style={{ marginTop: 18, textDecoration: 'none' }}>Prendre rendez-vous</a>
        </div>
      </div>
    );
  }

  const macro = activeCat ? catalog.find(c => c.id === activeCat) : null;

  return (
    <div className="dv-root" ref={topRef}><style>{CSS}</style>
      <div className="dv-site">
        <header className="dv-head">
          <div className="dv-mark">MC</div>
          <div><div className="dv-brand">Demander un devis</div><div className="dv-tag">Estimation immédiate, sans engagement</div></div>
        </header>

        {view === 'recap' ? (
          <Recap totals={totals} sel={sel} byName={byName} form={form} setForm={setForm} onBack={() => setView('category')} onHome={() => { setView('home'); setActiveCat(null); }} submit={submit} busy={busy} err={err} />
        ) : (
          <>
            <button className="dv-crumb" onClick={() => { if (view === 'category') { setView('home'); setActiveCat(null); } }} style={{ visibility: view === 'category' ? 'visible' : 'hidden' }}>
              <span dangerouslySetInnerHTML={{ __html: ICON.left }} /> Toutes les catégories
            </button>

            {/* Raccourci agent texte */}
            <div className="dv-ai">
              <div className="dv-ai-ic" dangerouslySetInnerHTML={{ __html: ICON.spark }} />
              <div className="dv-ai-body">
                <input value={desc} onChange={e => setDesc(e.target.value)} onKeyDown={e => e.key === 'Enter' && runAgent()}
                  placeholder="Décrivez votre besoin (ex : maison 3 chambres, état des lieux, 6 vitres…)" />
                <button onClick={runAgent} disabled={!desc.trim()}>Estimer</button>
              </div>
            </div>
            {aiMsg && <p className="dv-ai-msg">{aiMsg}</p>}

            <div className="dv-grid">
              <div>
                {view === 'home' ? (
                  <div className="dv-cats">
                    {catalog.map(c => (
                      <button key={c.id} className="dv-card" onClick={() => { setActiveCat(c.id); setView('category'); }}>
                        <span className="dv-card-ic" dangerouslySetInnerHTML={{ __html: ICON[c.id] }} />
                        <h3>{c.title}</h3>
                        <p>{c.tagline}</p>
                        <span className="dv-card-meta">{c.sections.reduce((s, x) => s + x.items.length, 0)} prestations <span dangerouslySetInnerHTML={{ __html: ICON.right }} /></span>
                      </button>
                    ))}
                  </div>
                ) : macro ? (
                  <div>
                    <div className="dv-cat-head"><h2>{macro.title}</h2><p>{macro.tagline}</p></div>
                    {macro.sections.map((s, i) => (
                      <div key={i} className="dv-sec">
                        <div className="dv-sec-title">{s.title}{s.single && <span className="dv-sec-hint"> — un seul choix</span>}</div>
                        <div className="dv-items">
                          {s.items.map(it => (
                            <ItemRow key={it.tarif.nom} it={it} single={s.single} siblings={s.items.map(x => x.tarif.nom)} sel={sel} toggle={toggle} setQty={setQty} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <Ticket totals={totals} sel={sel} byName={byName} expanded={expanded} setExpanded={setExpanded} onRecap={() => setView('recap')} onRemove={remove} />
            </div>
          </>
        )}

        <footer className="dv-foot">
          <span>Estimation indicative, sans engagement. Devis définitif confirmé avant intervention.</span>
        </footer>
      </div>
    </div>
  );
}

// ── Ligne prestation ──
function ItemRow({ it, single, siblings, sel, toggle, setQty }: { it: Item; single: boolean; siblings: string[]; sel: Sel; toggle: (n: string, s: boolean, sib: string[]) => void; setQty: (n: string, q: number) => void }) {
  const nom = it.tarif.nom;
  const on = !!sel[nom];
  const q = sel[nom]?.qty ?? 0;
  const priceStr = it.mode === 'quote' ? 'Sur devis' : it.min == null ? '' : `${num(it.min!)} – ${num(it.max!)} €${it.mode === 'm2' ? '/m²' : ''}`;
  return (
    <div className={'dv-item' + (on ? ' on' : '') + (single ? ' single' : '')}>
      <button className="dv-item-btn" onClick={() => toggle(nom, single, siblings)} aria-pressed={on}>
        <span className="dv-ind" dangerouslySetInnerHTML={{ __html: ICON.check }} />
        <span className="dv-item-main">
          <span className="dv-item-name">{it.name}</span>
          {it.detail && <span className="dv-item-det">{it.detail}</span>}
        </span>
        <span className="dv-item-price">{priceStr}</span>
      </button>
      {on && it.mode === 'm2' && (
        <div className="dv-qty">
          <label>Surface</label>
          <input type="number" inputMode="decimal" min={0} placeholder="ex : 45" value={q > 0 ? q : ''} onChange={e => setQty(nom, parseFloat(e.target.value.replace(',', '.')) || 0)} />
          <span className="dv-suf">m²</span>
        </div>
      )}
      {on && (it.mode === 'forfait' || it.mode === 'unit') && (
        <div className="dv-qty">
          <span className="dv-step">
            <button onClick={() => setQty(nom, q - 1)} disabled={q <= 1}>−</button>
            <span className="dv-step-v">{q}</span>
            <button onClick={() => setQty(nom, q + 1)}>+</button>
          </span>
          <span className="dv-suf">{it.unitLabel || 'unité(s)'}</span>
        </div>
      )}
    </div>
  );
}

// ── Ticket (récap flottant) ──
function Ticket({ totals, sel, byName, expanded, setExpanded, onRecap, onRemove }: { totals: { min: number; max: number; quote: string[]; incomplete: string[]; count: number }; sel: Sel; byName: Map<string, Tarif>; expanded: boolean; setExpanded: (b: boolean) => void; onRecap: () => void; onRemove: (n: string) => void }) {
  const has = totals.count > 0;
  return (
    <div className="dv-ticket-col">
      <div className={'dv-ticket' + (expanded ? ' exp' : '')}>
        <button className="dv-ticket-head" onClick={() => setExpanded(!expanded)}>
          <h3>Votre estimation</h3>
          <span className="dv-ticket-count">{has ? `${totals.count} prestation${totals.count > 1 ? 's' : ''}` : 'vide'}<span className="dv-chev" dangerouslySetInnerHTML={{ __html: ICON.down }} /></span>
        </button>
        <div className="dv-ticket-body">
          {has ? <TicketLines sel={sel} byName={byName} onRemove={onRemove} /> : <div className="dv-ticket-empty">Aucune prestation sélectionnée.<br />Choisissez une catégorie pour commencer.</div>}
        </div>
        {has && (
          <>
            <div className="dv-ticket-total">
              <div className="dv-tt-row"><span>Estimation indicative</span><strong>{money(totals.min)} – {money(totals.max)}</strong></div>
              {totals.quote.length > 0 && <div className="dv-tt-note">+ {totals.quote.length} prestation(s) sur devis personnalisé</div>}
              {totals.incomplete.length > 0 && <div className="dv-tt-note dv-warn">Précisez la surface pour {totals.incomplete.length} prestation(s)</div>}
            </div>
            <div className="dv-ticket-cta"><button className="dv-btn dv-btn-primary dv-block" onClick={onRecap}>Voir mon estimation complète</button></div>
          </>
        )}
      </div>
    </div>
  );
}
function TicketLines({ sel, byName, onRemove }: { sel: Sel; byName: Map<string, Tarif>; onRemove: (n: string) => void }) {
  return (
    <>
      {Object.keys(sel).map(nom => {
        const t = byName.get(nom); if (!t) return null;
        const m = modeFor(t); const q = sel[nom].qty;
        let price = '', meta = '';
        if (m === 'quote') { price = 'Sur devis'; }
        else if (m === 'm2') { price = q > 0 ? `${money((t.prixMin ?? t.prix) * q)} – ${money((t.prixMax ?? t.prix) * q)}` : 'à préciser'; meta = q > 0 ? `${num(q)} m²` : 'surface à indiquer'; }
        else { price = `${money((t.prixMin ?? t.prix) * q)} – ${money((t.prixMax ?? t.prix) * q)}`; meta = q > 1 ? `×${q}` : ''; }
        return (
          <div key={nom} className="dv-tl">
            <div className="dv-tl-main"><div className="dv-tl-name">{displayName(t)}</div>{meta && <div className="dv-tl-meta">{meta}</div>}</div>
            <div className="dv-tl-right"><span className="dv-tl-price">{price}</span><button onClick={() => onRemove(nom)}>Retirer</button></div>
          </div>
        );
      })}
    </>
  );
}

// ── Vue récap + formulaire ──
function Recap({ totals, sel, byName, form, setForm, onBack, onHome, submit, busy, err }: { totals: { min: number; max: number; quote: string[]; incomplete: string[]; count: number }; sel: Sel; byName: Map<string, Tarif>; form: { nom: string; tel: string; email: string; adresse: string; message: string }; setForm: (f: any) => void; onBack: () => void; onHome: () => void; submit: () => void; busy: boolean; err: string }) {
  const set = (k: string, v: string) => setForm((f: any) => ({ ...f, [k]: v }));
  return (
    <>
      <button className="dv-crumb" onClick={onBack}><span dangerouslySetInnerHTML={{ __html: ICON.left }} /> Modifier ma sélection</button>
      <div className="dv-recap">
        <h2>Votre demande de devis</h2>
        <p className="dv-recap-sub">Vérifiez votre sélection, complétez vos coordonnées, puis envoyez.</p>
        <div className="dv-ticket dv-recap-ticket">
          <div className="dv-ticket-head" style={{ cursor: 'default' }}><h3>Récapitulatif</h3><span className="dv-ticket-count">{totals.count} prestation{totals.count > 1 ? 's' : ''}</span></div>
          <div className="dv-ticket-body" style={{ display: 'block' }}>
            {totals.count ? <TicketLines sel={sel} byName={byName} onRemove={() => {}} /> : <div className="dv-ticket-empty">Aucune prestation. <button className="dv-link" onClick={onHome}>Choisir des prestations</button></div>}
          </div>
          {totals.count > 0 && (
            <div className="dv-ticket-total"><div className="dv-tt-row"><span>Estimation indicative</span><strong>{money(totals.min)} – {money(totals.max)}</strong></div>
              {totals.quote.length > 0 && <div className="dv-tt-note">+ {totals.quote.length} sur devis</div>}</div>
          )}
        </div>
        <div className="dv-disc">Cette estimation est <strong>indicative</strong> et peut varier selon l’état des lieux, l’accessibilité et vos besoins constatés sur place. Le devis définitif vous sera confirmé avant intervention.</div>
        <h3 className="dv-form-title">Vos coordonnées</h3>
        <div className="dv-form">
          <Field label="Nom complet" req val={form.nom} on={v => set('nom', v)} ph="Jean Dupont" />
          <Field label="Téléphone" req val={form.tel} on={v => set('tel', v)} ph="06 12 34 56 78" />
          <Field label="Email" req val={form.email} on={v => set('email', v)} ph="vous@email.fr" />
          <Field label="Adresse / Ville" val={form.adresse} on={v => set('adresse', v)} ph="Adresse d’intervention" />
          <div className="dv-field dv-full"><label>Description complémentaire</label>
            <textarea value={form.message} onChange={e => set('message', e.target.value)} placeholder="État général, contraintes d’accès, urgence, fréquence souhaitée…" /></div>
        </div>
        {err && <p className="dv-err-msg">{err}</p>}
        <div className="dv-recap-actions">
          <button className="dv-btn dv-btn-primary" onClick={submit} disabled={busy}>{busy ? 'Envoi…' : 'Envoyer ma demande'}</button>
        </div>
      </div>
    </>
  );
}
function Field({ label, req, val, on, ph }: { label: string; req?: boolean; val: string; on: (v: string) => void; ph?: string }) {
  return <div className="dv-field"><label>{label}{req && <span className="dv-req"> *</span>}</label><input value={val} onChange={e => on(e.target.value)} placeholder={ph} /></div>;
}

// ════════════════════════════════════════════════════════════════════════════
//  STYLES — charte de l'app (beige/doré), classes préfixées dv- pour éviter tout
//  conflit avec Tailwind / les styles globaux.
// ════════════════════════════════════════════════════════════════════════════
const CSS = `
.dv-root{--bg:#FAFAF8;--sf:#FFF;--sf2:#F5F3EF;--ink:#1A1A1A;--soft:#7A7068;--faint:#A8A09A;--gold:#C9A84C;--gold-d:#9A7B22;--gold-s:#F7F0DC;--line:#E8E4DC;--line2:#DDD6CA;--green:#5A8A6A;--green-d:#4E7D5E;--warm-s:#FBF4E2;--warm-d:#C48A2A;--danger:#B85A50;
  background:var(--bg);color:var(--ink);min-height:100vh;font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased;}
.dv-root *{box-sizing:border-box;}
.dv-site{max-width:1120px;margin:0 auto;padding:0 18px 40px;}
.dv-head{display:flex;align-items:center;gap:13px;padding:22px 0 6px;}
.dv-mark{width:42px;height:42px;border-radius:11px;background:var(--ink);color:var(--bg);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0;letter-spacing:.02em;}
.dv-brand{font-weight:700;font-size:19px;letter-spacing:-.01em;}
.dv-tag{color:var(--soft);font-size:13px;margin-top:1px;}
.dv-crumb{display:inline-flex;align-items:center;gap:5px;background:none;border:none;color:var(--soft);font-size:13.5px;cursor:pointer;padding:12px 0 6px;}
.dv-crumb:hover{color:var(--gold-d);} .dv-crumb svg{width:15px;height:15px;}
/* Agent texte */
.dv-ai{display:flex;gap:12px;align-items:center;background:var(--gold-s);border:1px solid #EBDFB8;border-radius:16px;padding:12px 14px;margin:8px 0 4px;}
.dv-ai-ic{width:30px;height:30px;color:var(--gold-d);flex-shrink:0;} .dv-ai-ic svg{width:24px;height:24px;}
.dv-ai-body{display:flex;gap:8px;flex:1;min-width:0;}
.dv-ai-body input{flex:1;min-width:0;border:1px solid var(--line2);border-radius:10px;padding:10px 12px;font-size:14.5px;background:var(--sf);color:var(--ink);}
.dv-ai-body input:focus{outline:none;border-color:var(--gold);box-shadow:0 0 0 3px var(--gold-s);}
.dv-ai-body button{border:none;background:var(--gold);color:#1A1A1A;font-weight:600;font-size:14px;border-radius:10px;padding:0 18px;cursor:pointer;white-space:nowrap;}
.dv-ai-body button:disabled{opacity:.5;cursor:not-allowed;}
.dv-ai-msg{font-size:12.5px;color:var(--green-d);margin:2px 2px 0;}
/* Grid */
.dv-grid{display:grid;grid-template-columns:1fr 330px;gap:24px;align-items:start;padding-top:14px;padding-bottom:60px;}
@media(max-width:840px){.dv-grid{grid-template-columns:1fr;padding-bottom:0;}}
/* Cartes catégories */
.dv-cats{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;}
@media(max-width:600px){.dv-cats{grid-template-columns:1fr;}}
.dv-card{background:var(--sf);border:1px solid var(--line);border-radius:18px;padding:18px;text-align:left;cursor:pointer;display:flex;flex-direction:column;gap:11px;transition:transform .15s,box-shadow .15s,border-color .15s;width:100%;}
.dv-card:hover{transform:translateY(-3px);box-shadow:0 14px 30px -14px rgba(26,26,26,.25);border-color:var(--line2);}
.dv-card-ic{width:38px;height:38px;border-radius:10px;background:var(--gold-s);color:var(--gold-d);display:flex;align-items:center;justify-content:center;} .dv-card-ic svg{width:20px;height:20px;}
.dv-card h3{margin:0;font-size:16px;font-weight:600;}
.dv-card p{margin:0;color:var(--soft);font-size:13px;line-height:1.45;}
.dv-card-meta{margin-top:auto;color:var(--faint);font-size:11.5px;text-transform:uppercase;letter-spacing:.04em;display:flex;align-items:center;gap:5px;} .dv-card-meta svg{width:13px;height:13px;}
/* Cat header + sections */
.dv-cat-head{margin:6px 0 18px;} .dv-cat-head h2{margin:0;font-size:23px;letter-spacing:-.01em;} .dv-cat-head p{margin:5px 0 0;color:var(--soft);font-size:14px;}
.dv-sec{margin-bottom:22px;} .dv-sec-title{font-size:14px;font-weight:600;margin-bottom:9px;} .dv-sec-hint{color:var(--faint);font-weight:500;font-size:12.5px;}
.dv-items{display:flex;flex-direction:column;gap:7px;}
.dv-item{background:var(--sf);border:1.4px solid var(--line);border-radius:13px;padding:2px;transition:border-color .12s,background .12s;}
.dv-item.on{border-color:var(--gold);background:var(--gold-s);}
.dv-item-btn{display:flex;align-items:flex-start;gap:11px;width:100%;background:none;border:none;padding:10px 11px;cursor:pointer;text-align:left;font:inherit;color:inherit;border-radius:11px;}
.dv-ind{width:19px;height:19px;border-radius:6px;border:1.6px solid var(--line2);flex-shrink:0;margin-top:1px;display:flex;align-items:center;justify-content:center;background:var(--sf);transition:.12s;}
.dv-item.single .dv-ind{border-radius:50%;}
.dv-item.on .dv-ind{background:var(--gold);border-color:var(--gold);}
.dv-ind svg{width:11px;height:11px;stroke:#fff;stroke-width:3;opacity:0;transform:scale(.6);transition:.12s;}
.dv-item.on .dv-ind svg{opacity:1;transform:scale(1);}
.dv-item-main{flex:1;min-width:0;} .dv-item-name{font-weight:600;font-size:14.5px;display:block;} .dv-item-det{color:var(--soft);font-size:12.5px;margin-top:2px;display:block;line-height:1.4;}
.dv-item-price{font-size:12.5px;color:var(--soft);white-space:nowrap;flex-shrink:0;margin-top:1px;font-variant-numeric:tabular-nums;}
.dv-item.on .dv-item-price{color:var(--gold-d);font-weight:600;}
.dv-qty{display:flex;align-items:center;gap:9px;padding:0 11px 11px 41px;flex-wrap:wrap;}
.dv-step{display:flex;align-items:center;border:1.4px solid var(--line2);border-radius:8px;overflow:hidden;background:var(--sf);}
.dv-step button{width:28px;height:28px;border:none;background:var(--sf);font-size:16px;color:var(--ink);cursor:pointer;}
.dv-step button:hover:not(:disabled){background:var(--sf2);} .dv-step button:disabled{color:var(--faint);cursor:not-allowed;}
.dv-step-v{width:30px;text-align:center;font-size:13.5px;font-variant-numeric:tabular-nums;}
.dv-suf{font-size:12px;color:var(--soft);} .dv-qty label{font-size:12px;color:var(--soft);}
.dv-qty input{width:82px;padding:6px 9px;border:1.4px solid var(--line2);border-radius:8px;font-size:13.5px;background:var(--sf);color:var(--ink);}
.dv-qty input:focus{outline:none;border-color:var(--gold);box-shadow:0 0 0 3px var(--gold-s);}
/* Ticket */
.dv-ticket-col{position:sticky;top:16px;align-self:start;}
.dv-ticket{background:var(--sf);border:1px solid var(--line);border-radius:18px;overflow:hidden;box-shadow:0 1px 2px rgba(26,26,26,.06);}
.dv-ticket-head{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 17px;border:none;border-bottom:1px dashed var(--line2);background:none;cursor:pointer;}
.dv-ticket-head h3{margin:0;font-size:12.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--soft);font-weight:600;}
.dv-ticket-count{font-size:11.5px;color:var(--faint);display:flex;align-items:center;gap:5px;white-space:nowrap;}
.dv-chev{display:none;} .dv-chev svg{width:14px;height:14px;}
.dv-ticket-body{padding:2px 17px;}
.dv-ticket-empty{padding:22px 2px;text-align:center;color:var(--faint);font-size:13px;line-height:1.5;}
.dv-tl{display:flex;justify-content:space-between;gap:10px;padding:11px 0;border-bottom:1px solid var(--line);}
.dv-tl:last-child{border-bottom:none;}
.dv-tl-main{flex:1;min-width:0;} .dv-tl-name{font-size:13px;font-weight:600;line-height:1.35;} .dv-tl-meta{font-size:11px;color:var(--faint);margin-top:2px;}
.dv-tl-right{text-align:right;flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:3px;}
.dv-tl-price{font-size:12.5px;white-space:nowrap;font-variant-numeric:tabular-nums;}
.dv-tl-right button{background:none;border:none;color:var(--faint);font-size:11px;cursor:pointer;text-decoration:underline;padding:0;}
.dv-tl-right button:hover{color:var(--danger);}
.dv-ticket-total{padding:14px 17px;border-top:1.5px dashed var(--line2);background:var(--sf2);}
.dv-tt-row{display:flex;justify-content:space-between;align-items:baseline;gap:10px;} .dv-tt-row span{font-size:12.5px;color:var(--soft);} .dv-tt-row strong{font-size:19px;color:var(--gold-d);white-space:nowrap;font-variant-numeric:tabular-nums;}
.dv-tt-note{font-size:11px;color:var(--faint);margin-top:6px;line-height:1.4;} .dv-tt-note.dv-warn{color:var(--warm-d);}
.dv-ticket-cta{padding:13px 17px 16px;}
/* Boutons */
.dv-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:11px;padding:12px 20px;font-size:14px;font-weight:600;border:none;cursor:pointer;transition:transform .08s,background .12s,opacity .12s;}
.dv-btn:active{transform:scale(.98);} .dv-block{width:100%;}
.dv-btn-primary{background:var(--green);color:#fff;} .dv-btn-primary:hover{background:var(--green-d);} .dv-btn-primary:disabled{opacity:.6;cursor:not-allowed;}
.dv-link{background:none;border:none;color:var(--gold-d);text-decoration:underline;cursor:pointer;font:inherit;padding:0;}
/* Recap + form */
.dv-recap{max-width:720px;padding-bottom:50px;} .dv-recap h2{margin:0;font-size:24px;} .dv-recap-sub{color:var(--soft);font-size:14px;margin:5px 0 0;}
.dv-recap-ticket{margin-top:18px;}
.dv-disc{background:var(--warm-s);border:1px solid #EED9A6;border-radius:12px;padding:13px 15px;font-size:13px;color:#6B4E10;line-height:1.5;margin:18px 0;}
.dv-form-title{font-size:15px;margin:20px 0 12px;}
.dv-form{display:grid;grid-template-columns:1fr 1fr;gap:13px;} @media(max-width:600px){.dv-form{grid-template-columns:1fr;}}
.dv-field{display:flex;flex-direction:column;gap:5px;} .dv-full{grid-column:1/-1;}
.dv-field label{font-size:13px;font-weight:600;} .dv-req{color:var(--danger);}
.dv-field input,.dv-field textarea{border:1.4px solid var(--line2);border-radius:10px;padding:11px 13px;font-size:14.5px;background:var(--sf);color:var(--ink);width:100%;font-family:inherit;}
.dv-field textarea{resize:vertical;min-height:84px;line-height:1.5;}
.dv-field input:focus,.dv-field textarea:focus{outline:none;border-color:var(--gold);box-shadow:0 0 0 3px var(--gold-s);}
.dv-recap-actions{margin-top:22px;} .dv-err-msg{color:var(--danger);font-size:13px;margin-top:14px;}
/* Footer + confirmation */
.dv-foot{border-top:1px solid var(--line);padding:22px 0 0;color:var(--faint);font-size:12.5px;}
.dv-done{max-width:420px;margin:14vh auto;text-align:center;background:var(--sf);border:1px solid var(--line);border-radius:20px;padding:34px 28px;}
.dv-done-ic{width:48px;height:48px;border-radius:50%;background:#EAF3EC;color:var(--green-d);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;} .dv-done-ic svg{width:24px;height:24px;stroke-width:2.5;}
.dv-done h1{margin:0 0 8px;font-size:21px;} .dv-done p{margin:0;color:var(--soft);font-size:14px;}
/* Ticket mobile (bottom sheet) */
@media(max-width:840px){
  .dv-ticket-col{position:fixed;left:0;right:0;bottom:0;top:auto;z-index:40;}
  .dv-ticket{border-radius:18px 18px 0 0;box-shadow:0 -10px 30px rgba(26,26,26,.18);max-height:78vh;display:flex;flex-direction:column;}
  .dv-ticket-head{cursor:pointer;flex-shrink:0;} .dv-chev{display:flex;transition:transform .18s;} .dv-ticket.exp .dv-chev{transform:rotate(180deg);}
  .dv-ticket-body{display:none;overflow-y:auto;flex:1;} .dv-ticket.exp .dv-ticket-body{display:block;}
  .dv-ticket:not(.exp) .dv-ticket-total{border-top:none;}
  .dv-site{padding-bottom:120px;}
}
`;
