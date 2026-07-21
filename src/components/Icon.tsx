// ════════════════════════════════════════════════════════════════════════════
//  Jeu d'icônes ligne (style Lucide) — trait fin, même grille 24×24.
//  Sobre et professionnel : PAS d'emoji, pas de décor « IA ». Une seule source
//  pour toute l'app afin d'unifier la navigation et les actions.
//  Couleur héritée via `currentColor` ; taille et épaisseur ajustables.
// ════════════════════════════════════════════════════════════════════════════

export type IconName =
  | 'dashboard' | 'missions' | 'cleaners' | 'building' | 'map'
  | 'accounts' | 'invoice' | 'stats' | 'wallet'
  | 'today' | 'inbox' | 'user' | 'request' | 'history'
  | 'logout' | 'bell' | 'plus' | 'menu' | 'close' | 'check' | 'award' | 'book' | 'play'
  | 'sync' | 'calendar' | 'link' | 'delivery' | 'parking' | 'wrench'
  | 'clock' | 'timer' | 'pin' | 'chevronDown' | 'camera' | 'phone';

// Chaque entrée = contenu SVG (paths) dessiné dans un viewBox 24×24.
const PATHS: Record<IconName, React.ReactNode> = {
  dashboard: (<>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </>),
  missions: (<>
    <rect x="8" y="2.5" width="8" height="4" rx="1.5" />
    <path d="M16 4.5h2a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2h2" />
    <path d="m9 13.5 2 2 4-4" />
  </>),
  cleaners: (<>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </>),
  building: (<>
    <rect x="4" y="2.5" width="16" height="19" rx="2" />
    <path d="M9.5 21.5v-4h5v4" />
    <path d="M8.5 6.5h0M15.5 6.5h0M8.5 10.5h0M15.5 10.5h0M8.5 14.5h0M15.5 14.5h0" />
  </>),
  map: (<>
    <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" />
    <path d="M9 4v14M15 6v14" />
  </>),
  accounts: (<>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="m15.5 11 2 2 4-4" />
  </>),
  invoice: (<>
    <path d="M15 2.5H6a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z" />
    <path d="M14 2.5v5h5" />
    <path d="M8.5 13h7M8.5 17h7" />
  </>),
  stats: (<>
    <path d="M4 20h16" />
    <rect x="5.5" y="11" width="3.5" height="6" rx="0.8" />
    <rect x="10.5" y="6" width="3.5" height="11" rx="0.8" />
    <rect x="15.5" y="9" width="3.5" height="8" rx="0.8" />
  </>),
  wallet: (<>
    <path d="M20 9V7a2 2 0 0 0-2-2H5a2 2 0 0 1-2-2v0" />
    <path d="M3 5v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-2" />
    <path d="M21 12h-4a2 2 0 0 0 0 4h4z" />
  </>),
  today: (<>
    <rect x="3" y="4.5" width="18" height="17" rx="2" />
    <path d="M16 2.5v4M8 2.5v4M3 9.5h18" />
    <path d="M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01" />
  </>),
  inbox: (<>
    <path d="M22 12h-5l-2 3h-6l-2-3H2" />
    <path d="M5.5 5.5 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.5A2 2 0 0 0 16.8 4.5H7.2a2 2 0 0 0-1.7 1z" />
  </>),
  user: (<>
    <circle cx="12" cy="8" r="4" />
    <path d="M5.5 21v-1a6.5 6.5 0 0 1 13 0v1" />
  </>),
  request: (<>
    <rect x="8" y="2.5" width="8" height="4" rx="1.5" />
    <path d="M16 4.5h2a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2h2" />
    <path d="M9 14h6M12 11v6" />
  </>),
  history: (<>
    <path d="M3.05 11a9 9 0 1 1 .5 4" />
    <path d="M3 4v5h5" />
    <path d="M12 7.5V12l3 2" />
  </>),
  logout: (<>
    <path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" />
    <path d="m16 17 5-5-5-5" />
    <path d="M21 12H9" />
  </>),
  bell: (<>
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </>),
  plus: (<><path d="M12 5v14M5 12h14" /></>),
  check: (<><path d="M20 6 9 17l-5-5" /></>),
  award: (<>
    <circle cx="12" cy="9" r="6" />
    <path d="M8.5 13.5 7 21l5-3 5 3-1.5-7.5" />
  </>),
  book: (<>
    <path d="M4 4.5A2 2 0 0 1 6 2.5h12a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6a2 2 0 0 0-2 2z" />
    <path d="M4 18.5a2 2 0 0 1 2-1.5h13" />
  </>),
  play: (<>
    <circle cx="12" cy="12" r="9" />
    <path d="M10 8.5 16 12l-6 3.5z" />
  </>),
  menu: (<><path d="M4 6h16M4 12h16M4 18h16" /></>),
  close: (<><path d="M6 6l12 12M18 6 6 18" /></>),
  sync: (<>
    <path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-7.5-4" />
    <path d="M3 12a9 9 0 0 1 9-9 9 9 0 0 1 7.5 4" />
    <path d="M21 3v5h-5M3 21v-5h5" />
  </>),
  calendar: (<>
    <rect x="3" y="4.5" width="18" height="17" rx="2" />
    <path d="M16 2.5v4M8 2.5v4M3 9.5h18" />
  </>),
  link: (<>
    <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5" />
    <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5" />
  </>),
  delivery: (<>
    <path d="M3 13.5V6.5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v9" />
    <path d="M15 8.5h3.5l2.5 3v4h-2" />
    <circle cx="7" cy="17.5" r="1.8" />
    <circle cx="17" cy="17.5" r="1.8" />
    <path d="M9 17.5h6M3 15.5h1.5" />
  </>),
  parking: (<>
    <rect x="4" y="3" width="16" height="18" rx="3" />
    <path d="M9 17.5V7.5h3.4a2.6 2.6 0 0 1 0 5.2H9" />
  </>),
  wrench: (<>
    <path d="M15.2 3.3a5.4 5.4 0 0 0-4.9 8.2L3.6 18.2a2 2 0 0 0 2.8 2.8l6.7-6.7a5.4 5.4 0 0 0 6.5-7.4l-3 3-2.7-.7-.7-2.7 3-3a5.4 5.4 0 0 0-1-.2Z" />
  </>),
  clock: (<>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </>),
  timer: (<>
    <circle cx="12" cy="13" r="8" />
    <path d="M12 13V9M9 2h6M18.5 6.5l1.5-1.5" />
  </>),
  pin: (<>
    <path d="M12 21s-6.5-5.5-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15.5 12 21 12 21Z" />
    <circle cx="12" cy="10.5" r="2.4" />
  </>),
  chevronDown: (<>
    <path d="M6 9l6 6 6-6" />
  </>),
  camera: (<>
    <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7H7l1.2-1.8A1 1 0 0 1 9 4.7h6a1 1 0 0 1 .8.5L17 7h2.5A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5Z" />
    <circle cx="12" cy="13" r="3.2" />
  </>),
  phone: (<>
    <path d="M6.5 3.5h-2A1.5 1.5 0 0 0 3 5c0 8 8 16 16 16a1.5 1.5 0 0 0 1.5-1.5v-2a1 1 0 0 0-.8-1l-3.6-.7a1 1 0 0 0-1 .4l-.9 1.2a13 13 0 0 1-5.3-5.3l1.2-.9a1 1 0 0 0 .4-1l-.7-3.6a1 1 0 0 0-1-.8Z" />
  </>),
};

interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export default function Icon({ name, size = 20, strokeWidth = 1.75, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
