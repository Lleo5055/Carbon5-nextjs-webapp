import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireOrgRole } from '@/lib/orgAuth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Service-role client — only used server-side for auth.admin calls
const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // 1. Validate org_id param
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('org_id');
    if (!orgId) {
      return NextResponse.json({ error: 'org_id is required' }, { status: 400 });
    }

    // 2. Authenticate and verify requesting user is at least a viewer of this org
    const authResult = await requireOrgRole(request, orgId, 'viewer');
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    // 4. Fetch all members for this org
    const { data: members, error: membersError } = await adminSupabase
      .from('org_members')
      .select('id, org_id, user_id, role, status, invited_at, joined_at, entity_access')
      .eq('org_id', orgId);

    if (membersError) {
      return NextResponse.json({ error: membersError.message }, { status: 500 });
    }

    // 5. Resolve emails via auth.admin.getUserById — failures set email to null
    const resolved = await Promise.all(
      (members ?? []).map(async (member: any) => {
        try {
          const { data } = await adminSupabase.auth.admin.getUserById(member.user_id);
          return { ...member, email: data?.user?.email ?? null };
        } catch {
          return { ...member, email: null };
        }
      })
    );

    return NextResponse.json(resolved);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 });
  }
}