import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { FeedbackProvider } from '@/contexts/FeedbackContext';
import ServiceWorkerReg from '@/components/ServiceWorkerReg';
import PwaSetup from '@/components/PwaSetup';

export const metadata: Metadata = {
  metadataBase: new URL('https://moncleanerpro.fr'),
  title: 'MonCleanerPro',
  description: 'Plateforme professionnelle de nettoyage hôtelier',
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
      </head>
      <body className="min-h-full">
        <AuthProvider>
          <FeedbackProvider>
            {children}
            <PwaSetup />
          </FeedbackProvider>
        </AuthProvider>
        <ServiceWorkerReg />
      </body>
    </html>
  );
}
