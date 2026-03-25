import './globals.css';
import Script from 'next/script';
import AuthCacheGuard from '@/components/AuthCacheGuard';
import CookieConsent from '@/components/CookieConsent';

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
      <head>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-S544JWJ551"
          strategy="afterInteractive"
        />
        <Script id="ga4-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('consent', 'default', { analytics_storage: 'denied' });
            gtag('js', new Date());
            gtag('config', 'G-S544JWJ551');
          `}
        </Script>
      </head>
      <body>
        <AuthCacheGuard />
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}
