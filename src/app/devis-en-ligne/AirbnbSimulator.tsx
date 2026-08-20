'use client';

// ── Simulateur Airbnb & Conciergerie ──────────────────────────────────────────
//
// Remplace la liste de cases à cocher pour cette catégorie : un propriétaire de
// location courte durée ne raisonne pas en « prestations », il raisonne en
// logement — une surface, des voyageurs, des salles de bain, une commune.
//
// Tout ce qui chiffre vient de la base (lib/devisConfig.ts) et s'édite dans
// l'admin. Le calcul est pur et testé (lib/devisSimulator.ts). Ici : l'écran.
//
// Les classes `dv-` sont celles de la page de devis (charte beige/doré) ; les
// quelques éléments propres au simulateur ont leur propre feuille, préfixée
// `sim-`, injectée par le parent.

import { useState, useMemo } from 'react';
import { computeQuote, initialState, zoneForCommune, type SimulatorConfig, type SimulatorState } from '@/lib/devisSimulator';

const money = (n: number) => Math.round(n).toLocaleString('fr-FR') + ' €';

export interface SimulatorSubmission {
  lines: { nom: string; quantite: number; prix_unitaire: number; total: number }[];
  total: number;
  summary: string;
  onRequest: boolean;
}

export default function AirbnbSimulator({ config, onContinue }: {
  config: SimulatorConfig;
  /** Passe au récapitulatif + coordonnées, avec le contenu du devis. */
  onContinue: (s: SimulatorSubmission) => void;
}) {
  const [state, setState] = useState<SimulatorState>(() => initialState(config));
  const [commune, setCommune] = useState('');

  const quote = useMemo(() => computeQuote(config, state), [config, state]);
  const zone = config.zones.find(z => z.id === state.zoneId);

  const set = <K extends keyof SimulatorState>(k: K, v: SimulatorState[K]) =>
    setState(s => ({ ...s, [k]: v }));

  // Saisir sa commune sélectionne la zone : le visiteur connaît sa ville, pas
  // le découpage tarifaire.
  function onCommune(value: string) {
    setCommune(value);
    const found = zoneForCommune(config.zones, value);
    if (found) set('zoneId', found.id);
  }

  function toggleOption(key: string) {
    setState(s => ({
      ...s,
      options: s.options.includes(key) ? s.options.filter(k => k !== key) : [...s.options, key],
    }));
  }

  function submit() {
    const summary = [
      `${quote.tier?.label ?? 'Logement'} · ${state.surface} m²`,
      `${state.travelers} voyageur${state.travelers > 1 ? 's' : ''}`,
      `${state.bathrooms} salle${state.bathrooms > 1 ? 's' : ''} de bain`,
      zone ? `zone ${zone.name}` : null,
      commune.trim() ? `commune : ${commune.trim()}` : null,
    ].filter(Boolean).join(' · ');

    onContinue({
      lines: quote.lines.map(l => ({ nom: l.label, quantite: 1, prix_unitaire: l.amount, total: l.amount })),
      total: quote.total,
      summary,
      onRequest: quote.onRequest,
    });
  }

  return (
    <div className="sim">
      {/* ── 1. Le logement ──────────────────────────────────────────────── */}
      <div className="sim-block">
        <div className="sim-head">
          <span className="sim-step">1</span>
          <span className="sim-title">Votre logement</span>
          <span className="sim-live">{state.surface} m²</span>
        </div>
        <input type="range" className="sim-range"
          min={config.minM2} max={config.maxM2} value={state.surface}
          aria-label="Surface du logement en m²"
          style={{ ['--pct' as string]: `${((state.surface - config.minM2) / Math.max(1, config.maxM2 - config.minM2)) * 100}%` }}
          onChange={e => set('surface', parseInt(e.target.value, 10))} />
        <p className="sim-hint">
          {quote.tier ? `${quote.tier.label}${quote.tier.capText ? ` · capacité indicative ${quote.tier.capText}` : ''}` : 'Surface hors grille'}
        </p>
      </div>

      {/* ── 2. Voyageurs & salles de bain ───────────────────────────────── */}
      <div className="sim-block">
        <div className="sim-head"><span className="sim-step">2</span><span className="sim-title">Voyageurs et salles de bain</span></div>
        <Stepper label="Voyageurs" hint="capacité maximale annoncée" value={state.travelers}
          min={1} max={16} onChange={v => set('travelers', v)} />
        <Stepper label="Salles de bain / WC" hint="douche, baignoire ou WC séparé" value={state.bathrooms}
          min={1} max={6} onChange={v => set('bathrooms', v)} />
      </div>

      {/* ── 3. La zone ──────────────────────────────────────────────────── */}
      {config.zones.length > 0 && (
        <div className="sim-block">
          <div className="sim-head"><span className="sim-step">3</span><span className="sim-title">Où se trouve le logement ?</span></div>
          <input className="sim-input" value={commune} onChange={e => onCommune(e.target.value)}
            placeholder="Votre commune (ex : Villeurbanne)" aria-label="Commune du logement" />
          <div className="sim-chips">
            {config.zones.map(z => (
              <button key={z.id} type="button"
                className={'sim-chip' + (z.id === state.zoneId ? ' on' : '')}
                onClick={() => set('zoneId', z.id)}>
                {z.name}
                {z.fee > 0 && <span className="sim-chip-fee">+{z.fee} €</span>}
              </button>
            ))}
          </div>
          {zone && <p className="sim-hint">{zone.communes.slice(0, 12).join(' · ')}</p>}
        </div>
      )}

      {/* ── 4. Les options ──────────────────────────────────────────────── */}
      {config.options.length > 0 && (
        <div className="sim-block">
          <div className="sim-head"><span className="sim-step">4</span><span className="sim-title">Services en plus</span></div>
          <div className="sim-toggles">
            {config.options.map(o => {
              const on = state.options.includes(o.key);
              return (
                <button key={o.key} type="button" className={'sim-toggle' + (on ? ' on' : '')}
                  onClick={() => toggleOption(o.key)} aria-pressed={on}>
                  <span className="sim-toggle-label">{o.label}</span>
                  <span className="sim-switch" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 5. Le délai ─────────────────────────────────────────────────── */}
      {config.urgency.length > 0 && (
        <div className="sim-block">
          <div className="sim-head"><span className="sim-step">5</span><span className="sim-title">Sous quel délai ?</span></div>
          <div className="sim-chips">
            {config.urgency.map(u => (
              <button key={u.id} type="button"
                className={'sim-chip' + (u.id === state.urgencyId ? ' on' : '')}
                onClick={() => set('urgencyId', u.id)}>
                {u.label}
                {u.fee > 0 && <span className="sim-chip-fee">+{u.fee} €</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── L'estimation, qui se construit sous les yeux ────────────────── */}
      <div className="sim-recap">
        <div className="sim-recap-head">
          <span>{quote.tier?.label ?? 'Votre logement'}</span>
          <span className="sim-recap-meta">{state.surface} m² · {state.travelers} voy.</span>
        </div>

        {quote.onRequest ? (
          <p className="sim-onrequest">
            {quote.reason} — nous établissons un devis sur mesure. Continuez, nous vous
            recontactons avec un prix ferme.
          </p>
        ) : (
          <div className="sim-lines">
            {quote.lines.map(l => (
              <div key={l.label} className="sim-line">
                <span>{l.label}</span><span className="sim-dots" /><strong>{money(l.amount)}</strong>
              </div>
            ))}
          </div>
        )}

        <div className="sim-total">
          <span>Estimation</span>
          <strong>{quote.onRequest ? 'Sur devis' : money(quote.total)}</strong>
        </div>

        <p className="sim-disc">
          Estimation pour un logement rendu en état normal. Le devis définitif vous est
          confirmé avant toute intervention.
        </p>

        <button className="dv-btn dv-btn-primary dv-block" onClick={submit}>
          Continuer ma demande
        </button>
      </div>
    </div>
  );
}

function Stepper({ label, hint, value, min, max, onChange }: {
  label: string; hint?: string; value: number; min: number; max: number; onChange: (v: number) => void;
}) {
  return (
    <div className="sim-stepper-row">
      <span className="sim-stepper-label">
        {label}{hint && <small>{hint}</small>}
      </span>
      <span className="sim-stepper">
        <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`Diminuer : ${label}`}>−</button>
        <span className="sim-stepper-val">{value}</span>
        <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`Augmenter : ${label}`}>+</button>
      </span>
    </div>
  );
}

// Styles propres au simulateur — mêmes variables que la page de devis, donc
// même charte beige/doré. Injectés par le parent avec le reste du CSS.
export const SIMULATOR_CSS = `
.sim{max-width:640px;}
.sim-block{padding:20px 0;border-bottom:1px solid var(--line);}
.sim-block:first-child{padding-top:4px;}
.sim-head{display:flex;align-items:baseline;gap:9px;margin-bottom:14px;}
.sim-step{width:20px;height:20px;border-radius:50%;background:var(--gold);color:#1A1A1A;font-size:11px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;}
.sim-title{font-size:14.5px;font-weight:700;}
.sim-live{margin-left:auto;font-size:14px;font-weight:700;color:var(--gold-d);font-variant-numeric:tabular-nums;}
.sim-hint{font-size:12.5px;color:var(--faint);margin:9px 0 0;line-height:1.5;}
.sim-range{-webkit-appearance:none;appearance:none;width:100%;height:6px;border-radius:99px;outline:none;
  background:linear-gradient(90deg,var(--gold) 0%,var(--gold) var(--pct,20%),var(--sf2) var(--pct,20%),var(--sf2) 100%);}
.sim-range::-webkit-slider-thumb{-webkit-appearance:none;width:24px;height:24px;border-radius:50%;background:#fff;border:4px solid var(--gold);box-shadow:0 2px 8px rgba(26,26,26,.22);cursor:pointer;}
.sim-range::-moz-range-thumb{width:16px;height:16px;border-radius:50%;background:#fff;border:4px solid var(--gold);cursor:pointer;}
.sim-stepper-row{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;padding:7px 0;}
.sim-stepper-label{font-size:14px;font-weight:600;} .sim-stepper-label small{display:block;font-weight:400;font-size:12px;color:var(--faint);margin-top:1px;}
.sim-stepper{display:inline-flex;align-items:center;border:1.4px solid var(--line2);border-radius:10px;overflow:hidden;background:var(--sf);}
.sim-stepper button{width:38px;height:38px;border:none;background:var(--sf);font-size:17px;color:var(--ink);cursor:pointer;}
.sim-stepper button:hover:not(:disabled){background:var(--sf2);} .sim-stepper button:disabled{color:var(--faint);cursor:not-allowed;}
.sim-stepper-val{min-width:44px;text-align:center;font-size:14.5px;font-weight:700;font-variant-numeric:tabular-nums;}
.sim-input{width:100%;border:1.4px solid var(--line2);border-radius:10px;padding:11px 13px;font-size:14.5px;background:var(--sf);color:var(--ink);font-family:inherit;}
.sim-input:focus{outline:none;border-color:var(--gold);box-shadow:0 0 0 3px var(--gold-s);}
.sim-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;}
.sim-chip{border:1.4px solid var(--line);background:var(--sf);color:var(--soft);padding:9px 15px;border-radius:99px;font-size:13.5px;font-weight:600;display:inline-flex;align-items:center;gap:7px;cursor:pointer;font-family:inherit;}
.sim-chip:hover{border-color:var(--gold);} .sim-chip.on{background:var(--gold-s);border-color:var(--gold);color:var(--gold-d);}
.sim-chip-fee{font-size:12px;opacity:.85;font-variant-numeric:tabular-nums;}
.sim-toggles{display:grid;grid-template-columns:1fr 1fr;gap:9px;} @media(max-width:520px){.sim-toggles{grid-template-columns:1fr;}}
.sim-toggle{display:flex;align-items:center;justify-content:space-between;gap:10px;border:1.4px solid var(--line);border-radius:13px;padding:13px 15px;background:var(--sf);cursor:pointer;font-family:inherit;text-align:left;}
.sim-toggle.on{border-color:var(--gold);background:var(--gold-s);}
.sim-toggle-label{font-size:14px;font-weight:600;color:var(--ink);}
.sim-switch{position:relative;width:38px;height:22px;border-radius:99px;background:var(--line2);flex-shrink:0;transition:background .18s;}
.sim-switch::after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform .18s;}
.sim-toggle.on .sim-switch{background:var(--gold);} .sim-toggle.on .sim-switch::after{transform:translateX(16px);}
.sim-recap{margin-top:22px;background:var(--sf);border:1px solid var(--line);border-radius:18px;padding:20px;}
.sim-recap-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;padding-bottom:12px;border-bottom:1.5px dashed var(--line2);}
.sim-recap-head span:first-child{font-size:17px;font-weight:700;}
.sim-recap-meta{font-size:12.5px;color:var(--faint);font-variant-numeric:tabular-nums;}
.sim-lines{padding:6px 0;}
.sim-line{display:flex;align-items:baseline;gap:8px;padding:7px 0;font-size:13.5px;color:var(--soft);}
.sim-line strong{color:var(--ink);font-variant-numeric:tabular-nums;white-space:nowrap;}
.sim-dots{flex:1;border-bottom:1.5px dotted var(--line);transform:translateY(-3px);}
.sim-onrequest{font-size:13px;color:var(--warm-d);background:var(--warm-s);border:1px solid #EED9A6;border-radius:11px;padding:12px 14px;margin:14px 0 0;line-height:1.5;}
.sim-total{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-top:12px;padding-top:14px;border-top:1.5px dashed var(--line2);}
.sim-total span{font-size:12.5px;text-transform:uppercase;letter-spacing:.05em;font-weight:700;color:var(--faint);}
.sim-total strong{font-size:28px;color:var(--gold-d);font-variant-numeric:tabular-nums;}
.sim-disc{font-size:11.5px;color:var(--faint);line-height:1.5;margin:12px 0 16px;}
`;
