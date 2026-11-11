'use client';

// ── Tester un devis (aperçu admin du simulateur Airbnb) ───────────────────────
//
// Le barème se comprend mal en le lisant (« voyageurs compris », tranches de
// deux, suppléments qui décalent les deux bornes…). Un exemple chiffré se
// comprend tout de suite : on règle un logement type et on voit le prix.
//
// Le calcul est `computeQuote`, la MÊME fonction que le serveur utilise pour le
// visiteur (/api/devis/estimation) : l'aperçu ne peut pas annoncer autre chose
// que le site. La config vient de la base et se recharge après chaque
// enregistrement : on voit l'effet d'un changement aussitôt.
//
// Comme sur le site, l'urgence n'est jamais appliquée (le visiteur ne la choisit pas).

import { useState } from 'react';
import { computeQuote, zoneForCommune, type SimulatorConfig } from '@/lib/devisSimulator';
import Icon from '@/components/Icon';

const FIELD = 'w-full px-2.5 py-1.5 rounded-lg text-sm border border-line bg-card text-ink';
const eur = (n: number) => `${Math.round(n * 100) / 100} €`;

export default function ApercuDevis({ config }: { config: SimulatorConfig }) {
  const [open, setOpen] = useState(false);
  const [surface, setSurface] = useState(() => Math.min(Math.max(45, config.minM2), config.maxM2));
  const [travelers, setTravelers] = useState(2);
  const [bathrooms, setBathrooms] = useState(1);
  const [commune, setCommune] = useState('');
  const [zoneId, setZoneId] = useState<string | null>(config.zones[0]?.id ?? null);
  const [options, setOptions] = useState<string[]>(() => config.options.filter(o => o.defaultOn).map(o => o.key));

  // Une zone supprimée entre-temps ne doit pas rester sélectionnée en silence.
  const zone = config.zones.find(z => z.id === zoneId) ?? null;
  const quote = computeQuote(config, {
    surface, travelers, bathrooms, zoneId: zone?.id ?? null,
    options: options.filter(k => config.options.some(o => o.key === k)),
    urgencyId: null,
  });

  function onCommune(v: string) {
    setCommune(v);
    const found = zoneForCommune(config.zones, v);
    if (found) setZoneId(found.id);
  }

  const communeInconnue = commune.trim().length > 2 && !zoneForCommune(config.zones, commune);

  return (
    <div className="rounded-2xl border border-line bg-card mb-3">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left">
        <span>
          <span className="block text-sm font-semibold text-ink">Tester un devis</span>
          <span className="block text-xs text-muted">
            {quote.onRequest ? 'Sur devis' : quote.totalMax > quote.total ? `${eur(quote.total)} – ${eur(quote.totalMax)}` : eur(quote.total)}
            {' '}· {surface} m², {travelers} voyageur{travelers > 1 ? 's' : ''}{zone ? `, ${zone.name}` : ''}
          </span>
        </span>
        <span className={`text-muted transition-transform ${open ? 'rotate-180' : ''}`}><Icon name="chevronDown" size={14} /></span>
      </button>

      {open && (
        <div className="px-4 pb-4 grid gap-4 md:grid-cols-2">
          {/* Le logement type */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold mb-1 text-muted">Surface : {surface} m²</label>
              <input type="range" min={config.minM2} max={config.maxM2} value={surface}
                onChange={e => setSurface(Number(e.target.value))} className="w-full accent-gold" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Compteur label="Voyageurs" value={travelers} min={1} max={16} onChange={setTravelers} />
              <Compteur label="Salles de bain" value={bathrooms} min={1} max={6} onChange={setBathrooms} />
            </div>
            {config.zones.length > 0 && (
              <div>
                <label className="block text-xs font-semibold mb-1 text-muted">Commune ou zone</label>
                <input className={FIELD} value={commune} onChange={e => onCommune(e.target.value)} placeholder="Villeurbanne, Meyzieu…" />
                {communeInconnue && (
                  <p className="text-[11px] mt-1 text-warn">Cette commune n&apos;est dans aucune zone : le visiteur devra choisir sa zone à la main.</p>
                )}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {config.zones.map(z => (
                    <button key={z.id} type="button" onClick={() => setZoneId(z.id)}
                      className={`text-xs px-2.5 py-1 rounded-lg border ${z.id === zone?.id ? 'border-gold bg-gold-soft text-gold-ink font-semibold' : 'border-line text-muted'}`}>
                      {z.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {config.options.length > 0 && (
              <div>
                <p className="text-xs font-semibold mb-1 text-muted">Options</p>
                <div className="space-y-1">
                  {config.options.map(o => (
                    <label key={o.key} className="flex items-center gap-2 text-sm text-ink">
                      <input type="checkbox" checked={options.includes(o.key)}
                        onChange={e => setOptions(l => e.target.checked ? [...l, o.key] : l.filter(k => k !== o.key))} />
                      {o.label}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Ce que verra le visiteur */}
          <div className="rounded-xl border border-hairline bg-surface-2 p-3 self-start">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-faint">Ce que verra le visiteur</p>
            {quote.tier && (
              <p className="text-xs mt-1 text-muted">
                Palier appliqué : <span className="font-semibold text-ink">{quote.tier.label}</span> (jusqu&apos;à {quote.tier.maxM2 >= 9000 ? '∞' : quote.tier.maxM2} m²
                {quote.tier.capacityIncluded != null ? `, ${quote.tier.capacityIncluded} voyageurs compris` : ', voyageurs illimités'})
              </p>
            )}
            {quote.onRequest ? (
              <div className="mt-3">
                <p className="text-lg font-bold text-ink">Sur devis</p>
                <p className="text-xs text-muted">{quote.reason} — le simulateur invite le visiteur à vous contacter.</p>
              </div>
            ) : (
              <>
                <div className="mt-3 space-y-1">
                  {quote.lines.map((l, i) => (
                    <div key={i} className="flex justify-between gap-3 text-sm">
                      <span className="text-muted">{l.label}</span>
                      <span className="text-ink whitespace-nowrap">
                        {i > 0 && '+ '}{l.amountMax && l.amountMax > l.amount ? `${eur(l.amount)} – ${eur(l.amountMax)}` : eur(l.amount)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between gap-3 mt-2 pt-2 border-t border-hairline">
                  <span className="text-sm font-semibold text-ink">Estimation</span>
                  <span className="text-lg font-bold text-ink whitespace-nowrap">
                    {quote.totalMax > quote.total ? `${eur(quote.total)} – ${eur(quote.totalMax)}` : eur(quote.total)}
                  </span>
                </div>
              </>
            )}
            <p className="text-[11px] mt-3 text-faint">
              Même calcul que le site, avec les prix enregistrés : une modification apparaît ici dès qu&apos;elle est enregistrée.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Compteur({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div>
      <p className="text-xs font-semibold mb-1 text-muted">{label}</p>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}
          aria-label={`${label} : moins`} className="w-8 h-8 rounded-lg border border-line text-ink disabled:opacity-40">−</button>
        <span className="w-6 text-center text-sm font-semibold text-ink">{value}</span>
        <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}
          aria-label={`${label} : plus`} className="w-8 h-8 rounded-lg border border-line text-ink">+</button>
      </div>
    </div>
  );
}
