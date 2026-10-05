import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GeoFarm.gov — Agricultural Surveillance & Health Management | Govt. of Maharashtra',
  description:
    'State-level GIS surveillance portal for onion disease: case intake, AI triage with human sign-off, field dispatch, predictive risk mapping and emergency advisories.',
  applicationName: 'GeoFarm.gov',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#040910',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-navy-950 text-slate-100">{children}</body>
    </html>
  );
}
