import './globals.css';
import type { Metadata, Viewport } from 'next';

import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a0a0b',
};

export const metadata: Metadata = {
  title: 'LandStack',
  description: 'Stack government documents on a map.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'LandStack',
  },
  icons: {
    icon: [
      { url: `${basePath}/icons/earth.png`, sizes: '32x32', type: 'image/png' },
      { url: `${basePath}/icons/earth.png`, sizes: '96x96', type: 'image/png' },
      { url: `${basePath}/icons/earth.png`, sizes: '192x192', type: 'image/png' },
    ],
    apple: [
      { url: `${basePath}/icons/earth.png`, sizes: '180x180', type: 'image/png' },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href={`${basePath}/icons/earth.png`} />
      </head>
      <body className={`${inter.className} antialiased`}>{children}</body>
    </html>
  );
}
