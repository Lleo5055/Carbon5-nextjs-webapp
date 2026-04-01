import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getFinancialYear } from '@/lib/financialYear';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type AuditToken = {
  package_id: string;
  org_id: string;
  auditor_email: string;
  exp: number;
};

function decodeToken(raw: string): AuditToken | null {
  try {
    return JSON.parse(Buffer.from(raw, 'base64url').toString()) as AuditToken;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawToken = searchParams.get('token');

    if (!rawToken) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    // 1. Decode token
    const token = decodeToken(rawToken);
    if (!token) {
      return NextResponse.json({ error: 'Invalid or malformed audit link' }, { status: 400 });
    }

    // 2. Check expiry
    if (Date.now() > token.exp) {
      return NextResponse.json({ error: 'This audit link has expired' }, { status: 401 });
    }

    // 3. Fetch audit package — verify org_id matches
    const { data: pkg, error: pkgError } = await adminSupabase
      .from('audit_packages')
      .select('*')
      .eq('id', token.package_id)
      .eq('org_id', token.org_id)
      .single();

    if (pkgError || !pkg) {
      return NextResponse.json({ error: 'Audit package not found' }, { status: 404 });
    }

    // 4a. Resolve FY date range from site's entity fy_start_month
    let fyStartMonth = 1; // default calendar year
    let entityId: string | null = null;

    if (pkg.site_id) {
      const { data: siteRow } = await adminSupabase
        .from('sites')
        .select('entity_id')
        .eq('id', pkg.site_id)
        .single();

      if (siteRow?.entity_id) {
        entityId = siteRow.entity_id;
        const { data: entityRow } = await adminSupabase
          .from('entities')
          .select('fy_start_month')
          .eq('id', siteRow.entity_id)
          .single();
        if (entityRow?.fy_start_month) {
          fyStartMonth = entityRow.fy_start_month;
        }
      }
    }

    // Compute FY start/end dates using stored financial_year as start year
    const fyRef = new Date(pkg.financial_year, fyStartMonth - 1, 1);
    const fy = getFinancialYear(fyStartMonth, fyRef);
    const fyStart = fy.start.toISOString().slice(0, 10); // YYYY-MM-DD
    const fyEnd = fy.end.toISOString().slice(0, 10);

    // 4b. Fetch emissions for this site and FY
    let emissionsQuery = adminSupabase
      .from('emissions')
      .select('*')
      .gte('month', fyStart)
      .lte('month', fyEnd)
      .order('month', { ascending: true });

    if (pkg.site_id) {
      emissionsQuery = emissionsQuery.eq('site_id', pkg.site_id);
    } else {
      emissionsQuery = emissionsQuery.eq('org_id', pkg.org_id);
    }

    const { data: emissions } = await emissionsQuery;

    // 4c. Fetch audit log — use entity_id if resolved, otherwise org scope
    let auditLog: any[] = [];
    try {
      let logQuery = adminSupabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (entityId) {
        logQuery = logQuery.eq('entity_id', entityId);
      } else {
        logQuery = logQuery.eq('org_id', pkg.org_id);
      }

      const { data: logRows } = await logQuery;
      auditLog = logRows ?? [];
    } catch {
      // Non-fatal — audit_logs may not yet have expected schema
    }

    // 4d. Fetch audit comments for this package
    const { data: comments } = await adminSupabase
      .from('audit_comments')
      .select('*')
      .eq('package_id', token.package_id)
      .order('created_at', { ascending: true });

    // Fetch org name for display
    const { data: orgRow } = await adminSupabase
      .from('organisations')
      .select('name')
      .eq('id', pkg.org_id)
      .single();

    // Fetch site name for display
    let siteName: string | null = null;
    if (pkg.site_id) {
      const { data: siteRow } = await adminSupabase
        .from('sites')
        .select('name')
        .eq('id', pkg.site_id)
        .single();
      siteName = siteRow?.name ?? null;
    }

    return NextResponse.json({
      package: {
        ...pkg,
        org_name: orgRow?.name ?? null,
        site_name: siteName,
      },
      emissions: emissions ?? [],
      auditLog,
      comments: comments ?? [],
    });
  } catch (err: any) {
    console.error('[audit/review]', err.message);
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 });
  }
}