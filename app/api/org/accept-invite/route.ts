import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate requesting user via cookie session
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Resolve the user's email via admin client
    const { data: authUser, error: userError } = await adminSupabase.auth.admin.getUserById(user.id);
    if (userError || !authUser?.user?.email) {
      return NextResponse.json({ error: 'Could not resolve user email' }, { status: 500 });
    }
    const userEmail = authUser.user.email.toLowerCase();

    // 3. Build query for pending rows with null user_id matching the invited email
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('org_id');

    let query = adminSupabase
      .from('org_members')
      .select('id, org_id, invited_email')
      .eq('status', 'pending')
      .is('user_id', null);

    if (orgId) {
      query = query.eq('org_id', orgId);
    }

    const { data: pendingRows, error: queryError } = await query;
    if (queryError) {
      return NextResponse.json({ error: queryError.message }, { status: 500 });
    }

    if (!pendingRows || pendingRows.length === 0) {
      return NextResponse.json({ accepted: 0 });
    }

    // 4. Filter rows where invited_email matches the authenticated user's email
    const matchingIds = pendingRows
      .filter((row: any) => row.invited_email?.toLowerCase() === userEmail)
      .map((row: any) => row.id);

    if (matchingIds.length === 0) {
      return NextResponse.json({ accepted: 0 });
    }

    // 5. Update matching rows to active
    const { error: updateError } = await adminSupabase
      .from('org_members')
      .update({
        user_id: user.id,
        status: 'active',
        joined_at: new Date().toISOString(),
      })
      .in('id', matchingIds);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ accepted: matchingIds.length });
  } catch (err: any) {
    console.error('[org/accept-invite]', err.message);
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 });
  }
}