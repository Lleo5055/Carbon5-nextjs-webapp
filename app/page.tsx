// app/page.tsx
// Middleware handles locale redirect server-side — this is a safety fallback only.
import { redirect } from 'next/navigation';

export default function RootPage() {
  redirect('/en');
}
