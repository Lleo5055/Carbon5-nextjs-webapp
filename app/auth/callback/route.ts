import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// Handles Supabase auth redirects: email confirmations, invites, password resets.
// Supabase sends ?token_hash=...&type=invite (or magiclink, recovery, etc.)
// We exchange the token for a session cookie and redirect to the dashboard.
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const next = searchParams.get('next') ?? '/dashboard';

  if (tokenHash && type) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as never });

    if (!error) {
      // Redirect to dashboard — the client-side Supabase SDK will pick up the session
      return NextResponse.redirect(`${origin}${next}`);
    }

    console.error('[auth/callback] OTP verify error:', error.message);
  }

  // Fallback: redirect to login with error hint
  return NextResponse.redirect(`${origin}/login?error=invite_expired`);
}
