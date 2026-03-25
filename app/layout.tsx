import './globals.css';
import AuthCacheGuard from '@/components/AuthCacheGuard';

export const metadata = {
  metadataBase: new URL('https://greenio.co'),
  title: 'Carbon Accounting Software | Greenio',
  description: 'Greenio helps businesses track, report and reduce their carbon footprint. Country-specific emission factors, SECR, CSRD and BRSR reporting. Free to start.',
  icons: {
    icon: '/logogreenio.svg',
    shortcut: '/logogreenio.svg',
    apple: '/logogreenio.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthCacheGuard />
        {children}
      </body>
    </html>
  );
}
