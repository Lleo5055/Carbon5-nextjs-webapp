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

async function getOwner(supabaseAdmin: ReturnType<typeof adminClient>, req: NextRequest) {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '');
  if (!token) return null;
  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  return user ?? null;
}

// GET — list team members for the authenticated owner
export async function GET(req: NextRequest) {
  const supabaseAdmin = adminClient();
  const user = await getOwner(supabaseAdmin, req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('team_members')
    .select('id, member_email, role, status, invited_at, joined_at')
    .eq('owner_id', user.id)
    .neq('status', 'removed')
    .order('invited_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ members: data ?? [] });
}

// DELETE — remove a team member (set status = 'removed')
export async function DELETE(req: NextRequest) {
  const supabaseAdmin = adminClient();
  const user = await getOwner(supabaseAdmin, req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const memberId: string = body.memberId ?? '';
  if (!memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 });

  const { error } = await supabaseAdmin
    .from('team_members')
    .update({ status: 'removed' })
    .eq('id', memberId)
    .eq('owner_id', user.id); // ensure ownership

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
