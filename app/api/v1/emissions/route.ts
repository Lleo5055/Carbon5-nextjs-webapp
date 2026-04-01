import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateApiKey } from '@/lib/apiKeyAuth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const auth = await authenticateApiKey(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, {
      status: auth.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('site_id');
    const financialYear = searchParams.get('financial_year');
    const monthFrom = searchParams.get('month_from'); // YYYY-MM
    const monthTo = searchParams.get('month_to');     // YYYY-MM

    let query = adminSupabase
      .from('emissions')
      .select('*')
      .eq('org_id', auth.orgId)
      .order('month', { ascending: true });

    if (siteId) {
      query = query.eq('site_id', siteId);
    }

    if (financialYear) {
      const year = Number(financialYear);
      if (!isNaN(year)) {
        query = query
          .gte('month', `${year}-01-01`)
          .lte('month', `${year}-12-31`);
      }
    }

    if (monthFrom) {
      query = query.gte('month', `${monthFrom}-01`);
    }

    if (monthTo) {
      // Last day of month_to: go to first day of next month then subtract
      const [y, m] = monthTo.split('-').map(Number);
      const nextMonth = m === 12
        ? `${y + 1}-01-01`
        : `${y}-${String(m + 1).padStart(2, '0')}-01`;
      query = query.lt('month', nextMonth);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { data: data ?? [], meta: { count: (data ?? []).length, org_id: auth.orgId } },
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[v1/emissions]', err.message);
    return NextResponse.json(
      { error: err?.message ?? 'Internal server error' },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}