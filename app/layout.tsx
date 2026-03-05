import './globals.css';
import AuthCacheGuard from '@/components/AuthCacheGuard';

export const metadata = {
  title: 'UK SME Carbon Accounting',
  description: 'Simple and reliable carbon accounting for UK SMEs',
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
