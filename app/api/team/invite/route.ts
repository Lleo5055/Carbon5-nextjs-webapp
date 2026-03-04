import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// Admin client — uses service role key, server-side only
function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  try {
    const supabaseAdmin = adminClient();

    // Auth: verify caller via bearer token
    const authHeader = req.headers.get('authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const ownerId = user.id;

    // Plan gate — Pro or Enterprise only
    const { data: planRow } = await supabaseAdmin
      .from('user_plans')
      .select('plan')
      .eq('user_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const plan = planRow?.plan ?? 'free';
    if (!['pro', 'enterprise'].includes(plan)) {
      return NextResponse.json(
        { error: 'Team access requires a Pro or Enterprise plan.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const email: string = (body.email ?? '').trim().toLowerCase();
    const role: string = body.role === 'admin' ? 'admin' : 'viewer';

    if (!email) return NextResponse.json({ error: 'Email is required.' }, { status: 400 });

    // Prevent inviting yourself
    if (email === user.email?.toLowerCase()) {
      return NextResponse.json({ error: 'You cannot invite yourself.' }, { status: 400 });
    }

    // Check if already invited / active
    const { data: existing } = await supabaseAdmin
      .from('team_members')
      .select('id, status')
      .eq('owner_id', ownerId)
      .eq('member_email', email)
      .maybeSingle();

    if (existing && existing.status !== 'removed') {
      return NextResponse.json({ error: 'This email has already been invited.' }, { status: 409 });
    }

    // Upsert invite record
    const { error: insertErr } = await supabaseAdmin
      .from('team_members')
      .upsert({
        ...(existing ? { id: existing.id } : {}),
        owner_id: ownerId,
        member_email: email,
        member_user_id: null,
        role,
        status: 'pending',
        invited_at: new Date().toISOString(),
        joined_at: null,
      });

    if (insertErr) {
      console.error('team invite insert error:', insertErr);
      return NextResponse.json({ error: 'Failed to create invite record.' }, { status: 500 });
    }

    // Send Supabase invite email (creates account if user doesn't exist)
    const { error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { invited_by: ownerId },
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/dashboard`,
    });

    if (inviteErr) {
      console.error('supabase invite error:', inviteErr);
      // If user already exists, the invite email may not send — that's OK
      // The team_members row is still created; they'll link on next login
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('team invite unexpected error:', err);
    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 });
  }
}
