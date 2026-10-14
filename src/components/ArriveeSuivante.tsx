'use client';

import { useEffect, useState } from 'react';
import { formatHour, ARRIVAL_TIMES } from '@/lib/format';

// ── Prochaine arrivée d'un voyageur, saisie SANS ambiguïté ───────────────────
//
// L'ancien champ était un simple sélecteur de date, borné au jour du ménage.
// Sur téléphone, l'ouvrir puis valider suffisait à enregistrer ce jour-là :
// la mission devenait un « turnover » (arrivée le jour même) que personne
// n'avait voulu — et un turnover passe en tête du planning du cleaner.
//
// Trois choix explicites : Aucune (par défaut), Le jour même, Un autre jour.
// Le jour même ne s'obtient QUE par un geste volontaire ; « un autre jour »
// commence au lendemain du ménage.

export interface Arrivee { date: string; time: string }

type Mode = 'aucune' | 'jour' | 'autre';

function lendemain(d: string): string {
  if (!d) return '';
  const x = new Date(d + 'T00:00:00');
  x.setDate(x.getDate() + 1);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

export default function ArriveeSuivante({
  dateMenage, value, onChange, champClass, champStyle,
}: {
  /** Date du ménage (YYYY-MM-DD). */
  dateMenage: string;
  value: Arrivee;
  onChange: (v: Arrivee) => void;
  /** Classe / style des champs, pour se fondre dans le formulaire hôte. */
  champClass?: string;
  champStyle?: React.CSSProperties;
}) {
  const modeDe = (v: Arrivee): Mode => (!v.date ? 'aucune' : v.date === dateMenage ? 'jour' : 'autre');
  const [mode, setMode] = useState<Mode>(() => modeDe(value));

  // Le ménage change de date alors que « le jour même » est choisi : l'arrivée suit.
  useEffect(() => {
    if (mode === 'jour' && dateMenage && value.date !== dateMenage) onChange({ ...value, date: dateMenage });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateMenage, mode]);

  function choisir(m: Mode) {
    setMode(m);
    if (m === 'aucune') onChange({ date: '', time: '' });
    else if (m === 'jour') onChange({ date: dateMenage, time: value.time });
    else onChange({ date: value.date && value.date !== dateMenage ? value.date : '', time: value.time });
  }

  const bouton = (m: Mode, libelle: string) => (
    <button key={m} type="button" onClick={() => choisir(m)} aria-pressed={mode === m}
      className="flex-1 px-3 py-2.5 rounded-xl text-sm font-semibold border transition-colors"
      style={mode === m
        ? { backgroundColor: m === 'jour' ? '#FEE2E2' : '#C9A84C1F', borderColor: m === 'jour' ? '#B91C1C' : '#C9A84C', color: m === 'jour' ? '#B91C1C' : '#7A6030' }
        : { backgroundColor: '#FFFFFF', borderColor: '#E8E4DC', color: '#7A7068' }}>
      {libelle}
    </button>
  );

  return (
    <div className="space-y-2">
      <div className="flex gap-2 flex-wrap" role="group" aria-label="Prochaine arrivée d'un voyageur">
        {bouton('aucune', 'Aucune')}
        {bouton('jour', 'Le jour même')}
        {bouton('autre', 'Un autre jour')}
      </div>

      {mode !== 'aucune' && (
        <div className="grid grid-cols-2 gap-2">
          {mode === 'autre' ? (
            <input type="date" aria-label="Date de la prochaine arrivée" value={value.date}
              min={lendemain(dateMenage) || undefined}
              onChange={e => onChange({ ...value, date: e.target.value })}
              className={champClass} style={champStyle} />
          ) : (
            <div className={champClass} style={{ ...champStyle, display: 'flex', alignItems: 'center' }}>Jour du ménage</div>
          )}
          <select aria-label="Heure de la prochaine arrivée" value={value.time}
            onChange={e => onChange({ ...value, time: e.target.value })}
            className={champClass} style={champStyle}>
            <option value="">Heure d&apos;arrivée</option>
            {ARRIVAL_TIMES.map(t => <option key={t} value={t}>{formatHour(t)}</option>)}
          </select>
        </div>
      )}

      {mode === 'jour' && (
        <p className="text-xs px-3 py-2 rounded-lg font-semibold" style={{ backgroundColor: '#FEE2E2', color: '#B91C1C' }}>
          Turnover : un voyageur arrive le jour du ménage — mission prioritaire
        </p>
      )}
    </div>
  );
}
