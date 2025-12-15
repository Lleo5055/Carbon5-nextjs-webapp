'use client';

import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useEffect } from 'react';

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    const doLogout = async () => {
      await supabase.auth.signOut();
      router.push('/login');
    };

    doLogout();
  }, [router]);

  return (
    <div style={{ padding: 40, fontSize: 16 }}>
      Logging you out...
    </div>
  );
}
