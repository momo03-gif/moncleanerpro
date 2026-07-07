import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import ServiceWorkerReg from '@/components/ServiceWorkerReg';
import InstallBanner from '@/components/InstallBanner';

export const metadata: Metadata = {
  metadataBase: new URL('https://moncleanerpro.fr'),
  title: 'MonCleanerPro',
  description: 'Plateforme professionnelle de nettoyage hôtelier',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'MonCleanerPro',
  },
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-48.png', sizes: '48x48', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/apple-icon-180.png', sizes: '180x180', type: 'image/png' }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#C9A84C',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="h-full">
      <head>
        <link rel="apple-touch-icon" href="/apple-icon-180.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="MonCleanerPro" />
      </head>
      <body className="min-h-full">
        <AuthProvider>
          {children}
          <InstallBanner />
        </AuthProvider>
        <ServiceWorkerReg />
      </body>
    </html>
  );
}
