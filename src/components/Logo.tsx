// ════════════════════════════════════════════════════════════════════════════
//  Logo de marque MonCleanerPro — monogramme sobre (carré arrondi doré + « M »).
//  Remplace l'étincelle ✦ décorative pour un rendu produit, pas « IA ».
// ════════════════════════════════════════════════════════════════════════════

interface LogoProps {
  size?: number;            // côté du monogramme (px)
  showWordmark?: boolean;
  subtitle?: string;        // libellé sous le nom (ex. « Administration »)
  tone?: 'light' | 'dark';  // 'dark' = fond sombre (pages d'authentification)
}

export default function Logo({ size = 30, showWordmark = true, subtitle, tone = 'light' }: LogoProps) {
  const dark = tone === 'dark';
  const tileBg = dark ? '#C9A84C' : '#1A1A1A';
  const tileFg = dark ? '#1A1A1A' : '#C9A84C';
  const wordColor = dark ? '#F5F5F5' : '#1A1A1A';
  const subColor = dark ? '#6B655C' : '#A8A09A';

  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div
        className="flex items-center justify-center rounded-[9px] shrink-0 font-bold"
        style={{ width: size, height: size, backgroundColor: tileBg, color: tileFg, fontSize: size * 0.5, letterSpacing: '-0.02em' }}
      >
        M
      </div>
      {showWordmark && (
        <div className="min-w-0 leading-tight">
          <p className="font-bold text-[15px] truncate" style={{ color: wordColor, letterSpacing: '-0.01em' }}>
            MonCleaner<span style={{ color: '#C9A84C' }}>Pro</span>
          </p>
          {subtitle && (
            <p className="text-[11px] truncate" style={{ color: subColor }}>{subtitle}</p>
          )}
        </div>
      )}
    </div>
  );
}
