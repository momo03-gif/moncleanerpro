'use client';

// ── Grille tarifaire Airbnb & Conciergerie, en PDF ────────────────────────────
//
// La même chose que ce que calcule le simulateur, mise à plat sur une feuille :
// paliers de surface, capacité comprise, zones et options. C'est le document
// qu'on envoie à une conciergerie qui demande « vos tarifs », plutôt que de lui
// faire manipuler le simulateur.
//
// La feuille vit hors écran (et non en `display:none`) : html2canvas a besoin
// d'un élément réellement mis en page pour le photographier.

import { useRef, useState } from 'react';
import { downloadElementPdf } from '@/lib/pdf';
import { useFeedback } from '@/contexts/FeedbackContext';
import type { SimulatorConfig } from '@/lib/devisConfig';
import Icon from '@/components/Icon';

const euro = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`;

function priceCell(min: number | null, max?: number | null): string {
  if (min == null) return 'Sur devis';
  return max != null && max > min ? `${euro(min)} – ${euro(max)}` : euro(min);
}

export default function GrilleAirbnbPdf({ config }: { config: SimulatorConfig }) {
  const { toast } = useFeedback();
  const sheetRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  async function download() {
    if (!sheetRef.current) return;
    setBusy(true);
    try {
      const mois = new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: '2-digit' }).replace('/', '-');
      await downloadElementPdf(sheetRef.current, `grille-airbnb-moncleanerpro-${mois}.pdf`);
    } catch {
      toast('Export PDF impossible sur cet appareil.', 'error');
    }
    setBusy(false);
  }

  return (
    <>
      <button onClick={download} disabled={busy}
        className="text-sm font-semibold px-4 py-2 rounded-xl border border-line text-muted inline-flex items-center gap-2 disabled:opacity-50">
        <Icon name="invoice" size={15} />
        {busy ? 'Préparation…' : 'Exporter la grille en PDF'}
      </button>

      {/* Hors écran, mais bel et bien mis en page. */}
      <div style={{ position: 'fixed', left: -10000, top: 0, width: 780, pointerEvents: 'none' }} aria-hidden="true">
        <div ref={sheetRef} style={{ width: 780, padding: 32, background: '#FFFFFF', fontFamily: 'ui-sans-serif, system-ui, sans-serif', color: '#1A1A1A' }}>

          <div style={{ borderBottom: '2px solid #C9A84C', paddingBottom: 14, marginBottom: 20 }}>
            <p style={{ margin: 0, fontSize: 11, letterSpacing: '.08em', textTransform: 'uppercase', color: '#8A6A1E', fontWeight: 700 }}>
              MonCleanerPro · Grille tarifaire
            </p>
            <h1 style={{ margin: '6px 0 0', fontSize: 24, fontWeight: 700 }}>Airbnb &amp; Conciergerie</h1>
            <p style={{ margin: '6px 0 0', fontSize: 12, color: '#7A7068' }}>
              Ménage entre deux voyageurs · Lyon et métropole ·
              {' '}Établie le {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>

          {/* Paliers de surface */}
          <Section title="Tarif du ménage selon le logement" />
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: '#F5F3EF' }}>
                <Th>Logement</Th>
                <Th>Surface</Th>
                <Th align="center">Voyageurs compris</Th>
                <Th align="right">Tarif</Th>
              </tr>
            </thead>
            <tbody>
              {[...config.tiers].sort((a, b) => a.maxM2 - b.maxM2).map((t, i, arr) => {
                const from = i === 0 ? 0 : arr[i - 1].maxM2 + 1;
                const surface = t.basePrice == null ? `plus de ${arr[i - 1]?.maxM2 ?? 0} m²` : `${from} – ${t.maxM2} m²`;
                return (
                  <tr key={t.id ?? i} style={{ borderBottom: '1px solid #E8E4DC' }}>
                    <Td strong>{t.label}</Td>
                    <Td>{surface}</Td>
                    <Td align="center">{t.capacityIncluded ?? '—'}</Td>
                    <Td align="right" strong>{priceCell(t.basePrice, t.priceMax)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Note>
            Le tarif s&apos;entend pour un logement rendu en état normal. Au-delà de la capacité
            comprise, chaque tranche de deux voyageurs supplémentaires ajoute {euro(config.extraGuestFee)}.
          </Note>

          {/* Zones */}
          {config.zones.length > 0 && (
            <>
              <Section title="Zones d'intervention" />
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: '#F5F3EF' }}>
                    <Th>Zone</Th>
                    <Th>Communes</Th>
                    <Th align="right">Supplément</Th>
                  </tr>
                </thead>
                <tbody>
                  {config.zones.map(z => (
                    <tr key={z.id} style={{ borderBottom: '1px solid #E8E4DC' }}>
                      <Td strong>{z.name}</Td>
                      <Td><span style={{ color: '#7A7068', fontSize: 11.5 }}>{z.communes.join(' · ') || '—'}</span></Td>
                      <Td align="right" strong>{z.fee > 0 ? `+ ${euro(z.fee)}` : 'Inclus'}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* Options */}
          {config.options.length > 0 && (
            <>
              <Section title="Services en plus" />
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: '#F5F3EF' }}>
                    <Th>Service</Th>
                    <Th align="right">Tarif</Th>
                  </tr>
                </thead>
                <tbody>
                  {config.options.map(o => (
                    <tr key={o.key} style={{ borderBottom: '1px solid #E8E4DC' }}>
                      <Td strong>{o.label}</Td>
                      <Td align="right">
                        {o.perCapacity
                          ? (o.tiers ?? []).map(t => `${euro(t.fee)} jusqu'à ${t.max} voy.`).join(' · ') || '—'
                          : euro(o.fee)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <p style={{ marginTop: 24, paddingTop: 12, borderTop: '1px solid #E8E4DC', fontSize: 10.5, color: '#A8A09A', lineHeight: 1.6 }}>
            Tarifs indicatifs, susceptibles d&apos;évoluer. Le devis définitif est confirmé avant
            toute intervention. Conditions particulières pour les conciergeries à partir de
            5 logements — nous consulter.
            <br />MonCleanerPro · 07 83 43 17 00 · info@moncleanerpro.fr · moncleanerpro.fr
          </p>
        </div>
      </div>
    </>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: '8px 0 0', fontSize: 11, color: '#7A7068', lineHeight: 1.55 }}>
      {children}
    </p>
  );
}

function Section({ title }: { title: string }) {
  return (
    <h2 style={{ margin: '22px 0 8px', fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: '#8A6A1E' }}>
      {title}
    </h2>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' | 'center' }) {
  return (
    <th style={{ textAlign: align, padding: '8px 10px', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.04em', color: '#7A7068', fontWeight: 700 }}>
      {children}
    </th>
  );
}

function Td({ children, align = 'left', strong }: { children: React.ReactNode; align?: 'left' | 'right' | 'center'; strong?: boolean }) {
  return (
    <td style={{ textAlign: align, padding: '9px 10px', fontWeight: strong ? 700 : 400 }}>
      {children}
    </td>
  );
}
