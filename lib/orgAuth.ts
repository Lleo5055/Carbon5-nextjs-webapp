import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import type { NextRequest } from 'next/server';
import type { OrgRole } from '@/lib/enterprise';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type OrgAuthResult =
  | { ok: true; userId: string; role: OrgRole; orgId: string }
  | { ok: false; status: 401 | 403 | 400; error: string };

const ROLE_HIERARCHY: OrgRole[] = ['viewer', 'member', 'admin', 'owner'];

export function roleAtLeast(actual: OrgRole, required: OrgRole): boolean {
  return ROLE_HIERARCHY.indexOf(actual) >= ROLE_HIERARCHY.indexOf(required);
}

export async function requireOrgRole(
  request: NextRequest,
  orgId: string | null | undefined,
  minimumRole: OrgRole
): Promise<OrgAuthResult> {
  if (!orgId) {
    return { ok: false, status: 400, error: 'org_id is required' };
  }

  // Authenticate user via cookie session
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          // no-op: cannot set cookies in API route handlers
        },
      },
    }
  );

  let userId: string | undefined;

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (!authError && user) {
    userId = user.id;
  } else {
    // Cookie auth failed (session in localStorage, not cookies) — try Bearer token
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const { data: { user: tokenUser }, error: tokenError } = await adminSupabase.auth.getUser(token);
      if (!tokenError && tokenUser) {
        userId = tokenUser.id;
      }
    }
  }

  if (!userId) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  // Verify membership and role
  const { data: membership, error: membershipError } = await adminSupabase
    .from('org_members')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (membershipError) {
    return { ok: false, status: 403, error: 'Failed to verify membership' };
  }
  if (!membership) {
    return { ok: false, status: 403, error: 'Forbidden — not a member of this organisation' };
  }

  const actualRole = membership.role as OrgRole;
  if (!roleAtLeast(actualRole, minimumRole)) {
    return {
      ok: false,
      status: 403,
      error: `Forbidden — requires ${minimumRole} role or above`,
    };
  }

  return { ok: true, userId: userId as string, role: actualRole, orgId };
}

/**
 * For routes that already have a verified userId (token-based auth):
 * check org membership without re-authenticating via cookies.
 * Returns { ok: true } if the user has the required role, or { ok: false } otherwise.
 */
export async function checkOrgRoleForUser(
  userId: string,
  orgId: string | null | undefined,
  minimumRole: OrgRole
): Promise<OrgAuthResult> {
  if (!orgId) {
    return { ok: false, status: 400, error: 'org_id is required' };
  }

  const { data: membership, error: membershipError } = await adminSupabase
    .from('org_members')
    .select('role')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (membershipError) {
    return { ok: false, status: 403, error: 'Failed to verify membership' };
  }
  if (!membership) {
    return { ok: false, status: 403, error: 'Forbidden — not a member of this organisation' };
  }

  const actualRole = membership.role as OrgRole;
  if (!roleAtLeast(actualRole, minimumRole)) {
    return {
      ok: false,
      status: 403,
      error: `Forbidden — requires ${minimumRole} role or above`,
    };
  }

  return { ok: true, userId, role: actualRole, orgId };
}