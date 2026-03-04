import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pwd = 'Greenio-';
  for (let i = 0; i < 8; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)];
  }
  return pwd;
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

    // Try to create the Supabase user account with a temp password
    const tempPassword = generateTempPassword();
    const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true, // skip email verification — owner shares credentials directly
    });

    // Determine member_user_id: newly created, or already existed
    let memberUserId: string | null = newUser?.user?.id ?? null;
    let alreadyExists = false;

    if (createErr) {
      if (createErr.message?.toLowerCase().includes('already been registered') ||
          createErr.message?.toLowerCase().includes('already exists')) {
        // User already has a Supabase account — link by email lookup
        alreadyExists = true;
        const { data: existingAuthUsers } = await supabaseAdmin.auth.admin.listUsers();
        const found = existingAuthUsers?.users?.find(
          (u) => u.email?.toLowerCase() === email
        );
        memberUserId = found?.id ?? null;
      } else {
        console.error('createUser error:', createErr);
        return NextResponse.json({ error: 'Failed to create user account.' }, { status: 500 });
      }
    }

    // Upsert team_members row
    const { error: insertErr } = await supabaseAdmin
      .from('team_members')
      .upsert({
        ...(existing ? { id: existing.id } : {}),
        owner_id: ownerId,
        member_email: email,
        member_user_id: memberUserId,
        role,
        status: memberUserId ? 'active' : 'pending',
        invited_at: new Date().toISOString(),
        joined_at: memberUserId ? new Date().toISOString() : null,
      });

    if (insertErr) {
      console.error('team invite insert error:', insertErr);
      return NextResponse.json({ error: 'Failed to create invite record.' }, { status: 500 });
    }

    if (alreadyExists) {
      // Can't reset their password without their consent — just tell the owner
      return NextResponse.json({
        success: true,
        alreadyExists: true,
        message: 'This email already has a Greenio account. They have been added to your team and can log in with their existing password.',
      });
    }

    return NextResponse.json({
      success: true,
      credentials: { email, password: tempPassword },
    });
  } catch (err) {
    console.error('team invite unexpected error:', err);
    return NextResponse.json({ error: 'Unexpected error.' }, { status: 500 });
  }
}
