import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireOrgRole } from '@/lib/orgAuth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { org_id, site_id, financial_year, auditor_name, auditor_email } = body;

    if (!org_id || !financial_year || !auditor_name || !auditor_email) {
      return NextResponse.json(
        { error: 'org_id, financial_year, auditor_name, and auditor_email are required' },
        { status: 400 }
      );
    }

    // 1. Auth check — admin or owner required
    const authResult = await requireOrgRole(request, org_id, 'admin');
    if (!authResult.ok) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    // 2. Check for duplicate (same org + site + financial_year)
    let dupQuery = adminSupabase
      .from('audit_packages')
      .select('id')
      .eq('org_id', org_id)
      .eq('financial_year', financial_year);

    if (site_id) {
      dupQuery = dupQuery.eq('site_id', site_id);
    } else {
      dupQuery = dupQuery.is('site_id', null);
    }

    const { data: existing } = await dupQuery.maybeSingle();
    if (existing) {
      return NextResponse.json(
        { error: 'An audit package already exists for this organisation, site, and financial year' },
        { status: 409 }
      );
    }

    // 3. Insert audit package
    const { data: pkg, error: insertError } = await adminSupabase
      .from('audit_packages')
      .insert({
        org_id,
        site_id: site_id ?? null,
        financial_year,
        auditor_name: auditor_name.trim(),
        auditor_email: auditor_email.trim().toLowerCase(),
        status: 'draft',
        created_by: authResult.userId,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[audit/create] insert error:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ package: pkg });
  } catch (err: any) {
    console.error('[audit/create]', err.message);
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 });
  }
}