'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

const CACHE_KEYS = [
  'greenio_plan_v1',
  'greenio_is_pro',
  'greenio_profile_cache',
  'view_emissions_report_v1',
  'dashboard_state',
];

function clearAllCaches() {
  CACHE_KEYS.forEach(k => sessionStorage.removeItem(k));
  // Clear year-based free report keys (current + adjacent years)
  const year = new Date().getFullYear();
  [year - 1, year, year + 1].forEach(y =>
    sessionStorage.removeItem(`greenio_free_report_used_${y}`)
  );
}

export default function AuthCacheGuard() {
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        clearAllCaches();
        sessionStorage.removeItem('greenio_session_user');
        return;
      }

      if (session?.user?.id) {
        const prevUserId = sessionStorage.getItem('greenio_session_user');
        if (prevUserId && prevUserId !== session.user.id) {
          // Different user signed in — wipe stale caches immediately
          clearAllCaches();
        }
        sessionStorage.setItem('greenio_session_user', session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return null;
}
