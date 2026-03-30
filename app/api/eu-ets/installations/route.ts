import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function makeClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { global: { fetch: (url, opts) => fetch(url, { ...opts, cache: 'no-store' }) } }
  );
}

async function authenticate(req: NextRequest) {
  const supabase = makeClient();
  const userId = req.nextUrl.searchParams.get('userId');
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? req.nextUrl.searchParams.get('token');
  if (!userId || !token) return { supabase, userId: null, error: 'Unauthorized' };
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user || user.id !== userId) return { supabase, userId: null, error: 'Unauthorized' };
  return { supabase, userId, error: null };
}

// GET /api/eu-ets/installations?userId=...
export async function GET(req: NextRequest) {
  const { supabase, userId, error } = await authenticate(req);
  if (error || !userId) return new NextResponse(error ?? 'Unauthorized', { status: 401 });

  const { data, error: dbErr } = await supabase
    .from('eu_ets_installations')
    .select('*')
    .eq('profile_id', userId)
    .order('created_at', { ascending: false });

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// POST /api/eu-ets/installations
export async function POST(req: NextRequest) {
  const supabase = makeClient();
  const body = await req.json() as {
    userId: string;
    token: string;
    installation_name: string;
    permit_number: string;
    activity_type: string;
    thermal_input_mw?: number | null;
    address?: string | null;
    postcode?: string | null;
    monitoring_methodology?: string | null;
    monitoring_plan_version?: string | null;
    monitoring_plan_approved_date?: string | null;
    operator_holding_account?: string | null;
  };

  const { userId, token } = body;
  if (!userId || !token) return new NextResponse('Unauthorized', { status: 401 });
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user || user.id !== userId) return new NextResponse('Unauthorized', { status: 401 });

  const { data, error } = await supabase
    .from('eu_ets_installations')
    .insert({
      profile_id:                    userId,
      installation_name:             body.installation_name,
      permit_number:                 body.permit_number,
      activity_type:                 body.activity_type,
      thermal_input_mw:              body.thermal_input_mw ?? null,
      address:                       body.address ?? null,
      postcode:                      body.postcode ?? null,
      monitoring_methodology:        body.monitoring_methodology ?? null,
      monitoring_plan_version:       body.monitoring_plan_version ?? null,
      monitoring_plan_approved_date: body.monitoring_plan_approved_date ?? null,
      operator_holding_account:      body.operator_holding_account ?? null,
      is_active:                     true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}