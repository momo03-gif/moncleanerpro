import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import ServiceWorkerReg from '@/components/ServiceWorkerReg';
import InstallBanner from '@/components/InstallBanner';

export const metadata: Metadata = {
  title: 'MonCleanerPro',
  description: 'Plateforme professionnelle de nettoyage hôtelier',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'MonCleanerPro',
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
        <link rel="apple-touch-icon" href="/icon/192" />
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
