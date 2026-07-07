// ════════════════════════════════════════════════════════════════════════════
//  Logo de marque MonCleanerPro — tuile officielle (M doré + toit + étincelles).
//  Image dans public/logo-mark.png ; le nom reste en texte (thème clair/sombre).
// ════════════════════════════════════════════════════════════════════════════

interface LogoProps {
  size?: number;            // côté de la tuile (px)
  showWordmark?: boolean;
  subtitle?: string;        // libellé sous le nom (ex. « Administration »)
  tone?: 'light' | 'dark';  // 'dark' = fond sombre (pages d'authentification)
}

export default function Logo({ size = 30, showWordmark = true, subtitle, tone = 'light' }: LogoProps) {
  const dark = tone === 'dark';
  const wordColor = dark ? '#F5F5F5' : '#1A1A1A';
  const subColor = dark ? '#6B655C' : '#A8A09A';

  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <img
        src="/logo-mark.png"
        alt="MonCleanerPro"
        width={size}
        height={size}
        className="shrink-0 block"
        style={{ width: size, height: size, borderRadius: size * 0.22, objectFit: 'cover' }}
      />
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
