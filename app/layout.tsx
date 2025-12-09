import './globals.css';

export const metadata = {
  title: 'UAE SME Carbon Reporting',
  description: 'Simple carbon reporting for UAE SMEs',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
