export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import BillingClient from './BillingClient';

export default async function BillingPage() {
  const cookieStore = cookies();
  const initialLocale = cookieStore.get('greenio_locale')?.value ?? 'en';
  return <BillingClient initialLocale={initialLocale} />;
}
