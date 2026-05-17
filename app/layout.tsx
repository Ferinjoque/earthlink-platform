import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'EarthLink — Carbon Audit Platform',
    template: '%s · EarthLink',
  },
  description:
    'Automated GHG accounting for Scope 1 & 2 emissions. Turn spreadsheet chaos into an auditable, immutable carbon ledger.',
  keywords: ['ESG', 'GHG', 'carbon accounting', 'Scope 1', 'Scope 2', 'sustainability audit'],
  authors: [{ name: 'EarthLink Engineering' }],
  robots: { index: false, follow: false }, // keep private until launch
};

export const viewport: Viewport = {
  themeColor: '#0e1628',
  colorScheme: 'light dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
