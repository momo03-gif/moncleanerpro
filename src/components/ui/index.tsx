// ════════════════════════════════════════════════════════════════════════════
//  Primitives d'interface — le vocabulaire visuel commun de l'app.
//
//  Ces composants existaient déjà, mais recopiés écran par écran : la même
//  carte, la même pastille de statut, la même tuile, le même sélecteur
//  d'onglets, redessinés à chaque fois avec leurs couleurs en dur. Résultat :
//  des écarts (rayons, épaisseurs, contrastes) et aucun moyen de faire évoluer
//  le style d'un seul geste.
//
//  Règle : aucune couleur en dur ici non plus — tout passe par les jetons
//  déclarés dans `globals.css` (`text-ink`, `bg-card`, `border-line`…).
// ════════════════════════════════════════════════════════════════════════════

import Icon, { type IconName } from '@/components/Icon';

/* ── Carte ──────────────────────────────────────────────────────────────── */

export function Card({ children, className = '', tone = 'plain', as = 'div', ...rest }: {
  children: React.ReactNode;
  className?: string;
  /** `alert` souligne une carte à traiter en priorité (turnover, incident). */
  tone?: 'plain' | 'alert';
  as?: 'div' | 'section';
} & React.HTMLAttributes<HTMLDivElement>) {
  const Tag = as;
  const border = tone === 'alert' ? 'border-danger-line' : 'border-line';
  return (
    <Tag className={`rounded-2xl border bg-card ${border} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

/* ── Pastille de statut ─────────────────────────────────────────────────── */

/**
 * Les statuts de mission viennent de `lib/labels` avec leurs couleurs déjà
 * calculées : on accepte donc une paire bg/color explicite. Pour les usages
 * simples, `tone` suffit.
 */
export function Badge({ children, tone = 'neutral', size = 'md', style, className = '' }: {
  children: React.ReactNode;
  tone?: 'neutral' | 'gold' | 'success' | 'danger' | 'warn';
  /** `sm` pour les listes denses. Une prop, pas un `!px-…` : en Tailwind v4 le
   *  modificateur important est un SUFFIXE (`px-1.5!`), et la forme v3 en
   *  préfixe est ignorée sans erreur. */
  size?: 'sm' | 'md';
  style?: React.CSSProperties;
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-surface text-muted',
    gold: 'bg-gold text-ink',
    success: 'bg-success-soft text-success',
    danger: 'bg-danger-soft text-danger',
    warn: 'bg-warn-soft text-warn',
  };
  const sizes = {
    sm: 'text-[10px] px-1.5 py-0.5',
    md: 'text-[11px] px-2.5 py-1',
  }[size];
  return (
    <span
      className={`rounded-full font-semibold shrink-0 ${sizes} ${style ? '' : tones[tone]} ${className}`}
      style={style}
    >
      {children}
    </span>
  );
}

/* ── Tuile de chiffre clé ───────────────────────────────────────────────── */

export function Tile({ label, value, sub, tone = 'plain', onClick }: {
  label: string;
  value: number | string;
  sub?: string;
  tone?: 'plain' | 'gold' | 'warn' | 'danger';
  onClick?: () => void;
}) {
  const tones = {
    plain: { box: 'bg-card border-line', label: 'text-muted', value: 'text-ink', sub: 'text-muted' },
    gold: { box: 'bg-gold border-gold', label: 'text-gold-ink', value: 'text-ink', sub: 'text-gold-ink' },
    warn: { box: 'bg-card border-warn-line', label: 'text-warn', value: 'text-warn', sub: 'text-warn' },
    danger: { box: 'bg-card border-danger-line', label: 'text-danger', value: 'text-danger', sub: 'text-danger' },
  }[tone];

  const inner = (
    <div className={`rounded-2xl p-4 border h-full text-left ${tones.box}`}>
      <p className={`text-xs font-medium mb-1.5 ${tones.label}`}>{label}</p>
      <p className={`text-3xl font-bold ${tones.value}`}>{value}</p>
      {sub && <p className={`text-[11px] mt-1 leading-tight ${tones.sub}`}>{sub}</p>}
    </div>
  );

  if (!onClick) return inner;
  return (
    <button onClick={onClick} className="block w-full text-left active:scale-95 transition-transform">
      {inner}
    </button>
  );
}

/* ── État vide ──────────────────────────────────────────────────────────── */

export function EmptyState({ icon, title, hint, action }: {
  icon?: IconName;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="px-5 py-10 flex flex-col items-center text-center">
      {icon && (
        <span className="mb-3 text-faint" aria-hidden="true">
          <Icon name={icon} size={30} />
        </span>
      )}
      <p className="font-medium text-sm text-ink">{title}</p>
      {hint && <p className="text-xs mt-1 text-muted">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </Card>
  );
}

/* ── Sélecteur d'onglets ────────────────────────────────────────────────── */

/**
 * Onglets segmentés. Rendu en `role="tablist"` : les lecteurs d'écran
 * annoncent la position et l'onglet actif, ce que trois `<button>` nus ne
 * faisaient pas.
 */
export function Segmented<T extends string>({ value, onChange, options, className = '' }: {
  value: T;
  onChange: (v: T) => void;
  options: readonly (readonly [T, string])[];
  className?: string;
}) {
  return (
    <div role="tablist" className={`flex gap-1 p-1 rounded-2xl w-fit max-w-full overflow-x-auto bg-surface ${className}`}>
      {options.map(([v, label]) => {
        const active = value === v;
        return (
          <button
            key={v}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(v)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              active ? 'bg-card text-ink shadow-[0_1px_3px_rgba(0,0,0,0.08)]' : 'text-muted'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Titres ─────────────────────────────────────────────────────────────── */

export function PageTitle({ title, subtitle, action }: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-5 pt-2">
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-ink">{title}</h1>
        {subtitle && <p className="text-sm mt-0.5 text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <h2 className="text-sm font-bold text-ink">{children}</h2>
      {aside}
    </div>
  );
}

/* ── Boutons ────────────────────────────────────────────────────────────── */

type ButtonProps = {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ variant = 'primary', size = 'md', className = '', children, ...rest }: ButtonProps) {
  const variants = {
    primary: 'bg-gold text-ink font-semibold',
    secondary: 'bg-surface text-muted font-medium',
    ghost: 'border border-line text-muted font-medium',
    danger: 'border border-danger-line text-danger font-medium',
  }[variant];

  // Cibles tactiles : `min-h` garantit les 44px recommandés (Apple HIG) même
  // pour les boutons `sm`, qui tombaient auparavant à ~26px de haut.
  const sizes = {
    sm: 'text-xs px-3 min-h-[44px] py-2 rounded-lg',
    md: 'text-sm px-4 min-h-[44px] py-2.5 rounded-xl',
    lg: 'text-sm px-5 min-h-[52px] py-3.5 rounded-xl w-full',
  }[size];

  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 active:scale-95 transition-transform disabled:opacity-50 disabled:active:scale-100 ${variants} ${sizes} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Bouton icône seule — impose un libellé accessible, sinon il est muet. */
export function IconButton({ icon, label, tone = 'neutral', className = '', ...rest }: {
  icon: IconName;
  label: string;
  tone?: 'neutral' | 'danger';
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const tones = {
    neutral: 'bg-surface text-muted',
    danger: 'bg-danger-soft text-danger',
  }[tone];
  return (
    <button
      aria-label={label}
      title={label}
      className={`w-11 h-11 flex items-center justify-center rounded-xl shrink-0 active:scale-95 transition-transform ${tones} ${className}`}
      {...rest}
    >
      <Icon name={icon} size={18} />
    </button>
  );
}

/* ── Champ de formulaire ────────────────────────────────────────────────── */

export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-muted">
      {children}
    </label>
  );
}

/** Classe commune des `input`/`select`/`textarea` — voir `.mcp-field` dans globals.css. */
export const FIELD = 'mcp-field px-4 py-3 text-sm';
export const FIELD_SM = 'mcp-field px-3 py-2 text-sm';

/* ── Bandeau d'alerte ───────────────────────────────────────────────────── */

export function AlertRow({ text, tone, onClick }: {
  text: string;
  tone: 'danger' | 'warn' | 'success';
  onClick?: () => void;
}) {
  const tones = {
    danger: 'border-danger-line bg-danger-soft text-danger',
    warn: 'border-warn-line bg-warn-soft text-warn',
    success: 'border-success-line bg-success-soft text-success',
  }[tone];

  const body = (
    <>
      <span className="w-2 h-2 rounded-full shrink-0 bg-current" aria-hidden="true" />
      <p className="text-xs font-semibold flex-1">{text}</p>
      {onClick && <span className="shrink-0" aria-hidden="true"><Icon name="chevronRight" size={14} /></span>}
    </>
  );

  const classes = `w-full text-left rounded-2xl border px-4 py-3 flex items-center gap-3 ${tones}`;

  if (!onClick) return <div className={classes}>{body}</div>;
  return (
    <button onClick={onClick} className={`${classes} active:scale-[0.99] transition-transform`}>
      {body}
    </button>
  );
}
