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
    const { data, error } = await adminSupabase
      .from('entities')
      .select('*')
      .eq('org_id', auth.orgId)
      .order('name', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { data: data ?? [], meta: { count: (data ?? []).length } },
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('[v1/entities]', err.message);
    return NextResponse.json(
      { error: err?.message ?? 'Internal server error' },
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}