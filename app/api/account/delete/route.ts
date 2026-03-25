import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { user_id } = await req.json();
    if (!user_id) return new NextResponse('Missing user_id', { status: 400 });

    // Verify the caller is authenticated and is the same user
    const authHeader = req.headers.get('authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    if (!token) return new NextResponse('Unauthorized', { status: 401 });

    const supabaseAuth = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !user) return new NextResponse('Unauthorized', { status: 401 });
    if (user.id !== user_id) return new NextResponse('Forbidden', { status: 403 });

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    // Delete all user data in order (FK constraints)
    await supabaseAdmin.from('scope3_activities').delete().eq('account_id', user_id);
    await supabaseAdmin.from('emissions').delete().eq('account_id', user_id);
    await supabaseAdmin.from('water_entries').delete().eq('account_id', user_id);
    await supabaseAdmin.from('waste_entries').delete().eq('account_id', user_id);
    await supabaseAdmin.from('air_emissions').delete().eq('account_id', user_id);
    await supabaseAdmin.from('brsr_profile').delete().eq('account_id', user_id);
    await supabaseAdmin.from('user_plans').delete().eq('user_id', user_id);
    await supabaseAdmin.from('activity_log').delete().eq('user_id', user_id);
    await supabaseAdmin.from('profiles').delete().eq('id', user_id);

    // Delete the auth user last
    const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[account/delete]', err.message);
    return new NextResponse(err?.message ?? 'Delete failed', { status: 500 });
  }
}
