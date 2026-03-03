// app/[locale]/page.tsx
// Server component — pre-renders all supported locale routes at build time.

import { SUPPORTED_LOCALES } from '@/lib/locales/index';
import LocaleHomePage from './LocaleHomePage';

interface Props {
  params: { locale: string };
}

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map(locale => ({ locale }));
}

export default function LocalePage({ params }: Props) {
  return <LocaleHomePage locale={params.locale} />;
}
