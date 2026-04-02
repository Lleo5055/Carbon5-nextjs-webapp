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

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Greenio',
  url: 'https://greenio.co',
  logo: 'https://greenio.co/logogreenio.svg',
  sameAs: [],
  contactPoint: {
    '@type': 'ContactPoint',
    email: 'hello@greenio.co',
    contactType: 'customer support',
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-S544JWJS51"
          strategy="afterInteractive"
        />
        <Script id="ga4-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('consent', 'default', { analytics_storage: 'denied' });
            gtag('js', new Date());
            gtag('config', 'G-S544JWJS51');
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
