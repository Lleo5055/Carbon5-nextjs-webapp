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

// GET /api/eu-ets/installations/[id]?userId=...
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { supabase, userId, error } = await authenticate(req);
  if (error || !userId) return new NextResponse(error ?? 'Unauthorized', { status: 401 });

  const { data, error: dbErr } = await supabase
    .from('eu_ets_installations')
    .select('*')
    .eq('id', params.id)
    .eq('profile_id', userId)
    .single();

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 404 });
  return NextResponse.json(data);
}

// PUT /api/eu-ets/installations/[id]
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = makeClient();
  const body = await req.json() as {
    userId: string;
    token: string;
    installation_name?: string;
    permit_number?: string;
    activity_type?: string;
    thermal_input_mw?: number | null;
    address?: string | null;
    postcode?: string | null;
    monitoring_methodology?: string | null;
    monitoring_plan_version?: string | null;
    monitoring_plan_approved_date?: string | null;
    operator_holding_account?: string | null;
    is_active?: boolean;
  };

  const { userId, token } = body;
  if (!userId || !token) return new NextResponse('Unauthorized', { status: 401 });
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user || user.id !== userId) return new NextResponse('Unauthorized', { status: 401 });

  const { userId: _u, token: _t, ...fields } = body;
  const { data, error } = await supabase
    .from('eu_ets_installations')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .eq('profile_id', userId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE /api/eu-ets/installations/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { supabase, userId, error } = await authenticate(req);
  if (error || !userId) return new NextResponse(error ?? 'Unauthorized', { status: 401 });

  const { error: dbErr } = await supabase
    .from('eu_ets_installations')
    .delete()
    .eq('id', params.id)
    .eq('profile_id', userId);

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}