import './globals.css';

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
      <body>{children}</body>
    </html>
  );
}
