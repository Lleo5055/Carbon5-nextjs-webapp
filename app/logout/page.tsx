'use client';

import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useEffect } from 'react';

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    const doLogout = async () => {
      // Clear all caches immediately so the next user sees no stale data
      sessionStorage.clear();
      await supabase.auth.signOut();
      router.push('/login');
    };

    doLogout();
  }, [router]);

  return null;
}
