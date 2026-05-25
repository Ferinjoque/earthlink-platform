import type { Metadata, Viewport } from 'next';
import { Inter, Instrument_Serif, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

const instrument = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic'],
  display: 'swap',
  preload: false,
  variable: '--font-instrument',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  variable: '--font-mono-stack',
});

export const metadata: Metadata = {
  title: {
    default: 'EarthLink · Auditor ESG de Carbono',
    template: '%s · EarthLink',
  },
  description:
    'Plataforma de auditoría de huella de carbono para cadenas de suministro — Alcance 1 y 2.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#FAF7F0',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${inter.variable} ${instrument.variable} ${mono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
