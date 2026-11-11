import type { Viewport } from 'next';

// Pages PUBLIQUES (vitrine, pages SEO, blog, devis, rendez-vous) : le zoom reste
// possible. Le layout racine le bloque pour l'APPLICATION (cleaners, partenaires,
// admin), où un zoom accidentel gêne ; sur une page qu'on lit, le bloquer nuit à
// l'accessibilité et Google le signale.
// Next fusionne le viewport de la page avec celui du layout : il faut donc
// redonner explicitement maximumScale et userScalable.
export const VITRINE_VIEWPORT: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#C9A84C',
};
