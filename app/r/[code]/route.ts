import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: { code: string } }
) {
  const code = params.code?.toLowerCase();
  const destination = new URL('/signup', req.url).toString();

  if (!code) return NextResponse.redirect(destination);

  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // Log click regardless of validity (don't leak whether code is valid)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? req.headers.get('x-real-ip')
      ?? '';
    const ipHash = ip
      ? Buffer.from(ip).toString('base64').substring(0, 32)
      : null;

    await supabaseAdmin.from('affiliate_clicks').insert({
      ref_code: code,
      ip_hash: ipHash,
      user_agent: req.headers.get('user-agent')?.substring(0, 200) ?? null,
    });
  } catch {
    // Never block the redirect on errors
  }

  const res = NextResponse.redirect(destination);
  res.cookies.set('greenio_ref', code, {
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
    sameSite: 'lax',
    httpOnly: false,
  });

  return res;
}
