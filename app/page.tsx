// app/page.tsx
// Middleware handles locale redirect server-side — this is a safety fallback only.
import { permanentRedirect } from 'next/navigation';

export default function RootPage() {
  permanentRedirect('/en');
}
