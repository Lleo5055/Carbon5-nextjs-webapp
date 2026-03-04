'use client';

import { useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

// When an invited user first logs in, their email will be in team_members with status='pending'.
// This layout silently links their account on every dashboard load (no-op if already linked).
async function linkPendingTeamInvite() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return;

  const { data: pending } = await supabase
    .from('team_members')
    .select('id')
    .eq('member_email', user.email.toLowerCase())
    .eq('status', 'pending')
    .maybeSingle();

  if (!pending) return;

  await supabase
    .from('team_members')
    .update({
      member_user_id: user.id,
      status: 'active',
      joined_at: new Date().toISOString(),
    })
    .eq('id', pending.id);
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    linkPendingTeamInvite();
  }, []);

  return <>{children}</>;
}
