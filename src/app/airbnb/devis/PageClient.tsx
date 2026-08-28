'use client';

// ════════════════════════════════════════════════════════════════════════════
//  Espace partenaire — « Demander un devis ».
//  Même moteur que la page publique (grille `tarifs` + agent d'estimation local
//  via `@/lib/devisCatalog`), mais dans la charte de l'espace conciergerie et
//  SANS re-saisie d'identité : le partenaire est connecté, on connaît son nom,
//  son email et ses logements.
//  Sert les demandes qui sortent du ménage récurrent : maison en colocation,
//  fin de bail, vitres, remise en état d'un logement du parc ou d'une adresse
//  encore hors parc.
//  Règle métier : AUCUN prix dans le catalogue — la fourchette n'apparaît qu'à
//  l'écran d'estimation, une fois la sélection terminée.
// ════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getTarifsDB, estimateFromDescription, type Tarif } from '@/lib/devis';
import { buildCatalog, displayName, modeFor, type Item } from '@/lib/devisCatalog';
import { getAirbnbsForPartner } from '@/lib/db';
import type { Apartment } from '@/lib/types';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import { Badge, Button, Card, EmptyState, FIELD, Label, PageTitle, SectionTitle } from '@/components/ui';

const money = (n: number) => Math.round(n).toLocaleString('fr-FR') + ' €';
const num = (n: number) => n.toLocaleString('fr-FR');

type Sel = Record<string, { qty: number }>;

// Description de départ d'après la fiche logement : évite au partenaire de
// retaper ce que l'app sait déjà, et donne à l'agent d'estimation de quoi
// travailler dès la sélection du bien.
function seedDescription(a: Apartment): string {
  const bits: string[] = [];
  if (a.bedrooms != null) bits.push(`${a.bedrooms} chambre${a.bedrooms > 1 ? 's' : ''}`);
  if (a.beds != null) bits.push(`${a.beds} lit${a.beds > 1 ? 's' : ''}`);
  if (a.sofaBeds != null) bits.push(`${a.sofaBeds} canapé-lit${a.sofaBeds > 1 ? 's' : ''}`);
  return bits.join(', ');
}

export default function PartnerDevisClient() {
  const { user } = useAuth();
  const router = useRouter();
  const [tarifs, setTarifs] = useState<Tarif[]>([]);
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(true);

  const [step, setStep] = useState<'build' | 'recap'>('build');
  const [aptId, setAptId] = useState<string>('');       // '' = autre adresse
  const [address, setAddress] = useState('');
  // Téléphone de rappel. Pré-rempli avec celui du compte, mais MODIFIABLE et
  // obligatoire : les comptes créés avant la règle n'en ont pas toujours un, et
  // une demande qu'on ne peut pas rappeler dort jusqu'à ce que le client relance.
  const [phone, setPhone] = useState('');
  const [desc, setDesc] = useState('');
  const [agentMsg, setAgentMsg] = useState('');
  const [sel, setSel] = useState<Sel>({});
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sentNumber, setSentNumber] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([getTarifsDB(true), getAirbnbsForPartner(user.id)])
      .then(([t, a]) => {
        setTarifs(t); setApartments(a);
        setPhone(p => p || user.phone || '');
        // Deep-link ?logement=<id> (depuis la fiche logement) → bien pré-sélectionné.
        const id = new URLSearchParams(window.location.search).get('logement');
        const apt = id ? a.find(x => x.id === id) : undefined;
        if (apt) { setAptId(apt.id); setAddress(apt.address ?? ''); setDesc(seedDescription(apt)); }
      })
      .catch(() => { /* grille indisponible → catalogue vide, message dédié */ })
      .finally(() => setLoading(false));
  }, [user]);

  const catalog = useMemo(() => buildCatalog(tarifs), [tarifs]);
  const byName = useMemo(() => new Map(tarifs.map(t => [t.nom, t])), [tarifs]);

  // ── Fourchette de la sélection ──
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

  function itemMode(nom: string) { const t = byName.get(nom); return t ? modeFor(t) : 'forfait'; }
  function toggle(nom: string, single: boolean, siblings: string[]) {
    setSel(s => {
      const n = { ...s };
      if (n[nom]) { delete n[nom]; return n; }
      if (single) siblings.forEach(k => { delete n[k]; });
      n[nom] = { qty: itemMode(nom) === 'm2' ? 0 : 1 };
      return n;
    });
  }
  function setQty(nom: string, q: number) {
    setSel(s => s[nom] ? { ...s, [nom]: { qty: Math.max(itemMode(nom) === 'm2' ? 0 : 1, q) } } : s);
  }
  function remove(nom: string) { setSel(s => { const n = { ...s }; delete n[nom]; return n; }); }

  function pickApartment(id: string) {
    setAptId(id);
    const a = apartments.find(x => x.id === id);
    if (!a) { setAddress(''); return; }
    setAddress(a.address ?? '');
    // On ne remplace jamais une description déjà tapée par le partenaire.
    if (!desc.trim()) setDesc(seedDescription(a));
  }

  // Agent local : description → prestations cochées.
  function runAgent() {
    setAgentMsg('');
    const found = estimateFromDescription(desc, tarifs);
    if (found.length === 0) { setAgentMsg('Aucune prestation reconnue — parcourez les catégories ci-dessous.'); return; }
    setSel(s => {
      const n = { ...s };
      for (const l of found) { const m = itemMode(l.nom); n[l.nom] = { qty: m === 'm2' ? (l.quantite > 1 ? l.quantite : 0) : l.quantite }; }
      return n;
    });
    setAgentMsg(`${found.length} prestation(s) ajoutée(s) d’après votre description — ajustez si besoin.`);
  }

  async function submit() {
    if (!user) return;
    setErr('');
    if (!phone.trim()) { setErr('Indiquez un téléphone : c’est par là que nous revenons vers vous.'); return; }
    const apt = apartments.find(x => x.id === aptId);
    const lines = Object.keys(sel).map(nom => {
      const t = byName.get(nom)!; const m = modeFor(t); const q = sel[nom].qty || (m === 'm2' ? 0 : 1);
      const pu = t.prix > 0 ? t.prix : 0;
      return {
        nom: displayName(t) + (m === 'm2' && q > 0 ? ` (${num(q)} m²)` : ''),
        quantite: Math.max(1, q || 1), prix_unitaire: pu,
        total: Math.round(pu * (q || 1) * 100) / 100,
      };
    });
    const total = lines.reduce((s, l) => s + l.total, 0);
    setBusy(true);
    try {
      const res = await fetch('/api/devis-request', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          clientName: user.name, clientEmail: user.email,
          // Le numéro suit la demande : l'équipe rappelle depuis l'écran Devis
          // sans aller rechercher la fiche du compte.
          clientPhone: phone.trim(),
          clientAddress: [apt ? `Logement : ${apt.name}` : null, address].filter(Boolean).join(' — '),
          description: [
            apt ? `Logement du parc : ${apt.name}` : 'Adresse hors parc',
            desc, note,
            `Fourchette estimée : ${money(totals.min)} – ${money(totals.max)}`,
          ].filter(Boolean).join(' — '),
          lines, total,
          partnerType: 'airbnb',
          partnerLabel: user.name,
        }),
      });
      const data = await res.json().catch(() => ({}));
      setBusy(false);
      if (!res.ok || data.error) { setErr(data.error || 'Envoi impossible, réessayez.'); return; }
      setSentNumber(data.number || '');
    } catch { setBusy(false); setErr('Envoi impossible (connexion). Réessayez.'); }
  }

  if (loading) return <Loading className="p-5 pt-8" variant="skeleton" />;

  // ── Confirmation ──
  if (sentNumber !== null) {
    return (
      <div className="p-5 mcp-in">
        <Card className="p-6 text-center">
          <span className="w-12 h-12 rounded-full bg-success-soft text-success flex items-center justify-center mx-auto mb-4">
            <Icon name="check" size={24} />
          </span>
          <h1 className="text-lg font-bold text-ink mb-1">Demande envoyée{sentNumber ? ` · ${sentNumber}` : ''}</h1>
          <p className="text-sm text-muted mb-5">
            MonCleanerPro a été notifié. Vous recevrez le devis définitif avant toute intervention.
          </p>
          <div className="flex gap-2 justify-center">
            <Button variant="secondary" onClick={() => router.push('/airbnb/accueil')}>Retour à l’accueil</Button>
            <Button onClick={() => { setSentNumber(null); setSel({}); setDesc(''); setNote(''); setAptId(''); setAddress(''); setStep('build'); }}>
              Nouvelle demande
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (tarifs.length === 0) {
    return (
      <div className="p-5 mcp-in">
        <PageTitle title="Demander un devis" />
        <EmptyState icon="invoice" title="Catalogue indisponible" hint="Réessayez dans un instant ou contactez MonCleanerPro." />
      </div>
    );
  }

  // ── Écran d'estimation ──
  if (step === 'recap') {
    return (
      <div className="p-5 mcp-in">
        <button onClick={() => setStep('build')} className="text-xs font-medium text-muted flex items-center gap-1 mb-3">
          <span className="rotate-180 inline-flex"><Icon name="chevronRight" size={14} /></span> Modifier ma sélection
        </button>
        <PageTitle title="Votre estimation" subtitle={`${totals.count} prestation${totals.count > 1 ? 's' : ''} sélectionnée${totals.count > 1 ? 's' : ''}`} />

        <Card className="p-5 mb-4">
          <SelectionLines sel={sel} byName={byName} onRemove={remove} showPrice />
          <div className="mt-4 pt-4 border-t border-hairline flex items-baseline justify-between gap-3">
            <span className="text-xs text-muted">Estimation indicative</span>
            <strong className="text-xl font-bold text-gold-ink">{money(totals.min)} – {money(totals.max)}</strong>
          </div>
          {totals.quote.length > 0 && <p className="text-[11px] text-muted mt-1.5">+ {totals.quote.length} prestation(s) sur devis</p>}
        </Card>

        <div className="rounded-2xl border border-gold-line bg-gold-soft p-4 mb-5">
          <p className="text-xs text-ink leading-relaxed">
            Cette estimation est <strong>indicative</strong> : elle peut varier selon l’état du logement,
            l’accessibilité et ce qui est constaté sur place. Le devis définitif vous est confirmé avant intervention.
          </p>
        </div>

        <div className="mb-5">
          <Label htmlFor="devis-note">Précisions — optionnel</Label>
          <textarea id="devis-note" value={note} onChange={e => setNote(e.target.value)} rows={3}
            placeholder="Date souhaitée, contraintes d’accès, urgence, état constaté…"
            className={`${FIELD} resize-none`} />
        </div>

        <div className="rounded-2xl border border-line bg-card p-4 mb-5 text-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-2">Demande envoyée au nom de</p>
          <p className="font-semibold text-ink">{user?.name}</p>
          <p className="text-xs text-muted">{user?.email}</p>
          {address && <p className="text-xs text-muted mt-1.5 flex items-start gap-1.5"><Icon name="pin" size={12} className="shrink-0 mt-0.5" /> {address}</p>}
        </div>

        {err && <p className="text-xs text-danger mb-3">{err}</p>}
        <Button size="lg" className="w-full" onClick={submit} disabled={busy || totals.count === 0}>
          {busy ? 'Envoi…' : 'Envoyer ma demande'}
        </Button>
      </div>
    );
  }

  // ── Construction de la demande ──
  return (
    <div className="p-5 mcp-in pb-4">
      <PageTitle title="Demander un devis" subtitle="Pour une prestation qui sort du ménage habituel" />

      {/* 1 — Logement concerné */}
      <SectionTitle>Logement concerné</SectionTitle>
      <div className="flex flex-wrap gap-2 mb-3">
        {apartments.map(a => (
          <button key={a.id} onClick={() => pickApartment(a.id)}
            className={`px-3 py-2 rounded-xl border text-xs font-medium transition-colors ${
              aptId === a.id ? 'border-gold bg-gold-soft text-ink' : 'border-line bg-card text-muted'
            }`}>
            {a.name}
          </button>
        ))}
        <button onClick={() => { setAptId(''); setAddress(''); }}
          className={`px-3 py-2 rounded-xl border text-xs font-medium transition-colors ${
            aptId === '' ? 'border-gold bg-gold-soft text-ink' : 'border-line bg-card text-muted'
          }`}>
          Autre adresse
        </button>
      </div>
      {aptId === '' && (
        <div className="mb-5">
          <Label htmlFor="devis-adresse">Adresse d’intervention</Label>
          <input id="devis-adresse" value={address} onChange={e => setAddress(e.target.value)}
            placeholder="12 rue de la Paix, Anse" className={FIELD} />
        </div>
      )}
      <div className="mb-5">
        <Label htmlFor="devis-tel">Téléphone de rappel</Label>
        <input id="devis-tel" type="tel" value={phone} onChange={e => { setPhone(e.target.value); setErr(''); }}
          placeholder="06 12 34 56 78" className={FIELD} />
      </div>

      {/* 2 — Description libre → agent local */}
      <SectionTitle>Décrivez le besoin</SectionTitle>
      <div className="rounded-2xl border border-gold-line bg-gold-soft p-4 mb-2">
        <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3}
          placeholder="Ex : maison de ville 63 m², 3 chambres en colocation, chacune sa salle de bain, communs + escaliers, linge à laver sur place"
          className={`${FIELD} resize-none mb-2.5`} />
        <Button size="sm" onClick={runAgent} disabled={!desc.trim()}>Proposer des prestations</Button>
      </div>
      {agentMsg && <p className="text-xs text-success mb-4 px-1">{agentMsg}</p>}
      {!agentMsg && <div className="mb-4" />}

      {/* 3 — Catalogue */}
      <SectionTitle aside={totals.count > 0 ? <span className="text-xs text-muted">{totals.count} sélectionnée{totals.count > 1 ? 's' : ''}</span> : undefined}>
        Ou choisissez dans le catalogue
      </SectionTitle>
      <div className="space-y-2.5 mb-6">
        {catalog.map(c => {
          const open = openCat === c.id;
          const picked = c.sections.reduce((n, s) => n + s.items.filter(i => sel[i.tarif.nom]).length, 0);
          return (
            <Card key={c.id} className="overflow-hidden">
              <button onClick={() => setOpenCat(open ? null : c.id)}
                className="w-full px-4 py-3.5 flex items-center gap-3 text-left">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink">{c.title}</p>
                  <p className="text-[11px] text-muted mt-0.5 line-clamp-1">{c.tagline}</p>
                </div>
                {picked > 0 && <Badge tone="gold" size="sm">{picked}</Badge>}
                <span className={`text-muted shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}>
                  <Icon name="chevronRight" size={16} />
                </span>
              </button>
              {open && (
                <div className="px-4 pb-4 space-y-4 border-t border-hairline pt-3">
                  {c.sections.map(s => (
                    <div key={s.title}>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-2">
                        {s.title}{s.single && <span className="normal-case font-medium tracking-normal"> — un seul choix</span>}
                      </p>
                      <div className="space-y-2">
                        {s.items.map(it => (
                          <ItemRow key={it.tarif.nom} it={it} single={s.single}
                            siblings={s.items.map(x => x.tarif.nom)}
                            sel={sel} toggle={toggle} setQty={setQty} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Récap + suite */}
      {totals.count > 0 && (
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-2.5">Votre sélection</p>
          <SelectionLines sel={sel} byName={byName} onRemove={remove} />
          {totals.incomplete.length > 0 && (
            <p className="text-[11px] text-warn mt-3">Précisez la surface pour {totals.incomplete.length} prestation(s).</p>
          )}
          {/* Le téléphone se vérifie ICI, pas à l'envoi : le champ est sur cet
              écran, refuser à l'étape suivante renverrait le partenaire en arrière
              pour comprendre ce qui manque. */}
          {err && <p className="text-xs text-danger mt-3">{err}</p>}
          <Button size="lg" className="w-full mt-4"
            onClick={() => { if (!phone.trim()) { setErr('Indiquez un téléphone : c’est par là que nous revenons vers vous.'); return; } setErr(''); setStep('recap'); }}>
            Voir mon estimation
          </Button>
        </Card>
      )}
    </div>
  );
}

// Lignes de la sélection. `showPrice` n'est activé qu'à l'écran d'estimation :
// pendant la sélection, aucun montant n'est affiché.
function SelectionLines({ sel, byName, onRemove, showPrice = false }: {
  sel: Sel; byName: Map<string, Tarif>; onRemove: (n: string) => void; showPrice?: boolean;
}) {
  const names = Object.keys(sel);
  if (names.length === 0) return <p className="text-xs text-muted">Aucune prestation sélectionnée.</p>;
  return (
    <div className="divide-y divide-hairline">
      {names.map(nom => {
        const t = byName.get(nom); if (!t) return null;
        const m = modeFor(t); const q = sel[nom].qty;
        let price = '', meta = '';
        if (m === 'quote') price = 'Sur devis';
        else if (m === 'm2') { price = q > 0 ? `${money((t.prixMin ?? t.prix) * q)} – ${money((t.prixMax ?? t.prix) * q)}` : 'à préciser'; meta = q > 0 ? `${num(q)} m²` : 'surface à indiquer'; }
        else { price = `${money((t.prixMin ?? t.prix) * q)} – ${money((t.prixMax ?? t.prix) * q)}`; meta = q > 1 ? `×${q}` : ''; }
        return (
          <div key={nom} className="flex items-start justify-between gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{displayName(t)}</p>
              {meta && <p className="text-[11px] text-muted mt-0.5">{meta}</p>}
            </div>
            <div className="shrink-0 text-right">
              {showPrice && <p className="text-xs text-ink tabular-nums">{price}</p>}
              <button onClick={() => onRemove(nom)} className="text-[11px] text-muted underline">Retirer</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Ligne prestation du catalogue — jamais de prix ici (règle métier).
function ItemRow({ it, single, siblings, sel, toggle, setQty }: {
  it: Item; single: boolean; siblings: string[]; sel: Sel;
  toggle: (n: string, s: boolean, sib: string[]) => void; setQty: (n: string, q: number) => void;
}) {
  const nom = it.tarif.nom;
  const on = !!sel[nom];
  const q = sel[nom]?.qty ?? 0;
  return (
    <div className={`rounded-xl border transition-colors ${on ? 'border-gold bg-gold-soft' : 'border-line bg-card'}`}>
      <button onClick={() => toggle(nom, single, siblings)} aria-pressed={on}
        className="w-full px-3 py-2.5 flex items-start gap-2.5 text-left">
        <span className={`w-[18px] h-[18px] shrink-0 mt-0.5 flex items-center justify-center border-[1.5px] ${
          single ? 'rounded-full' : 'rounded-md'
        } ${on ? 'bg-gold border-gold text-white' : 'border-line bg-card text-transparent'}`}>
          <Icon name="check" size={11} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-ink">{it.name}</span>
          {it.detail && <span className="block text-[11px] text-muted mt-0.5 leading-snug">{it.detail}</span>}
        </span>
        {it.mode === 'quote' && <span className="text-[11px] text-muted shrink-0">Sur devis</span>}
      </button>
      {on && it.mode === 'm2' && (
        <div className="px-3 pb-2.5 pl-[38px] flex items-center gap-2">
          <input type="number" inputMode="decimal" min={0} placeholder="ex : 63"
            value={q > 0 ? q : ''} onChange={e => setQty(nom, parseFloat(e.target.value.replace(',', '.')) || 0)}
            className="mcp-field px-2.5 py-1.5 text-sm w-24" />
          <span className="text-[11px] text-muted">m²</span>
        </div>
      )}
      {on && (it.mode === 'forfait' || it.mode === 'unit') && (
        <div className="px-3 pb-2.5 pl-[38px] flex items-center gap-2">
          <span className="flex items-center rounded-lg border border-line bg-card overflow-hidden">
            <button onClick={() => setQty(nom, q - 1)} disabled={q <= 1}
              className="w-7 h-7 text-ink disabled:text-faint">−</button>
            <span className="w-7 text-center text-sm tabular-nums">{q}</span>
            <button onClick={() => setQty(nom, q + 1)} className="w-7 h-7 text-ink">+</button>
          </span>
          <span className="text-[11px] text-muted">{it.unitLabel || 'unité(s)'}</span>
        </div>
      )}
    </div>
  );
}
